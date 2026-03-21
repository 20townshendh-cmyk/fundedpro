import { randomUUID } from "node:crypto";
import { getChallengeSnapshot, getPayoutHoldAssessment } from "@fundedpro/domain";
import { getDb } from "@fundedpro/db";

type SweepOptions = {
  actorUserId?: string;
};

export function getPayoutSweepTransition(input: {
  status: string;
  eligible: boolean;
  severity?: "none" | "warning" | "critical";
  primaryReason?: string;
}) {
  if (!input.eligible && input.status !== "REVIEW") {
    const prefix = input.status === "APPROVED" || input.severity === "critical" ? "AUTO_ESCALATED_HOLD" : "AUTO_HOLD";

    return {
      nextStatus: "REVIEW",
      note: `${prefix}: ${input.primaryReason ?? "Payout hold triggered."}`
    };
  }

  return null;
}

export async function sweepPayoutRequests(options: SweepOptions = {}) {
  const db = getDb();
  const result = await db.query<{
    id: string;
    status: string;
    note: string | null;
    login: string;
    userId: string;
    amountCents: number;
    accountState: string;
    startingBalance: string;
    currentBalance: string;
    currentEquity: string;
    dailyLossLimit: string;
    totalLossLimit: string;
    profitTarget: string;
    tradingDays: number;
    minTradingDays: number | null;
  }>(
    `
      SELECT
        pr."id",
        pr."status",
        pr."note",
        ta."login",
        pr."userId",
        pr."amountCents",
        ta."accountState",
        ta."startingBalance",
        ta."currentBalance",
        ta."currentEquity",
        ta."dailyLossLimit",
        ta."totalLossLimit",
        ta."profitTarget",
        ta."tradingDays",
        cp."minTradingDays"
      FROM "PayoutRequest" pr
      JOIN "TradingAccount" ta ON ta."id" = pr."tradingAccountId"
      LEFT JOIN "ChallengeOrder" co ON co."userId" = ta."userId"
      LEFT JOIN "ChallengePlan" cp ON cp."id" = co."challengePlanId"
      WHERE pr."status" IN ('PENDING', 'REVIEW', 'APPROVED')
      ORDER BY pr."createdAt" DESC, co."createdAt" DESC
    `
  );

  const updates = [];

  for (const payout of result.rows) {
    const snapshot = getChallengeSnapshot({
      startingBalance: Number(payout.startingBalance),
      currentBalance: Number(payout.currentBalance),
      currentEquity: Number(payout.currentEquity),
      profitTarget: Number(payout.profitTarget),
      dailyLossLimit: Number(payout.dailyLossLimit),
      totalLossLimit: Number(payout.totalLossLimit),
      tradingDays: payout.tradingDays,
      minTradingDays: payout.minTradingDays ?? 3,
      accountState: payout.accountState
    });
    const hold = getPayoutHoldAssessment({
      accountState: payout.accountState,
      currentProfit: snapshot.currentProfit,
      dailyLossRemaining: snapshot.dailyLossRemaining,
      dailyLossLimit: Number(payout.dailyLossLimit),
      totalLossRemaining: snapshot.totalLossRemaining,
      totalLossLimit: Number(payout.totalLossLimit),
      tradingDaysRemaining: snapshot.tradingDaysRemaining,
      ruleStatus: snapshot.ruleStatus
    });

    const transition = getPayoutSweepTransition(
      hold.reasons[0]
        ? {
            status: payout.status,
            eligible: hold.eligible,
            severity: hold.severity,
            primaryReason: hold.reasons[0]
          }
        : {
            status: payout.status,
            eligible: hold.eligible,
            severity: hold.severity
          }
    );

    if (transition) {
      await db.query(
        `
          UPDATE "PayoutRequest"
          SET "status" = 'REVIEW', "note" = $1, "updatedAt" = NOW()
          WHERE "id" = $2
        `,
        [transition.note, payout.id]
      );

      if (options.actorUserId) {
        await db.query(
          `
            INSERT INTO "AuditLog" ("id", "actorUserId", "targetType", "targetId", "action", "summary", "metadata", "createdAt")
            VALUES ($1, $2, 'PAYOUT_REQUEST', $3, 'PAYOUT_AUTO_HOLD', $4, $5::jsonb, NOW())
          `,
          [
            randomUUID(),
            options.actorUserId,
            payout.id,
            `Payout request for ${payout.login} moved to REVIEW by worker hold sweep.`,
            JSON.stringify({
              login: payout.login,
              previousStatus: payout.status,
              nextStatus: "REVIEW",
              severity: hold.severity,
              amountCents: payout.amountCents,
              reason: hold.reasons[0]
            })
          ]
        );
      }

      updates.push({
        payoutRequestId: payout.id,
        login: payout.login,
        previousStatus: payout.status,
        nextStatus: "REVIEW",
        severity: hold.severity
      });
    }
  }

  return updates;
}
