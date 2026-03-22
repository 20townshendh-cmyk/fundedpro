"use server";

import { MARKETING_SALE_DISCOUNT_PCT, getChallengePlanBasePriceCents, getChallengeSnapshot, getPayoutHoldAssessment } from "@fundedpro/domain";
import { randomBytes, randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@fundedpro/db";
import { getSession } from "./auth";
import { evaluateAndPersistTradingAccountLifecycle } from "./challenge-lifecycle";
import { sendOrderReceivedEmail, sendTradingCredentialsEmail } from "./email/service";
import { getWebEnv } from "./env";
import { getStripeClient } from "./stripe";
import { ensureDemoTradingWorkspaceForTradingAccount } from "./demo-trading/bootstrap";
import { syncTradingAccountFromDemo } from "./internal-trading-sync";
import { encryptTradingPassword } from "./trading-credentials";

const CHECKOUT_COUPONS = {
  HELLO: 20
} as const;

const payoutRequestSchema = z.object({
  tradingAccountId: z.string().uuid(),
  amountDollars: z.coerce.number().positive().max(1000000),
  note: z.string().max(240).optional()
});

function getCheckoutDiscountPct(input: FormDataEntryValue | null) {
  const code = String(input ?? "").trim().toUpperCase();
  if (!code) return { code: "", discountPct: 0 };
  return {
    code,
    discountPct: CHECKOUT_COUPONS[code as keyof typeof CHECKOUT_COUPONS] ?? 0
  };
}

async function generateUniqueLogin(db: ReturnType<typeof getDb>) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const login = `FP${Math.floor(100000 + Math.random() * 899999)}`;
    const existing = await db.query<{ id: string }>('SELECT "id" FROM "TradingAccount" WHERE "login" = $1 LIMIT 1', [login]);

    if (!existing.rowCount) {
      return login;
    }
  }

  return `FP${Date.now().toString().slice(-6)}`;
}

function generateTradingPassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = randomBytes(12);

  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
}

function getPlanMetrics(plan: {
  accountSize: number;
  profitTargetPct: string;
  dailyDrawdownPct: string;
  maxDrawdownPct: string;
}) {
  return {
    startingBalance: plan.accountSize,
    profitTarget: (plan.accountSize * Number(plan.profitTargetPct)) / 100,
    dailyLossLimit: (plan.accountSize * Number(plan.dailyDrawdownPct)) / 100,
    totalLossLimit: (plan.accountSize * Number(plan.maxDrawdownPct)) / 100
  };
}

const NON_ACTIVE_ACCOUNT_STATES = ["FAILED", "BREACHED", "RESET"] as const;

export async function getCheckoutPurchaseCapacity(db: ReturnType<typeof getDb>, userId: string) {
  const counts = await db.query<{
    activeAccountCount: string;
    activeApexAccountCount: string;
  }>(
    `
      SELECT
        COUNT(*) FILTER (
          WHERE ta."accountState" IS NULL
            OR ta."accountState"::text <> ALL($2::text[])
        )::text AS "activeAccountCount",
        COUNT(*) FILTER (
          WHERE (ta."accountState" IS NULL OR ta."accountState"::text <> ALL($2::text[]))
            AND cp."accountSize" = 600000
        )::text AS "activeApexAccountCount"
      FROM "TradingAccount" ta
      JOIN "ChallengeOrder" co ON co."id" = ta."challengeOrderId"
      JOIN "ChallengePlan" cp ON cp."id" = co."challengePlanId"
      WHERE ta."userId" = $1
    `,
    [userId, [...NON_ACTIVE_ACCOUNT_STATES]]
  );

  return {
    activeAccountCount: Number(counts.rows[0]?.activeAccountCount ?? 0),
    activeApexAccountCount: Number(counts.rows[0]?.activeApexAccountCount ?? 0),
    maxActiveAccounts: 5,
    maxActiveApexAccounts: 2
  };
}

