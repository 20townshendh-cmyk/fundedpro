import { describe, expect, it } from "vitest";
import { evaluateChallengeLifecycle, getPayoutHoldAssessment } from "../../../packages/domain/src/challenge";
import { getPayoutSweepTransition } from "../lib/payout-sweep";

describe("challenge lifecycle evaluator", () => {
  it("breaches the account when drawdown room is exhausted", () => {
    const evaluation = evaluateChallengeLifecycle({
      accountState: "EVALUATION",
      phaseCount: 1,
      currentPhase: 1,
      startingBalance: 50000,
      phaseStartBalance: 50000,
      currentBalance: 49000,
      currentEquity: 47450,
      profitTarget: 3000,
      dailyLossLimit: 1500,
      totalLossLimit: 2500,
      tradingDays: 4,
      minTradingDays: 3
    });

    expect(evaluation.nextAccountState).toBe("BREACHED");
    expect(evaluation.transition).toBe("breached");
  });

  it("advances a two-step account into the next phase", () => {
    const evaluation = evaluateChallengeLifecycle({
      accountState: "EVALUATION",
      phaseCount: 2,
      currentPhase: 1,
      startingBalance: 100000,
      phaseStartBalance: 100000,
      currentBalance: 104500,
      currentEquity: 104200,
      profitTarget: 8000,
      dailyLossLimit: 3000,
      totalLossLimit: 6000,
      tradingDays: 4,
      minTradingDays: 3
    });

    expect(evaluation.nextAccountState).toBe("EVALUATION");
    expect(evaluation.nextPhase).toBe(2);
    expect(evaluation.nextPhaseStartBalance).toBe(104500);
    expect(evaluation.transition).toBe("phase-advanced");
  });

  it("moves a final phase account into review once targets are met", () => {
    const evaluation = evaluateChallengeLifecycle({
      accountState: "EVALUATION",
      phaseCount: 1,
      currentPhase: 1,
      startingBalance: 50000,
      phaseStartBalance: 50000,
      currentBalance: 53100,
      currentEquity: 52950,
      profitTarget: 3000,
      dailyLossLimit: 1500,
      totalLossLimit: 2500,
      tradingDays: 3,
      minTradingDays: 3
    });

    expect(evaluation.nextAccountState).toBe("REVIEW");
    expect(evaluation.transition).toBe("review-queued");
  });

  it("does not queue review before minimum trading days are met", () => {
    const evaluation = evaluateChallengeLifecycle({
      accountState: "EVALUATION",
      phaseCount: 1,
      currentPhase: 1,
      startingBalance: 50000,
      phaseStartBalance: 50000,
      currentBalance: 53100,
      currentEquity: 53000,
      profitTarget: 3000,
      dailyLossLimit: 1500,
      totalLossLimit: 2500,
      tradingDays: 2,
      minTradingDays: 3
    });

    expect(evaluation.nextAccountState).toBe("EVALUATION");
    expect(evaluation.transition).toBe("none");
  });

  it("promotes review accounts to passed, then funded on the next evaluation", () => {
    const passed = evaluateChallengeLifecycle({
      accountState: "REVIEW",
      phaseCount: 1,
      currentPhase: 1,
      startingBalance: 50000,
      phaseStartBalance: 50000,
      currentBalance: 53100,
      currentEquity: 53040,
      profitTarget: 3000,
      dailyLossLimit: 1500,
      totalLossLimit: 2500,
      tradingDays: 3,
      minTradingDays: 3
    });

    const funded = evaluateChallengeLifecycle({
      accountState: "PASSED",
      phaseCount: 1,
      currentPhase: 1,
      startingBalance: 50000,
      phaseStartBalance: 50000,
      currentBalance: 53100,
      currentEquity: 53040,
      profitTarget: 3000,
      dailyLossLimit: 1500,
      totalLossLimit: 2500,
      tradingDays: 3,
      minTradingDays: 3
    });

    expect(passed.nextAccountState).toBe("PASSED");
    expect(passed.transition).toBe("passed");
    expect(funded.nextAccountState).toBe("FUNDED");
    expect(funded.transition).toBe("funded");
  });

  it("keeps payout requests blocked when a funded account is under active risk pressure", () => {
    const hold = getPayoutHoldAssessment({
      accountState: "FUNDED",
      currentProfit: 1200,
      dailyLossRemaining: 200,
      dailyLossLimit: 1500,
      totalLossRemaining: 900,
      totalLossLimit: 2500,
      tradingDaysRemaining: 0,
      ruleStatus: "stable"
    });

    expect(hold.eligible).toBe(false);
    expect(hold.severity).toBe("warning");
    expect(hold.reasons).toContain("Daily loss buffer is inside the final 15% of available room.");
  });

  it("allows payout requests for a clean funded account", () => {
    const hold = getPayoutHoldAssessment({
      accountState: "FUNDED",
      currentProfit: 2200,
      dailyLossRemaining: 1300,
      dailyLossLimit: 1500,
      totalLossRemaining: 2200,
      totalLossLimit: 2500,
      tradingDaysRemaining: 0,
      ruleStatus: "stable"
    });

    expect(hold.eligible).toBe(true);
    expect(hold.severity).toBe("none");
    expect(hold.reasons).toEqual([]);
  });

  it("moves non-review payout requests into review when a hold is active", () => {
    const transition = getPayoutSweepTransition({
      status: "PENDING",
      eligible: false,
      primaryReason: "Daily loss buffer is inside the final 15% of available room."
    });

    expect(transition).toEqual({
      nextStatus: "REVIEW",
      note: "AUTO_HOLD: Daily loss buffer is inside the final 15% of available room."
    });
  });

  it("escalates approved payout requests back into review when a critical hold is active", () => {
    const transition = getPayoutSweepTransition({
      status: "APPROVED",
      eligible: false,
      severity: "critical",
      primaryReason: "Account does not have positive realized profit."
    });

    expect(transition).toEqual({
      nextStatus: "REVIEW",
      note: "AUTO_ESCALATED_HOLD: Account does not have positive realized profit."
    });
  });

  it("leaves already-reviewed payout requests unchanged during hold sweeps", () => {
    const transition = getPayoutSweepTransition({
      status: "REVIEW",
      eligible: false,
      primaryReason: "Account is not funded."
    });

    expect(transition).toBeNull();
  });
});
