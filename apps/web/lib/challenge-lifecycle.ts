"use server";

import { evaluateChallengeLifecycle } from "@fundedpro/domain";
import { getDb } from "@fundedpro/db";
import { sendAccountBreachedEmailIfNeeded } from "./account-breach-email";
import { sendChallengeCertificateEmailIfNeeded } from "./certificate-email";

type TradingAccountLifecycleRow = {
  id: string;
  userId: string;
  login: string;
  accountState: string;
  currentPhase: number;
  startingBalance: string;
  phaseStartBalance: string;
  currentBalance: string;
  currentEquity: string;
  dailyLossLimit: string;
  totalLossLimit: string;
  profitTarget: string;
  tradingDays: number;
  phaseStartedAt: Date;
  reviewQueuedAt: Date | null;
  passedAt: Date | null;
  fundedAt: Date | null;
  breachedAt: Date | null;
};

type ChallengePlanRow = {
  challengeType: string;
  phaseCount: number;
  minTradingDays: number;
};

export async function evaluateAndPersistTradingAccountLifecycle(tradingAccountId: string) {
  const db = getDb();
  const accountResult = await db.query<TradingAccountLifecycleRow>(
    `
      SELECT
        "id", "userId", "login", "accountState", "currentPhase", "startingBalance", "phaseStartBalance",
        "currentBalance", "currentEquity", "dailyLossLimit", "totalLossLimit", "profitTarget",
        "tradingDays", "phaseStartedAt", "reviewQueuedAt", "passedAt", "fundedAt", "breachedAt"
      FROM "TradingAccount"
      WHERE "id" = $1
      LIMIT 1
    `,
    [tradingAccountId]
  );
  const account = accountResult.rows[0];

  if (!account) {
    return null;
  }

  const planResult = await db.query<ChallengePlanRow>(
    `
      SELECT cp."challengeType", cp."phaseCount", cp."minTradingDays"
      FROM "ChallengeOrder" co
      JOIN "ChallengePlan" cp ON cp."id" = co."challengePlanId"
      WHERE co."userId" = $1
      ORDER BY co."createdAt" DESC
      LIMIT 1
    `,
    [account.userId]
  );
  const plan = planResult.rows[0];

  const evaluation = evaluateChallengeLifecycle({
    challengeType: plan?.challengeType,
    phaseCount: plan?.phaseCount ?? 1,
    currentPhase: account.currentPhase,
    accountState: account.accountState,
    startingBalance: Number(account.startingBalance),
    phaseStartBalance: Number(account.phaseStartBalance),
    currentBalance: Number(account.currentBalance),
    currentEquity: Number(account.currentEquity),
    dailyLossLimit: Number(account.dailyLossLimit),
    totalLossLimit: Number(account.totalLossLimit),
    profitTarget: Number(account.profitTarget),
    tradingDays: account.tradingDays,
    minTradingDays: plan?.minTradingDays ?? 3
  });

  const values = [
    evaluation.nextAccountState,
    evaluation.nextPhase,
    evaluation.nextPhaseStartBalance,
    evaluation.transition === "phase-advanced" ? new Date() : account.phaseStartedAt,
    evaluation.transition === "review-queued" && !account.reviewQueuedAt ? new Date() : account.reviewQueuedAt,
    evaluation.transition === "passed" && !account.passedAt ? new Date() : account.passedAt,
    evaluation.transition === "funded" && !account.fundedAt ? new Date() : account.fundedAt,
    evaluation.transition === "breached" && !account.breachedAt ? new Date() : account.breachedAt,
    new Date(),
    account.id
  ];

  await db.query(
    `
      UPDATE "TradingAccount"
      SET
        "accountState" = $1,
        "currentPhase" = $2,
        "phaseStartBalance" = $3,
        "phaseStartedAt" = $4,
        "reviewQueuedAt" = $5,
        "passedAt" = $6,
        "fundedAt" = $7,
        "breachedAt" = $8,
        "lastEvaluatedAt" = $9,
        "updatedAt" = NOW()
      WHERE "id" = $10
    `,
    values
  );

  if (evaluation.transition === "passed" || evaluation.transition === "funded") {
    try {
      await sendChallengeCertificateEmailIfNeeded({
        tradingAccountId: account.id,
        actorUserId: account.userId
      });
    } catch (error) {
      console.error("challenge-certificate-email-failed", { tradingAccountId: account.id, error });
    }
  }

  if (evaluation.transition === "breached" && !account.breachedAt) {
    try {
      await sendAccountBreachedEmailIfNeeded({
        tradingAccountId: account.id,
        actorUserId: account.userId
      });
    } catch (error) {
      console.error("account-breach-email-failed", { tradingAccountId: account.id, error });
    }
  }

  return evaluation;
}

export async function evaluateAllTradingAccountLifecycles(options: { limit?: number } = {}) {
  const db = getDb();
  const accountsResult = await db.query<{ id: string }>(
    `
      SELECT "id"
      FROM "TradingAccount"
      ORDER BY "updatedAt" DESC
      ${options.limit ? `LIMIT ${Math.max(1, Math.floor(options.limit))}` : ""}
    `
  );

  const results = [];

  for (const account of accountsResult.rows) {
    const evaluation = await evaluateAndPersistTradingAccountLifecycle(account.id);

    if (evaluation) {
      results.push({
        tradingAccountId: account.id,
        transition: evaluation.transition,
        nextAccountState: evaluation.nextAccountState,
        nextPhase: evaluation.nextPhase
      });
    }
  }

  return results;
}