async function ensureFallbackChallengePlan(db: ReturnType<typeof getDb>, slug: string) {
  if (slug !== "apex-600k") {
    return null;
  }

  await db.query(
    `
      INSERT INTO "ChallengePlan" (
        "id", "slug", "name", "challengeType", "accountSize", "priceCents", "phaseCount",
        "profitTargetPct", "dailyDrawdownPct", "maxDrawdownPct", "minTradingDays", "payoutSplitPct",
        "resetEnabled", "createdAt", "updatedAt"
      )
      VALUES (
        'plan_apex', 'apex-600k', 'Apex', 'ONE_STEP', 600000, 80000, 1,
        6.00, 2.00, 5.00, 3, 85.00, false, NOW(), NOW()
      )
      ON CONFLICT ("slug")
      DO NOTHING
    `
  );

  const planResult = await db.query<{ id: string; name: string; accountSize: number; priceCents: number }>(
    'SELECT "id", "name", "accountSize", "priceCents" FROM "ChallengePlan" WHERE "slug" = $1 LIMIT 1',
    [slug]
  );

  return planResult.rows[0] ?? null;
}

async function createStripeCheckoutSession(input: {
  orderId: string;
  planId: string;
  planSlug: string;
  planName: string;
  accountSize: number;
  priceCents: number;
  userId: string;
  email: string;
}) {
  const env = getWebEnv();
  const stripe = getStripeClient();

  if (!env.hasRealStripe || !stripe) {
    return null;
  }

  return stripe.checkout.sessions.create({
    mode: "payment",
    success_url: `${env.appUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${env.appUrl}/checkout/cancel?orderId=${input.orderId}`,
    customer_email: input.email,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: input.priceCents,
          product_data: {
            name: `${input.planName} Challenge`,
            description: `${input.accountSize.toLocaleString("en-GB", { style: "currency", currency: "USD", maximumFractionDigits: 0 })} FundedPro evaluation`
          }
        }
      }
    ],
    metadata: {
      orderId: input.orderId,
      userId: input.userId,
      planId: input.planId,
      planSlug: input.planSlug
    }
  });
}

export async function provisionTradingAccountForOrder(input: {
  db: ReturnType<typeof getDb>;
  userId: string;
  orderId: string;
  accountSize: number;
  profitTargetPct: string;
  dailyDrawdownPct: string;
  maxDrawdownPct: string;
  actorUserId: string;
  loginOverride?: string;
  providerOverride?: string;
  platformOverride?: string;
  connectionOverride?: string;
  passwordOverride?: string;
}) {
  const existingAccount = await input.db.query<{ id: string }>(
    `
      SELECT "id"
      FROM "TradingAccount"
      WHERE "challengeOrderId" = $1
      LIMIT 1
    `,
    [input.orderId]
  );

  if (existingAccount.rowCount) {
    return {
      accountId: existingAccount.rows[0]?.id ?? null,
      wasCreated: false
    };
  }

  const metrics = getPlanMetrics(input);
  const accountId = randomUUID();
  const login = input.loginOverride ?? await generateUniqueLogin(input.db);
  const provider = input.providerOverride ?? "phynic";
  const platform = input.platformOverride ?? "Phynic";
  const connection = input.connectionOverride ?? "Phynic";
  const tradingPassword = input.passwordOverride ?? generateTradingPassword();
  const encryptedTradingPassword = encryptTradingPassword(tradingPassword);

  await input.db.query(
    `
      INSERT INTO "TradingAccount" (
        "id", "userId", "challengeOrderId", "login", "platform", "connection", "tradingPassword", "credentialsIssuedAt", "provider", "accountState", "currentPhase",
        "startingBalance", "phaseStartBalance", "currentBalance", "currentEquity", "dailyLossLimit", "totalLossLimit", "profitTarget", "tradingDays",
        "phaseStartedAt", "lastEvaluatedAt", "createdAt", "updatedAt"
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, NOW(), $8, 'EVALUATION', 1, $9, $9, $9, $9,
        $10, $11, $12, 0, NOW(), NOW(), NOW(), NOW()
      );
    `,
    [
      accountId,
      input.userId,
      input.orderId,
      login,
      platform,
      connection,
      encryptedTradingPassword,
      provider,
      metrics.startingBalance,
      metrics.dailyLossLimit,
      metrics.totalLossLimit,
      metrics.profitTarget
    ]
  );

  await evaluateAndPersistTradingAccountLifecycle(accountId);
  await ensureDemoTradingWorkspaceForTradingAccount({
    userId: input.userId,
    tradingAccountId: accountId,
    accountName: login,
    startingBalance: metrics.startingBalance
  });
  await input.db.query(
    `
      INSERT INTO "AuditLog" ("id", "actorUserId", "targetType", "targetId", "action", "summary", "metadata", "createdAt")
      VALUES ($1, $2, 'TRADING_ACCOUNT', $3, 'ACCOUNT_PROVISIONED', $4, $5::jsonb, NOW())
    `,
    [
      randomUUID(),
      input.actorUserId,
      accountId,
      `Trading account ${login} provisioned from paid checkout.`,
      JSON.stringify({
        orderId: input.orderId,
        login,
        platform,
        connection,
        startingBalance: metrics.startingBalance,
        dailyLossLimit: metrics.dailyLossLimit,
        totalLossLimit: metrics.totalLossLimit,
        profitTarget: metrics.profitTarget
      })
    ]
  );

  return {
    accountId,
    login,
    tradingPassword,
    platform,
    connection,
    wasCreated: true
  };
}

