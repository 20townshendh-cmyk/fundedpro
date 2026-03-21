import { randomUUID } from "node:crypto";
import { getDb } from "@fundedpro/db";
import { getWebEnv } from "./env";
import { sendAccountBreachedEmail } from "./email/service";

export async function sendAccountBreachedEmailIfNeeded(input: {
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
    accountState: string;
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

  if (!account || account.accountState !== "BREACHED") {
    return false;
  }

  const existing = await db.query<{ id: string }>(
    'SELECT "id" FROM "AuditLog" WHERE "targetType" = $1 AND "targetId" = $2 AND "action" = $3 LIMIT 1',
    ["TRADING_ACCOUNT", account.id, "ACCOUNT_BREACH_EMAIL_SENT"]
  );

  if (existing.rowCount) {
    return false;
  }

  const accountUrl = `${getWebEnv().appUrl}/dashboard/account?accountId=${encodeURIComponent(account.id)}`;

  await sendAccountBreachedEmail({
    to: account.email,
    fullName: account.fullName,
    login: account.login,
    accountUrl
  });

  await db.query(
    `
      INSERT INTO "AuditLog" ("id", "actorUserId", "targetType", "targetId", "action", "summary", "metadata", "createdAt")
      VALUES ($1, $2, 'TRADING_ACCOUNT', $3, 'ACCOUNT_BREACH_EMAIL_SENT', $4, $5::jsonb, NOW())
    `,
    [
      randomUUID(),
      input.actorUserId ?? account.userId,
      account.id,
      `Breach email sent for ${account.login}.`,
      JSON.stringify({
        login: account.login,
        email: account.email,
        accountUrl
      })
    ]
  );

  return true;
}
