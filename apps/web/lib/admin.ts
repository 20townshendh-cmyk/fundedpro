"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getChallengeSnapshot, getPayoutHoldAssessment } from "@fundedpro/domain";
import { getDb } from "@fundedpro/db";
import { sendChallengeCertificateEmailIfNeeded, sendPayoutCertificateEmailIfNeeded } from "./certificate-email";
import { getSession } from "./auth";
import { evaluateAllTradingAccountLifecycles, evaluateAndPersistTradingAccountLifecycle } from "./challenge-lifecycle";
import { sendChallengeCertificateEmail, sendPayoutCertificateEmail, sendTradingCredentialsEmail } from "./email/service";
import { getWebEnv } from "./env";
import { syncAllTradingAccounts, syncPlatformAccountByLogin } from "./mt5/service";
import { sweepPayoutRequests } from "./payout-sweep";
import { provisionTradingAccountForOrder } from "./trader";
import { decryptTradingPassword, encryptTradingPassword } from "./trading-credentials";

const accountOverrideSchema = z.object({
  tradingAccountId: z.string().min(1),
  nextState: z.enum(["PENDING", "EVALUATION", "FUNDED", "PASSED", "FAILED", "BREACHED", "REVIEW", "RESET"]),
  note: z.string().max(240).optional()
});

const payoutDecisionSchema = z.object({
  payoutRequestId: z.string().min(1),
  nextStatus: z.enum(["REVIEW", "APPROVED", "REJECTED", "PAID"]),
  note: z.string().max(240).optional()
});

const syncSchema = z.object({
  login: z.string().min(1)
});

const billingDecisionSchema = z.object({
  orderId: z.string().min(1),
  nextStatus: z.enum(["OPEN", "PAID", "REFUNDED", "CANCELLED"]),
  note: z.string().max(240).optional()
});

const manualProvisionSchema = z.object({
  orderId: z.string().min(1),
  platform: z.string().min(1).max(64),
  login: z.string().min(1).max(64),
  connection: z.string().min(1).max(120),
  password: z.string().min(1).max(120)
});

const manualImportSchema = z.object({
  tradingAccountId: z.string().min(1),
  currentBalance: z.coerce.number().positive().max(100000000),
  currentEquity: z.coerce.number().positive().max(100000000),
  tradingDays: z.coerce.number().int().min(0).max(100000),
  note: z.string().max(240).optional()
});

const credentialActionSchema = z.object({
  tradingAccountId: z.string().min(1)
});

function generateTemporaryTradingPassword() {
  return randomUUID().replace(/-/g, "").slice(0, 12);
}

export async function requireAdminSession() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  if (session.role !== "ADMIN") {
    redirect("/dashboard");
  }

  return session;
}

