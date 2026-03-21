import { randomUUID } from "node:crypto";
import { getDb } from "@fundedpro/db";
import { getWebEnv } from "./env";
import { sendChallengeCertificateEmail, sendPayoutCertificateEmail } from "./email/service";

export async function sendChallengeCertificateEmailIfNeeded(input: {
  tradingAccountId: string;
  actorUserId?: string;
}) {
  const db = getDb();
  const result = await db.query<{
    id: string;
    userId: string;
    email: string;
    fullName: string;
    login: string;
    accountState: "PASSED" | "FUNDED" | string;
  }>(
    `
      SELECT ta."id", ta."userId", u."email", u."fullName", ta."login", ta."accountState"
      FROM "TradingAccount" ta
      JOIN "User" u ON u."id" = ta."userId"
      WHERE ta."id" = $1
      LIMIT 1
    `,
    [input.tradingAccountId]
  );

  const account = result.rows[0];

  if (!account || !["PASSED", "FUNDED"].includes(account.accountState)) {
    return false;
  }

  const accountState = account.accountState as "PASSED" | "FUNDED";
  const action = account.accountState === "FUNDED" ? "FUNDED_CERTIFICATE_EMAIL_SENT" : "PASSED_CERTIFICATE_EMAIL_SENT";
  const existing = await db.query<{ id: string }>(
    'SELECT "id" FROM "AuditLog" WHERE "targetType" = $1 AND "targetId" = $2 AND "action" = $3 LIMIT 1',
    ["TRADING_ACCOUNT", account.id, action]
  );

  if (existing.rowCount) {
    return false;
  }

  const certificateUrl = `${getWebEnv().appUrl}/dashboard/account/certificate?accountId=${encodeURIComponent(account.id)}`;

  await sendChallengeCertificateEmail({
    to: account.email,
    fullName: account.fullName,
    login: account.login,
    accountState,
    certificateUrl
  });

  await db.query(
    `
      INSERT INTO "AuditLog" ("id", "actorUserId", "targetType", "targetId", "action", "summary", "metadata", "createdAt")
      VALUES ($1, $2, 'TRADING_ACCOUNT', $3, $4, $5, $6::jsonb, NOW())
    `,
    [
      randomUUID(),
      input.actorUserId ?? account.userId,
      account.id,
      action,
      `${account.accountState} certificate email sent for ${account.login}.`,
      JSON.stringify({
        login: account.login,
        email: account.email,
        certificateUrl
      })
    ]
  );

  return true;
}

export async function sendPayoutCertificateEmailIfNeeded(input: {
  payoutRequestId: string;
  actorUserId?: string;
}) {
  const db = getDb();
  const result = await db.query<{
    id: string;
    userId: string;
    email: string;
    fullName: string;
    login: string;
    amountCents: number;
    status: "APPROVED" | "PAID" | string;
  }>(
    `
      SELECT pr."id", pr."userId", u."email", u."fullName", ta."login", pr."amountCents", pr."status"
      FROM "PayoutRequest" pr
      JOIN "User" u ON u."id" = pr."userId"
      JOIN "TradingAccount" ta ON ta."id" = pr."tradingAccountId"
      WHERE pr."id" = $1
      LIMIT 1
    `,
    [input.payoutRequestId]
  );

  const payout = result.rows[0];

  if (!payout || !["APPROVED", "PAID"].includes(payout.status)) {
    return false;
  }

  const payoutStatus = payout.status as "APPROVED" | "PAID";
  const existing = await db.query<{ id: string }>(
    'SELECT "id" FROM "AuditLog" WHERE "targetType" = $1 AND "targetId" = $2 AND "action" = $3 LIMIT 1',
    ["PAYOUT_REQUEST", payout.id, "PAYOUT_CERTIFICATE_EMAIL_SENT"]
  );

  if (existing.rowCount) {
    return false;
  }

  const certificateUrl = `${getWebEnv().appUrl}/dashboard/payouts/certificate?payoutId=${encodeURIComponent(payout.id)}`;

  await sendPayoutCertificateEmail({
    to: payout.email,
    fullName: payout.fullName,
    login: payout.login,
    amountCents: payout.amountCents,
    payoutStatus,
    certificateUrl
  });

  await db.query(
    `
      INSERT INTO "AuditLog" ("id", "actorUserId", "targetType", "targetId", "action", "summary", "metadata", "createdAt")
      VALUES ($1, $2, 'PAYOUT_REQUEST', $3, 'PAYOUT_CERTIFICATE_EMAIL_SENT', $4, $5::jsonb, NOW())
    `,
    [
      randomUUID(),
      input.actorUserId ?? payout.userId,
      payout.id,
      `Payout certificate email sent for ${payout.login}.`,
      JSON.stringify({
        login: payout.login,
        email: payout.email,
        amountCents: payout.amountCents,
        certificateUrl
      })
    ]
  );

  return true;
}