export async function finalizePaidOrder(input: {
  db: ReturnType<typeof getDb>;
  orderId: string;
  actorUserId: string;
}) {
  const orderResult = await input.db.query<{
    id: string;
    userId: string;
    status: string;
    challengePlanId: string;
    planName: string;
    accountSize: number;
    profitTargetPct: string;
    dailyDrawdownPct: string;
    maxDrawdownPct: string;
    phaseCount: number;
    email: string;
    fullName: string;
    invoiceReference: string;
    invoiceAmountCents: number;
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
        cp."maxDrawdownPct"::text,
        cp."phaseCount",
        u."email",
        u."fullName",
        i."reference" AS "invoiceReference",
        i."amountCents" AS "invoiceAmountCents"
      FROM "ChallengeOrder" co
      JOIN "ChallengePlan" cp ON cp."id" = co."challengePlanId"
      JOIN "User" u ON u."id" = co."userId"
      JOIN "Invoice" i ON i."challengeOrderId" = co."id"
      WHERE co."id" = $1
      LIMIT 1
    `,
    [input.orderId]
  );

  const order = orderResult.rows[0];

  if (!order) {
    return null;
  }

  if (order.status !== "PAID") {
    await input.db.query('UPDATE "ChallengeOrder" SET "status" = $1, "updatedAt" = NOW() WHERE "id" = $2', ["PAID", order.id]);
    await input.db.query(
      'UPDATE "Invoice" SET "status" = $1, "updatedAt" = NOW() WHERE "challengeOrderId" = $2',
      ["PAID", order.id]
    );
    await input.db.query(
      `
        INSERT INTO "AuditLog" ("id", "actorUserId", "targetType", "targetId", "action", "summary", "metadata", "createdAt")
        VALUES ($1, $2, 'CHALLENGE_ORDER', $3, 'CHECKOUT_COMPLETED', $4, $5::jsonb, NOW())
      `,
      [
        randomUUID(),
        input.actorUserId,
        order.id,
        "Checkout completed and order marked paid.",
        JSON.stringify({
          challengePlanId: order.challengePlanId,
          accountSize: order.accountSize,
          phaseCount: order.phaseCount
        })
      ]
    );

    try {
      await sendOrderReceivedEmail({
        to: order.email,
        fullName: order.fullName,
        invoiceReference: order.invoiceReference,
        amountCents: order.invoiceAmountCents,
        planName: order.planName,
        billingUrl: `${getWebEnv().appUrl}/dashboard/billing`
      });
    } catch (error) {
      console.error("order-received-email-failed", { orderId: order.id, error });
    }
  }

  const provisioned = await provisionTradingAccountForOrder({
    db: input.db,
    userId: order.userId,
    orderId: order.id,
    accountSize: order.accountSize,
    profitTargetPct: order.profitTargetPct,
    dailyDrawdownPct: order.dailyDrawdownPct,
    maxDrawdownPct: order.maxDrawdownPct,
    actorUserId: input.actorUserId
  });

  if (provisioned.accountId) {
    await syncTradingAccountFromDemo(provisioned.accountId);
  }

  if (provisioned.wasCreated && provisioned.accountId && provisioned.login && provisioned.tradingPassword && provisioned.platform && provisioned.connection) {
    try {
      await sendTradingCredentialsEmail({
        to: order.email,
        fullName: order.fullName,
        login: provisioned.login,
        password: provisioned.tradingPassword,
        platform: provisioned.platform,
        connection: provisioned.connection,
        billingUrl: `${getWebEnv().appUrl}/dashboard/account?provisioned=1`
      });
    } catch (error) {
      console.error("trading-credentials-email-failed", { orderId: order.id, error });
    }
  }

  return order;
}

export async function startChallengeCheckoutAction(formData?: FormData) {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  const db = getDb();
  const env = getWebEnv();
  const stripe = getStripeClient();

  const planSlug = formData?.get("planSlug")?.toString() || "starter-50k";
  const coupon = getCheckoutDiscountPct(formData?.get("couponCode") ?? null);

  const planResult = await db.query<{ id: string; slug: string; name: string; accountSize: number; priceCents: number }>(
    'SELECT "id", "slug", "name", "accountSize", "priceCents" FROM "ChallengePlan" WHERE "slug" = $1 LIMIT 1',
    [planSlug]
  );

  const plan = planResult.rows[0] ?? await ensureFallbackChallengePlan(db, planSlug);

  if (!plan) {
    redirect("/dashboard/billing?error=missing-plan");
  }

  if ((coupon.code && !coupon.discountPct)) {
    redirect(`/checkout?planSlug=${encodeURIComponent(planSlug)}&error=invalid-coupon`);
  }

  const purchaseCapacity = await getCheckoutPurchaseCapacity(db, session.userId);

  if (purchaseCapacity.activeAccountCount >= purchaseCapacity.maxActiveAccounts) {
    redirect(`/checkout?planSlug=${encodeURIComponent(planSlug)}&error=account-limit`);
  }

  if (plan.accountSize === 600000 && purchaseCapacity.activeApexAccountCount >= purchaseCapacity.maxActiveApexAccounts) {
    redirect(`/checkout?planSlug=${encodeURIComponent(planSlug)}&error=apex-limit`);
  }

  const basePriceCents = getChallengePlanBasePriceCents(planSlug, plan.priceCents);
  const totalDiscountPct = MARKETING_SALE_DISCOUNT_PCT + coupon.discountPct;
  const finalPriceCents = Math.max(0, Math.round(basePriceCents * (1 - totalDiscountPct / 100)));
  const existingOpenOrder = await db.query<{
    id: string;
    challengePlanId: string;
    stripeSessionId: string | null;
    invoiceAmountCents: number;
  }>(
    `
      SELECT co."id", co."challengePlanId", co."stripeSessionId", i."amountCents" AS "invoiceAmountCents"
      FROM "ChallengeOrder" co
      JOIN "Invoice" i ON i."challengeOrderId" = co."id"
      WHERE co."userId" = $1 AND co."status" = $2
      ORDER BY co."createdAt" DESC
      LIMIT 1
    `,
    [session.userId, "OPEN"]
  );
  const existingOpen = existingOpenOrder.rows[0];

  if (existingOpen) {
    const orderNeedsRefresh =
      existingOpen.challengePlanId !== plan.id || existingOpen.invoiceAmountCents !== finalPriceCents;

    if (orderNeedsRefresh) {
      await db.query(
        'UPDATE "ChallengeOrder" SET "challengePlanId" = $1, "stripeSessionId" = $2, "updatedAt" = NOW() WHERE "id" = $3',
        [plan.id, env.hasRealStripe ? null : `mock-session-${existingOpen.id}`, existingOpen.id]
      );
      await db.query(
        'UPDATE "Invoice" SET "amountCents" = $1, "status" = $2, "updatedAt" = NOW() WHERE "challengeOrderId" = $3',
        [finalPriceCents, "OPEN", existingOpen.id]
      );
      existingOpen.stripeSessionId = env.hasRealStripe ? null : `mock-session-${existingOpen.id}`;
    }

    if (env.hasRealStripe && stripe) {
      const existingStripe = await db.query<{
        stripeSessionId: string | null;
        planId: string;
        slug: string;
        name: string;
        accountSize: number;
        priceCents: number;
      }>(
        `
          SELECT co."stripeSessionId", cp."id" AS "planId", cp."slug", cp."name", cp."accountSize", i."amountCents" AS "priceCents"
          FROM "ChallengeOrder" co
          JOIN "ChallengePlan" cp ON cp."id" = co."challengePlanId"
          JOIN "Invoice" i ON i."challengeOrderId" = co."id"
          WHERE co."id" = $1
          LIMIT 1
        `,
        [existingOpen.id]
      );
      const existingOrder = existingStripe.rows[0];
      const stripeSessionId = existingOpen.stripeSessionId ?? existingOrder?.stripeSessionId;

      if (stripeSessionId && !stripeSessionId.startsWith("mock-session-")) {
        try {
          const stripeSession = await stripe.checkout.sessions.retrieve(stripeSessionId);

          if (stripeSession.payment_status === "paid") {
            await finalizePaidOrder({
              db,
              orderId: existingOpen.id,
              actorUserId: session.userId
            });

            redirect("/dashboard/account?provisioned=1");
          }

          if (!orderNeedsRefresh && stripeSession.status === "open" && stripeSession.url) {
            redirect(stripeSession.url);
          }
        } catch (error) {
          console.error("stripe-session-reuse-error", { orderId: existingOpen.id, stripeSessionId, error });
        }
      }

      if (existingOrder) {
        const stripeSession = await createStripeCheckoutSession({
          orderId: existingOpen.id,
          planId: existingOrder.planId,
          planSlug: existingOrder.slug,
          planName: existingOrder.name,
          accountSize: existingOrder.accountSize,
          priceCents: existingOrder.priceCents,
          userId: session.userId,
          email: session.email
        });

        if (stripeSession?.id && stripeSession.url) {
          await db.query('UPDATE "ChallengeOrder" SET "stripeSessionId" = $1, "updatedAt" = NOW() WHERE "id" = $2', [stripeSession.id, existingOpen.id]);
          redirect(stripeSession.url);
        }
      }

      redirect("/checkout?error=stripe-session");
    }

    await finalizePaidOrder({
      db,
      orderId: existingOpen.id,
      actorUserId: session.userId
    });

    redirect("/dashboard/account?provisioned=1");
  }

  const orderId = randomUUID();
  const invoiceId = randomUUID();
  const invoiceReference = `INV-${orderId.slice(0, 8).toUpperCase()}`;

  await db.query(
    `
      INSERT INTO "ChallengeOrder" ("id", "userId", "challengePlanId", "stripeSessionId", "status", "createdAt", "updatedAt")
      VALUES ($1, $2, $3, $4, 'OPEN', NOW(), NOW());
    `,
    [orderId, session.userId, plan.id, env.hasRealStripe ? null : `mock-session-${orderId}`]
  );

  await db.query(
    `
      INSERT INTO "Invoice" ("id", "userId", "challengeOrderId", "reference", "amountCents", "status", "createdAt", "updatedAt")
      VALUES ($1, $2, $3, $4, $5, 'OPEN', NOW(), NOW());
    `,
    [invoiceId, session.userId, orderId, invoiceReference, finalPriceCents]
  );

  await db.query(
    `
      INSERT INTO "AuditLog" ("id", "actorUserId", "targetType", "targetId", "action", "summary", "metadata", "createdAt")
      VALUES ($1, $2, 'CHALLENGE_ORDER', $3, 'CHECKOUT_STARTED', $4, $5::jsonb, NOW())
    `,
    [
      randomUUID(),
      session.userId,
      orderId,
      `Checkout started for ${plan.name}.`,
      JSON.stringify({
        challengePlanId: plan.id,
        challengePlanName: plan.name,
        invoiceId,
        invoiceReference,
        amountCents: finalPriceCents,
        couponCode: coupon.code || null,
        discountPct: coupon.discountPct || 0
      })
    ]
  );

  if (env.hasRealStripe && stripe) {
    const stripeSession = await createStripeCheckoutSession({
      orderId,
      planId: plan.id,
      planSlug,
      planName: plan.name,
      accountSize: plan.accountSize,
      priceCents: finalPriceCents,
      userId: session.userId,
      email: session.email
    });

    if (!stripeSession?.id || !stripeSession.url) {
      redirect("/checkout?error=stripe-session");
    }

    await db.query('UPDATE "ChallengeOrder" SET "stripeSessionId" = $1, "updatedAt" = NOW() WHERE "id" = $2', [stripeSession.id, orderId]);

    redirect(stripeSession.url);
  }

  await finalizePaidOrder({
    db,
    orderId,
    actorUserId: session.userId
  });

  redirect("/dashboard/account?provisioned=1");
}

export async function completeMockCheckoutAction(formData: FormData) {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  const orderId = formData.get("orderId")?.toString();

  if (!orderId) {
    redirect("/dashboard/billing?error=missing-order");
  }

  const db = getDb();
  const orderResult = await db.query<{ id: string; userId: string }>(
    'SELECT "id", "userId" FROM "ChallengeOrder" WHERE "id" = $1 AND "userId" = $2 LIMIT 1',
    [orderId, session.userId]
  );
  const order = orderResult.rows[0];

  if (!order) {
    redirect("/dashboard/billing?error=missing-order");
  }

  await finalizePaidOrder({
    db,
    orderId: order.id,
    actorUserId: session.userId
  });

  redirect("/dashboard/account?provisioned=1");
}

export async function submitPayoutRequestAction(formData: FormData) {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  const parsed = payoutRequestSchema.safeParse({
    tradingAccountId: formData.get("tradingAccountId"),
    amountDollars: formData.get("amountDollars"),
    note: formData.get("note") || undefined
  });

  if (!parsed.success) {
    redirect("/dashboard/payouts?error=invalid-request");
  }

  const db = getDb();
  const accountResult = await db.query<{
    id: string;
    login: string;
    accountState: string;
    currentBalance: string;
    startingBalance: string;
    currentEquity: string;
    dailyLossLimit: string;
    totalLossLimit: string;
    profitTarget: string;
    tradingDays: number;
  }>(
    `
      SELECT "id", "login", "accountState", "currentBalance", "startingBalance", "currentEquity", "dailyLossLimit", "totalLossLimit", "profitTarget", "tradingDays"
      FROM "TradingAccount"
      WHERE "userId" = $1 AND "id" = $2
      LIMIT 1
    `,
    [session.userId, parsed.data.tradingAccountId]
  );

  const account = accountResult.rows[0];

  if (!account || account.accountState !== "FUNDED") {
    redirect("/dashboard/payouts?error=not-funded");
  }

  const snapshot = getChallengeSnapshot({
    startingBalance: Number(account.startingBalance),
    currentBalance: Number(account.currentBalance),
    currentEquity: Number(account.currentEquity),
    profitTarget: Number(account.profitTarget),
    dailyLossLimit: Number(account.dailyLossLimit),
    totalLossLimit: Number(account.totalLossLimit),
    tradingDays: account.tradingDays,
    minTradingDays: 3,
    accountState: account.accountState
  });
  const holdAssessment = getPayoutHoldAssessment({
    accountState: account.accountState,
    currentProfit: snapshot.currentProfit,
    dailyLossRemaining: snapshot.dailyLossRemaining,
    dailyLossLimit: Number(account.dailyLossLimit),
    totalLossRemaining: snapshot.totalLossRemaining,
    totalLossLimit: Number(account.totalLossLimit),
    tradingDaysRemaining: snapshot.tradingDaysRemaining,
    ruleStatus: snapshot.ruleStatus
  });

  if (!holdAssessment.eligible) {
    redirect("/dashboard/payouts?error=hold-active");
  }

  const availableProfitCents = Math.max(
    0,
    Math.floor((Number(account.currentBalance) - Number(account.startingBalance)) * 100)
  );
  const requestedCents = Math.round(parsed.data.amountDollars * 100);

  if (requestedCents <= 0 || requestedCents > availableProfitCents) {
    redirect("/dashboard/payouts?error=amount-range");
  }

  const openRequest = await db.query<{ id: string }>(
    `
      SELECT "id"
      FROM "PayoutRequest"
      WHERE "tradingAccountId" = $1
        AND "status" IN ('PENDING', 'REVIEW', 'APPROVED')
      ORDER BY "createdAt" DESC
      LIMIT 1
    `,
    [account.id]
  );

  if (openRequest.rowCount) {
    redirect("/dashboard/payouts?error=existing-request");
  }

  const payoutId = randomUUID();
  const note = parsed.data.note?.trim();

  await db.query(
    `
      INSERT INTO "PayoutRequest" ("id", "userId", "tradingAccountId", "amountCents", "status", "note", "createdAt", "updatedAt")
      VALUES ($1, $2, $3, $4, 'PENDING', $5, NOW(), NOW())
    `,
    [payoutId, session.userId, account.id, requestedCents, note ?? null]
  );

  await db.query(
    `
      INSERT INTO "AuditLog" ("id", "actorUserId", "targetType", "targetId", "action", "summary", "metadata", "createdAt")
      VALUES ($1, $2, 'PAYOUT_REQUEST', $3, 'PAYOUT_REQUEST_CREATED', $4, $5::jsonb, NOW())
    `,
    [
      randomUUID(),
      session.userId,
      payoutId,
      `Payout request submitted for ${account.login} at $${parsed.data.amountDollars.toFixed(2)}`,
      JSON.stringify({
        login: account.login,
        amountCents: requestedCents,
        note: note ?? null
      })
    ]
  );

  redirect("/dashboard/payouts?submitted=1");
}