export async function overrideTradingAccountStateAction(formData: FormData) {
  const session = await requireAdminSession();
  const parsed = accountOverrideSchema.safeParse({
    tradingAccountId: formData.get("tradingAccountId"),
    nextState: formData.get("nextState"),
    note: formData.get("note") || undefined
  });

  if (!parsed.success) {
    redirect("/admin/accounts?error=invalid-override");
  }

  const db = getDb();
  const currentAccount = await db.query<{ id: string; login: string; accountState: string }>(
    'SELECT "id", "login", "accountState" FROM "TradingAccount" WHERE "id" = $1 LIMIT 1',
    [parsed.data.tradingAccountId]
  );

  const account = currentAccount.rows[0];

  if (!account) {
    redirect("/admin/accounts?error=account-missing");
  }

  await db.query(
    `
      UPDATE "TradingAccount"
      SET
        "accountState" = $1,
        "currentPhase" = CASE WHEN $1 = 'RESET' THEN 1 ELSE "currentPhase" END,
        "phaseStartBalance" = CASE WHEN $1 = 'RESET' THEN "startingBalance" ELSE "phaseStartBalance" END,
        "phaseStartedAt" = CASE WHEN $1 = 'RESET' THEN NOW() ELSE "phaseStartedAt" END,
        "reviewQueuedAt" = CASE WHEN $1 = 'REVIEW' THEN COALESCE("reviewQueuedAt", NOW()) WHEN $1 = 'RESET' THEN NULL ELSE "reviewQueuedAt" END,
        "passedAt" = CASE WHEN $1 = 'PASSED' THEN COALESCE("passedAt", NOW()) WHEN $1 = 'RESET' THEN NULL ELSE "passedAt" END,
        "fundedAt" = CASE WHEN $1 = 'FUNDED' THEN COALESCE("fundedAt", NOW()) WHEN $1 = 'RESET' THEN NULL ELSE "fundedAt" END,
        "breachedAt" = CASE WHEN $1 = 'BREACHED' THEN COALESCE("breachedAt", NOW()) WHEN $1 = 'RESET' THEN NULL ELSE "breachedAt" END,
        "lastEvaluatedAt" = NOW(),
        "updatedAt" = NOW()
      WHERE "id" = $2
    `,
    [parsed.data.nextState, account.id]
  );

  if (parsed.data.nextState === "EVALUATION" || parsed.data.nextState === "RESET") {
    await evaluateAndPersistTradingAccountLifecycle(account.id);
  }

  const note = parsed.data.note?.trim();
  const summary = `Account ${account.login} moved from ${account.accountState} to ${parsed.data.nextState}${note ? `: ${note}` : ""}`;

  await db.query(
    `
      INSERT INTO "AuditLog" ("id", "actorUserId", "targetType", "targetId", "action", "summary", "metadata", "createdAt")
      VALUES ($1, $2, 'TRADING_ACCOUNT', $3, 'ACCOUNT_STATE_OVERRIDE', $4, $5::jsonb, NOW())
    `,
    [
      randomUUID(),
      session.userId,
      account.id,
      summary,
      JSON.stringify({
        login: account.login,
        previousState: account.accountState,
        nextState: parsed.data.nextState,
        note: note ?? null
      })
    ]
  );

  if (["PASSED", "FUNDED"].includes(parsed.data.nextState)) {
    try {
      await sendChallengeCertificateEmailIfNeeded({
        tradingAccountId: account.id,
        actorUserId: session.userId
      });
    } catch (error) {
      console.error("admin-challenge-certificate-email-failed", { tradingAccountId: account.id, error });
    }
  }

  redirect("/admin/accounts?updated=1");
}

