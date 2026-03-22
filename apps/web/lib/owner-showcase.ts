import { getDb } from "@fundedpro/db";
import { ensureDemoTradingWorkspaceForTradingAccount } from "./demo-trading/bootstrap";

const OWNER_SHOWCASE_EMAILS = new Set([
  "20townshendh@gmail.com",
  "25townshendh@gmail.com"
]);

const SHOWCASE_PLAN = {
  id: "plan_showcase_owner",
  slug: "showcase-owner-100k",
  name: "Owner Showcase",
  challengeType: "ONE_STEP",
  accountSize: 100000,
  priceCents: 0,
  phaseCount: 1,
  profitTargetPct: "8.00",
  dailyDrawdownPct: "3.00",
  maxDrawdownPct: "6.00",
  minTradingDays: 3,
  payoutSplitPct: "90.00"
} as const;

export async function ensureOwnerShowcaseWorkspace(userId: string, email: string) {
  if (!OWNER_SHOWCASE_EMAILS.has(email.toLowerCase())) {
    return;
  }

  const db = getDb();

  const challengePlanResult = await db.query<{ id: string }>(
    `
      INSERT INTO "ChallengePlan" (
        "id", "slug", "name", "challengeType", "accountSize", "priceCents", "phaseCount",
        "profitTargetPct", "dailyDrawdownPct", "maxDrawdownPct", "minTradingDays", "payoutSplitPct",
        "resetEnabled", "createdAt", "updatedAt"
      )
      VALUES ($1, $2, $3, $4::"ChallengeType", $5, $6, $7, $8::numeric, $9::numeric, $10::numeric, $11, $12::numeric, TRUE, NOW(), NOW())
      ON CONFLICT ("slug")
      DO UPDATE SET
        "name" = EXCLUDED."name",
        "accountSize" = EXCLUDED."accountSize",
        "updatedAt" = NOW()
      RETURNING "id"
    `,
    [
      SHOWCASE_PLAN.id,
      SHOWCASE_PLAN.slug,
      SHOWCASE_PLAN.name,
      SHOWCASE_PLAN.challengeType,
      SHOWCASE_PLAN.accountSize,
      SHOWCASE_PLAN.priceCents,
      SHOWCASE_PLAN.phaseCount,
      SHOWCASE_PLAN.profitTargetPct,
      SHOWCASE_PLAN.dailyDrawdownPct,
      SHOWCASE_PLAN.maxDrawdownPct,
      SHOWCASE_PLAN.minTradingDays,
      SHOWCASE_PLAN.payoutSplitPct
    ]
  );
  const challengePlanId = challengePlanResult.rows[0]?.id ?? SHOWCASE_PLAN.id;

  const orderId = `owner-showcase-order-${userId}`;
  const invoiceId = `owner-showcase-invoice-${userId}`;
  const tradingAccountId = `owner-showcase-trading-${userId}`;
  const invoiceReference = `INV-SHOW-${userId.slice(-6).toUpperCase()}`;

  await db.query(
    `
      INSERT INTO "ChallengeOrder" ("id", "userId", "challengePlanId", "stripeSessionId", "status", "createdAt", "updatedAt")
      VALUES ($1, $2, $3, $4, 'PAID', NOW(), NOW())
      ON CONFLICT ("id")
      DO UPDATE SET "challengePlanId" = EXCLUDED."challengePlanId", "status" = 'PAID', "updatedAt" = NOW()
    `,
    [orderId, userId, challengePlanId, `owner-showcase-session-${userId}`]
  );

  await db.query(
    `
      INSERT INTO "Invoice" ("id", "userId", "challengeOrderId", "reference", "amountCents", "status", "createdAt", "updatedAt")
      VALUES ($1, $2, $3, $4, 0, 'PAID', NOW(), NOW())
      ON CONFLICT ("challengeOrderId")
      DO UPDATE SET "reference" = EXCLUDED."reference", "status" = 'PAID', "updatedAt" = NOW()
    `,
    [invoiceId, userId, orderId, invoiceReference]
  );

  await db.query(
    `
      INSERT INTO "TradingAccount" (
        "id", "userId", "challengeOrderId", "login", "platform", "connection", "provider", "accountState", "currentPhase", "startingBalance",
        "phaseStartBalance", "currentBalance", "currentEquity", "dailyLossLimit", "totalLossLimit", "profitTarget",
        "tradingDays", "phaseStartedAt", "lastEvaluatedAt", "createdAt", "updatedAt"
      )
      VALUES (
        $1, $2, $3, 'FP860251', 'Phynic', 'Phynic', 'phynic', 'EVALUATION', 1, 100000.00,
        100000.00, 100000.00, 100000.00, 3000.00, 6000.00, 8000.00,
        0, NOW(), NOW(), NOW(), NOW()
      )
      ON CONFLICT ("challengeOrderId")
      DO UPDATE SET
        "platform" = EXCLUDED."platform",
        "connection" = EXCLUDED."connection",
        "provider" = EXCLUDED."provider",
        "accountState" = EXCLUDED."accountState",
        "currentPhase" = EXCLUDED."currentPhase",
        "startingBalance" = EXCLUDED."startingBalance",
        "phaseStartBalance" = EXCLUDED."phaseStartBalance",
        "currentBalance" = EXCLUDED."currentBalance",
        "currentEquity" = EXCLUDED."currentEquity",
        "dailyLossLimit" = EXCLUDED."dailyLossLimit",
        "totalLossLimit" = EXCLUDED."totalLossLimit",
        "profitTarget" = EXCLUDED."profitTarget",
        "updatedAt" = NOW()
    `,
    [tradingAccountId, userId, orderId]
  );

  await ensureDemoTradingWorkspaceForTradingAccount({
    userId,
    tradingAccountId,
    accountName: "FP860251",
    startingBalance: 100000
  });
}