export async function reviewPayoutRequestAction(formData: FormData) {
  const session = await requireAdminSession();
  const parsed = payoutDecisionSchema.safeParse({
    payoutRequestId: formData.get("payoutRequestId"),
    nextStatus: formData.get("nextStatus"),
    note: formData.get("note") || undefined
  });

  if (!parsed.success) {
    redirect("/admin/payouts?error=invalid-review");
  }

  const db = getDb();
  const payoutResult = await db.query<{
    id: string;
    amountCents: number;
    status: string;
    login: string;
    email: string;
    accountState: string;
    startingBalance: string;
    currentBalance: string;
    currentEquity: string;
    dailyLossLimit: string;
    totalLossLimit: string;
    profitTarget: string;
    tradingDays: number;
  }>(
    `
      SELECT pr."id", pr."amountCents", pr."status", ta."login", u."email", ta."accountState", ta."startingBalance", ta."currentBalance", ta."currentEquity", ta."dailyLossLimit", ta."totalLossLimit", ta."profitTarget", ta."tradingDays"
      FROM "PayoutRequest" pr
      JOIN "TradingAccount" ta ON ta."id" = pr."tradingAccountId"
      JOIN "User" u ON u."id" = pr."userId"
      WHERE pr."id" = $1
      LIMIT 1
    `,
    [parsed.data.payoutRequestId]
  );

  const payout = payoutResult.rows[0];

  if (!payout) {
    redirect("/admin/payouts?error=missing-request");
  }

  const snapshot = getChallengeSnapshot({
    startingBalance: Number(payout.startingBalance),
    currentBalance: Number(payout.currentBalance),
    currentEquity: Number(payout.currentEquity),
    profitTarget: Number(payout.profitTarget),
    dailyLossLimit: Number(payout.dailyLossLimit),
    totalLossLimit: Number(payout.totalLossLimit),
    tradingDays: payout.tradingDays,
    minTradingDays: 3,
    accountState: payout.accountState
  });
  const holdAssessment = getPayoutHoldAssessment({
    accountState: payout.accountState,
    currentProfit: snapshot.currentProfit,
    dailyLossRemaining: snapshot.dailyLossRemaining,
    dailyLossLimit: Number(payout.dailyLossLimit),
    totalLossRemaining: snapshot.totalLossRemaining,
    totalLossLimit: Number(payout.totalLossLimit),
    tradingDaysRemaining: snapshot.tradingDaysRemaining,
    ruleStatus: snapshot.ruleStatus
  });

  if (["APPROVED", "PAID"].includes(parsed.data.nextStatus) && !holdAssessment.eligible) {
    redirect(`/admin/payouts?error=${holdAssessment.severity === "critical" ? "critical-hold" : "hold-active"}`);
  }

  const note = parsed.data.note?.trim();
  await db.query(
    'UPDATE "PayoutRequest" SET "status" = $1, "note" = $2, "updatedAt" = NOW() WHERE "id" = $3',
    [parsed.data.nextStatus, note ?? null, payout.id]
  );

  await db.query(
    `
      INSERT INTO "AuditLog" ("id", "actorUserId", "targetType", "targetId", "action", "summary", "metadata", "createdAt")
      VALUES ($1, $2, 'PAYOUT_REQUEST', $3, 'PAYOUT_STATUS_UPDATED', $4, $5::jsonb, NOW())
    `,
    [
      randomUUID(),
      session.userId,
      payout.id,
      `Payout request for ${payout.login} moved from ${payout.status} to ${parsed.data.nextStatus}${note ? `: ${note}` : ""}`,
      JSON.stringify({
        login: payout.login,
        email: payout.email,
        previousStatus: payout.status,
        nextStatus: parsed.data.nextStatus,
        amountCents: payout.amountCents,
        note: note ?? null
      })
    ]
  );

  if (["APPROVED", "PAID"].includes(parsed.data.nextStatus)) {
    try {
      await sendPayoutCertificateEmailIfNeeded({
        payoutRequestId: payout.id,
        actorUserId: session.userId
      });
    } catch (error) {
      console.error("payout-certificate-email-failed", { payoutRequestId: payout.id, error });
    }
  }

  redirect("/admin/payouts?updated=1");
}

export async function runPlatformResyncAction(formData: FormData) {
  await requireAdminSession();
  const parsed = syncSchema.safeParse({
    login: formData.get("login")
  });

  if (!parsed.success) {
    redirect("/admin/sync?error=invalid-login");
  }

  await syncPlatformAccountByLogin(parsed.data.login);
  redirect("/admin/sync?resynced=1");
}

export async function simulatePlatformSyncFailureAction(formData: FormData) {
  await requireAdminSession();
  const parsed = syncSchema.safeParse({
    login: formData.get("login")
  });

  if (!parsed.success) {
    redirect("/admin/sync?error=invalid-login");
  }

  await syncPlatformAccountByLogin(parsed.data.login, { simulateFailure: true });
  redirect("/admin/sync?failed=1");
}

export async function runPlatformWorkerCycleAction() {
  const session = await requireAdminSession();
  await syncAllTradingAccounts({ actorUserId: session.userId });
  redirect("/admin/sync?worker=1");
}

export async function runPayoutHoldSweepAction() {
  const session = await requireAdminSession();
  await sweepPayoutRequests({ actorUserId: session.userId });
  redirect("/admin/payouts?swept=1");
}

export async function runLifecycleSweepAction() {
  const session = await requireAdminSession();
  const results = await evaluateAllTradingAccountLifecycles();

  await getDb().query(
    `
      INSERT INTO "AuditLog" ("id", "actorUserId", "targetType", "targetId", "action", "summary", "metadata", "createdAt")
      VALUES ($1, $2, 'TRADING_ACCOUNT_FLEET', 'fleet', 'LIFECYCLE_SWEEP_RUN', $3, $4::jsonb, NOW())
    `,
    [
      randomUUID(),
      session.userId,
      `Lifecycle sweep evaluated ${results.length} account(s).`,
      JSON.stringify({
        total: results.length,
        transitioned: results.filter((result) => result.transition !== "none").length,
        reviewQueued: results.filter((result) => result.transition === "review-queued").length,
        passed: results.filter((result) => result.transition === "passed").length,
        funded: results.filter((result) => result.transition === "funded").length,
        breached: results.filter((result) => result.transition === "breached").length,
        phaseAdvanced: results.filter((result) => result.transition === "phase-advanced").length
      })
    ]
  );

  redirect("/admin/risk?swept=1");
}

export async function reviewBillingOrderAction(formData: FormData) {
  const session = await requireAdminSession();
  const parsed = billingDecisionSchema.safeParse({
    orderId: formData.get("orderId"),
    nextStatus: formData.get("nextStatus"),
    note: formData.get("note") || undefined
  });

  if (!parsed.success) {
    redirect("/admin/billing?error=invalid-review");
  }

  const db = getDb();
  const orderResult = await db.query<{
    id: string;
    userId: string;
    status: string;
    challengePlanId: string;
    planName: string;
    accountSize: number;
    profitTargetPct: string;
    dailyDrawdownPct: string;
    maxDrawdownPct: string;
  }>(
    `
      SELECT
        co."id",
        co."userId",
        co."status",
        co."challengePlanId",
        cp."name" AS "planName",
        cp."accountSize",
        cp."profitTargetPct"::text,
        cp."dailyDrawdownPct"::text,
        cp."maxDrawdownPct"::text
      FROM "ChallengeOrder" co
      JOIN "ChallengePlan" cp ON cp."id" = co."challengePlanId"
      WHERE co."id" = $1
      LIMIT 1
    `,
    [parsed.data.orderId]
  );

  const order = orderResult.rows[0];

  if (!order) {
    redirect("/admin/billing?error=missing-order");
  }

  const note = parsed.data.note?.trim();
  await db.query('UPDATE "ChallengeOrder" SET "status" = $1, "updatedAt" = NOW() WHERE "id" = $2', [parsed.data.nextStatus, order.id]);

  if (parsed.data.nextStatus === "PAID") {
    await db.query('UPDATE "Invoice" SET "status" = $1, "updatedAt" = NOW() WHERE "challengeOrderId" = $2', ["PAID", order.id]);
    await provisionTradingAccountForOrder({
      db,
      userId: order.userId,
      orderId: order.id,
      accountSize: order.accountSize,
      profitTargetPct: order.profitTargetPct,
      dailyDrawdownPct: order.dailyDrawdownPct,
      maxDrawdownPct: order.maxDrawdownPct,
      actorUserId: session.userId
    });
  }

  if (parsed.data.nextStatus === "REFUNDED") {
    await db.query('UPDATE "Invoice" SET "status" = $1, "updatedAt" = NOW() WHERE "challengeOrderId" = $2', ["REFUNDED", order.id]);
  }

  if (parsed.data.nextStatus === "OPEN" || parsed.data.nextStatus === "CANCELLED") {
    await db.query('UPDATE "Invoice" SET "status" = $1, "updatedAt" = NOW() WHERE "challengeOrderId" = $2', [parsed.data.nextStatus === "OPEN" ? "OPEN" : "REFUNDED", order.id]);
  }

  await db.query(
    `
      INSERT INTO "AuditLog" ("id", "actorUserId", "targetType", "targetId", "action", "summary", "metadata", "createdAt")
      VALUES ($1, $2, 'CHALLENGE_ORDER', $3, 'BILLING_ORDER_UPDATED', $4, $5::jsonb, NOW())
    `,
    [
      randomUUID(),
      session.userId,
      order.id,
      `Billing order for ${order.planName} moved from ${order.status} to ${parsed.data.nextStatus}${note ? `: ${note}` : ""}`,
      JSON.stringify({
        challengePlanId: order.challengePlanId,
        previousStatus: order.status,
        nextStatus: parsed.data.nextStatus,
        note: note ?? null
      })
    ]
  );

  redirect("/admin/billing?updated=1");
}

export async function provisionManualTradingAccountAction(formData: FormData) {
  const session = await requireAdminSession();
  const parsed = manualProvisionSchema.safeParse({
    orderId: formData.get("orderId"),
    platform: formData.get("platform"),
    login: formData.get("login"),
    connection: formData.get("connection"),
    password: formData.get("password")
  });

  if (!parsed.success) {
    redirect("/admin/billing?error=invalid-provision");
  }

  const db = getDb();
  const orderResult = await db.query<{
    id: string;
    userId: string;
    status: string;
    email: string;
    fullName: string;
    accountSize: number;
    profitTargetPct: string;
    dailyDrawdownPct: string;
    maxDrawdownPct: string;
  }>(
    `
      SELECT
        co."id",
        co."userId",
        co."status",
        u."email",
        u."fullName",
        cp."accountSize",
        cp."profitTargetPct"::text,
        cp."dailyDrawdownPct"::text,
        cp."maxDrawdownPct"::text
      FROM "ChallengeOrder" co
      JOIN "User" u ON u."id" = co."userId"
      JOIN "ChallengePlan" cp ON cp."id" = co."challengePlanId"
      WHERE co."id" = $1
      LIMIT 1
    `,
    [parsed.data.orderId]
  );
  const order = orderResult.rows[0];

  if (!order || order.status !== "PAID") {
    redirect("/admin/billing?error=order-not-paid");
  }

  const existingLogin = await db.query<{ id: string }>('SELECT "id" FROM "TradingAccount" WHERE "login" = $1 LIMIT 1', [parsed.data.login.trim()]);
  if (existingLogin.rowCount) {
    redirect("/admin/billing?error=login-taken");
  }

  const provisioned = await provisionTradingAccountForOrder({
    db,
    userId: order.userId,
    orderId: order.id,
    accountSize: order.accountSize,
    profitTargetPct: order.profitTargetPct,
    dailyDrawdownPct: order.dailyDrawdownPct,
    maxDrawdownPct: order.maxDrawdownPct,
    actorUserId: session.userId,
    loginOverride: parsed.data.login.trim(),
    providerOverride: `manual:${parsed.data.platform.trim()}:${parsed.data.connection.trim()}`,
    platformOverride: parsed.data.platform.trim(),
    connectionOverride: parsed.data.connection.trim(),
    passwordOverride: parsed.data.password
  });

  await db.query(
    `
      INSERT INTO "AuditLog" ("id", "actorUserId", "targetType", "targetId", "action", "summary", "metadata", "createdAt")
      VALUES ($1, $2, 'CHALLENGE_ORDER', $3, 'MANUAL_PLATFORM_PROVISIONED', $4, $5::jsonb, NOW())
    `,
    [
        randomUUID(),
        session.userId,
        order.id,
        `Manual ${parsed.data.platform.trim()} account ${parsed.data.login.trim()} provisioned for paid order.`,
        JSON.stringify({
          orderId: order.id,
          tradingAccountId: provisioned.accountId,
          platform: parsed.data.platform.trim(),
          login: parsed.data.login.trim(),
          connection: parsed.data.connection.trim()
        })
      ]
  );

  try {
    await sendTradingCredentialsEmail({
      to: order.email,
      fullName: order.fullName,
      login: parsed.data.login.trim(),
      password: parsed.data.password,
      platform: parsed.data.platform.trim(),
      connection: parsed.data.connection.trim(),
      billingUrl: `${getWebEnv().appUrl}/dashboard/billing`
    });
  } catch (error) {
    console.error("manual-trading-email-failed", { orderId: order.id, error });
  }

  redirect("/admin/billing?provisioned=1");
}

export async function resendTradingCredentialsAction(formData: FormData) {
  const session = await requireAdminSession();
  const parsed = credentialActionSchema.safeParse({
    tradingAccountId: formData.get("tradingAccountId")
  });

  if (!parsed.success) {
    redirect("/admin/billing?error=invalid-provision");
  }

  const db = getDb();
  const result = await db.query<{
    id: string;
    login: string;
    platform: string;
    connection: string;
    tradingPassword: string | null;
    email: string;
    fullName: string;
  }>(
    `
      SELECT ta."id", ta."login", ta."platform", ta."connection", ta."tradingPassword", u."email", u."fullName"
      FROM "TradingAccount" ta
      JOIN "User" u ON u."id" = ta."userId"
      WHERE ta."id" = $1
      LIMIT 1
    `,
    [parsed.data.tradingAccountId]
  );
  const account = result.rows[0];

  if (!account || !account.tradingPassword) {
    redirect("/admin/billing?error=missing-order");
  }

  await sendTradingCredentialsEmail({
    to: account.email,
    fullName: account.fullName,
    login: account.login,
    password: decryptTradingPassword(account.tradingPassword) ?? "",
    platform: account.platform,
    connection: account.connection,
    billingUrl: `${getWebEnv().appUrl}/dashboard/account`
  });

  await db.query(
    `
      INSERT INTO "AuditLog" ("id", "actorUserId", "targetType", "targetId", "action", "summary", "metadata", "createdAt")
      VALUES ($1, $2, 'TRADING_ACCOUNT', $3, 'TRADING_CREDENTIALS_RESENT', $4, $5::jsonb, NOW())
    `,
    [
      randomUUID(),
      session.userId,
      account.id,
      `Trading credentials resent for ${account.login}.`,
      JSON.stringify({ login: account.login, email: account.email })
    ]
  );

  redirect("/admin/billing?credentials=resent");
}

export async function regenerateTradingCredentialsAction(formData: FormData) {
  const session = await requireAdminSession();
  const parsed = credentialActionSchema.safeParse({
    tradingAccountId: formData.get("tradingAccountId")
  });

  if (!parsed.success) {
    redirect("/admin/billing?error=invalid-provision");
  }

  const db = getDb();
  const result = await db.query<{
    id: string;
    login: string;
    platform: string;
    connection: string;
    email: string;
    fullName: string;
  }>(
    `
      SELECT ta."id", ta."login", ta."platform", ta."connection", u."email", u."fullName"
      FROM "TradingAccount" ta
      JOIN "User" u ON u."id" = ta."userId"
      WHERE ta."id" = $1
      LIMIT 1
    `,
    [parsed.data.tradingAccountId]
  );
  const account = result.rows[0];

  if (!account) {
    redirect("/admin/billing?error=missing-order");
  }

  const nextPassword = generateTemporaryTradingPassword();

  await db.query(
    `
      UPDATE "TradingAccount"
      SET "tradingPassword" = $1, "credentialsIssuedAt" = NOW(), "updatedAt" = NOW()
      WHERE "id" = $2
    `,
    [encryptTradingPassword(nextPassword), account.id]
  );

  await sendTradingCredentialsEmail({
    to: account.email,
    fullName: account.fullName,
    login: account.login,
    password: nextPassword,
    platform: account.platform,
    connection: account.connection,
    billingUrl: `${getWebEnv().appUrl}/dashboard/account`
  });

  await db.query(
    `
      INSERT INTO "AuditLog" ("id", "actorUserId", "targetType", "targetId", "action", "summary", "metadata", "createdAt")
      VALUES ($1, $2, 'TRADING_ACCOUNT', $3, 'TRADING_CREDENTIALS_REGENERATED', $4, $5::jsonb, NOW())
    `,
    [
      randomUUID(),
      session.userId,
      account.id,
      `Trading credentials regenerated for ${account.login}.`,
      JSON.stringify({ login: account.login, email: account.email })
    ]
  );

  redirect("/admin/billing?credentials=regenerated");
}

export async function resendChallengeCertificateAction(formData: FormData) {
  const session = await requireAdminSession();
  const parsed = credentialActionSchema.safeParse({
    tradingAccountId: formData.get("tradingAccountId")
  });

  if (!parsed.success) {
    redirect("/admin/accounts?error=account-missing");
  }

  const db = getDb();
  const result = await db.query<{
    id: string;
    userId: string;
    login: string;
    accountState: string;
    email: string;
    fullName: string;
  }>(
    `
      SELECT ta."id", ta."userId", ta."login", ta."accountState", u."email", u."fullName"
      FROM "TradingAccount" ta
      JOIN "User" u ON u."id" = ta."userId"
      WHERE ta."id" = $1
      LIMIT 1
    `,
    [parsed.data.tradingAccountId]
  );
  const account = result.rows[0];

  if (!account || !["PASSED", "FUNDED"].includes(account.accountState)) {
    redirect("/admin/accounts?error=account-missing");
  }

  await sendChallengeCertificateEmail({
    to: account.email,
    fullName: account.fullName,
    login: account.login,
    accountState: account.accountState as "PASSED" | "FUNDED",
    certificateUrl: `${getWebEnv().appUrl}/dashboard/account/certificate?accountId=${encodeURIComponent(account.id)}`
  });

  await db.query(
    `
      INSERT INTO "AuditLog" ("id", "actorUserId", "targetType", "targetId", "action", "summary", "metadata", "createdAt")
      VALUES ($1, $2, 'TRADING_ACCOUNT', $3, 'CHALLENGE_CERTIFICATE_RESENT', $4, $5::jsonb, NOW())
    `,
    [
      randomUUID(),
      session.userId,
      account.id,
      `Challenge certificate resent for ${account.login}.`,
      JSON.stringify({ login: account.login, email: account.email, accountState: account.accountState })
    ]
  );

  redirect("/admin/accounts?certificate=resent");
}

export async function resendPayoutCertificateAction(formData: FormData) {
  const session = await requireAdminSession();
  const parsed = z.object({ payoutRequestId: z.string().min(1) }).safeParse({
    payoutRequestId: formData.get("payoutRequestId")
  });

  if (!parsed.success) {
    redirect("/admin/payouts?error=missing-request");
  }

  const db = getDb();
  const result = await db.query<{
    id: string;
    login: string;
    amountCents: number;
    status: string;
    email: string;
    fullName: string;
  }>(
    `
      SELECT pr."id", pr."amountCents", pr."status", ta."login", u."email", u."fullName"
      FROM "PayoutRequest" pr
      JOIN "TradingAccount" ta ON ta."id" = pr."tradingAccountId"
      JOIN "User" u ON u."id" = pr."userId"
      WHERE pr."id" = $1
      LIMIT 1
    `,
    [parsed.data.payoutRequestId]
  );
  const payout = result.rows[0];

  if (!payout || !["APPROVED", "PAID"].includes(payout.status)) {
    redirect("/admin/payouts?error=missing-request");
  }

  await sendPayoutCertificateEmail({
    to: payout.email,
    fullName: payout.fullName,
    login: payout.login,
    amountCents: payout.amountCents,
    payoutStatus: payout.status as "APPROVED" | "PAID",
    certificateUrl: `${getWebEnv().appUrl}/dashboard/payouts/certificate?payoutId=${encodeURIComponent(payout.id)}`
  });

  await db.query(
    `
      INSERT INTO "AuditLog" ("id", "actorUserId", "targetType", "targetId", "action", "summary", "metadata", "createdAt")
      VALUES ($1, $2, 'PAYOUT_REQUEST', $3, 'PAYOUT_CERTIFICATE_RESENT', $4, $5::jsonb, NOW())
    `,
    [
      randomUUID(),
      session.userId,
      payout.id,
      `Payout certificate resent for ${payout.login}.`,
      JSON.stringify({ login: payout.login, email: payout.email, amountCents: payout.amountCents, status: payout.status })
    ]
  );

  redirect("/admin/payouts?certificate=resent");
}

export async function importManualAccountSnapshotAction(formData: FormData) {
  const session = await requireAdminSession();
  const parsed = manualImportSchema.safeParse({
    tradingAccountId: formData.get("tradingAccountId"),
    currentBalance: formData.get("currentBalance"),
    currentEquity: formData.get("currentEquity"),
    tradingDays: formData.get("tradingDays"),
    note: formData.get("note") || undefined
  });

  if (!parsed.success) {
    redirect("/admin/accounts?error=invalid-import");
  }

  const db = getDb();
  const accountResult = await db.query<{
    id: string;
    login: string;
    provider: string;
    startingBalance: string;
  }>(
    'SELECT "id", "login", "provider", "startingBalance" FROM "TradingAccount" WHERE "id" = $1 LIMIT 1',
    [parsed.data.tradingAccountId]
  );
  const account = accountResult.rows[0];

  if (!account) {
    redirect("/admin/accounts?error=account-missing");
  }

  const currentBalance = Number(parsed.data.currentBalance.toFixed(2));
  const currentEquity = Number(parsed.data.currentEquity.toFixed(2));
  const startingBalance = Number(account.startingBalance);
  const realizedPnl = Number((currentBalance - startingBalance).toFixed(2));
  const unrealizedPnl = Number((currentEquity - currentBalance).toFixed(2));
  const dailyLossUsed = Number(Math.max(0, currentBalance - currentEquity).toFixed(2));
  const totalLossUsed = Number(Math.max(0, startingBalance - currentEquity).toFixed(2));
  const note = parsed.data.note?.trim();

  await db.query("BEGIN");

  try {
    await db.query(
      `
        UPDATE "TradingAccount"
        SET "currentBalance" = $1, "currentEquity" = $2, "tradingDays" = $3, "updatedAt" = NOW()
        WHERE "id" = $4
      `,
      [currentBalance, currentEquity, parsed.data.tradingDays, account.id]
    );

    await db.query(
      `
        INSERT INTO "Mt5SyncRun" (
          "id", "tradingAccountId", "login", "provider", "status", "balance", "equity", "realizedPnl", "unrealizedPnl",
          "dailyLossUsed", "totalLossUsed", "tradingDays", "rawPayload", "syncedAt", "createdAt", "updatedAt"
        )
        VALUES ($1, $2, $3, $4, 'SUCCESS', $5, $6, $7, $8, $9, $10, $11, $12::jsonb, NOW(), NOW(), NOW())
      `,
      [
        randomUUID(),
        account.id,
        account.login,
        account.provider,
        currentBalance,
        currentEquity,
        realizedPnl,
        unrealizedPnl,
        dailyLossUsed,
        totalLossUsed,
        parsed.data.tradingDays,
        JSON.stringify({
          source: "manual-import",
          note: note ?? null
        })
      ]
    );

    await db.query("COMMIT");
  } catch (error) {
    await db.query("ROLLBACK");
    throw error;
  }

  await evaluateAndPersistTradingAccountLifecycle(account.id);

  await db.query(
    `
      INSERT INTO "AuditLog" ("id", "actorUserId", "targetType", "targetId", "action", "summary", "metadata", "createdAt")
      VALUES ($1, $2, 'TRADING_ACCOUNT', $3, 'MANUAL_ACCOUNT_IMPORT', $4, $5::jsonb, NOW())
    `,
    [
      randomUUID(),
      session.userId,
      account.id,
      `Manual account snapshot imported for ${account.login}.`,
      JSON.stringify({
        login: account.login,
        currentBalance,
        currentEquity,
        tradingDays: parsed.data.tradingDays,
        note: note ?? null
      })
    ]
  );

  redirect("/admin/accounts?imported=1");
}
