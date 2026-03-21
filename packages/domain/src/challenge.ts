type ChallengeSnapshotInput = {
  startingBalance: number;
  phaseStartBalance?: number | undefined;
  currentBalance: number;
  currentEquity: number;
  profitTarget: number;
  dailyLossLimit: number;
  totalLossLimit: number;
  tradingDays: number;
  minTradingDays?: number | undefined;
  accountState?: string | undefined;
  currentPhase?: number | undefined;
  phaseCount?: number | undefined;
};

export type ChallengeSnapshot = {
  currentProfit: number;
  phaseProfit: number;
  targetProgressPct: number;
  targetRemaining: number;
  phaseTarget: number;
  phaseProgressPct: number;
  phaseTargetRemaining: number;
  dailyDrawdownUsed: number;
  dailyLossRemaining: number;
  totalDrawdownUsed: number;
  totalLossRemaining: number;
  minTradingDays: number;
  tradingDaysRemaining: number;
  payoutEligible: boolean;
  phaseNumber: number;
  phaseCount: number;
  phaseLabel: string;
  ruleStatus: "stable" | "warning" | "breached";
  reviewStatus: "building" | "review" | "funded";
  riskFlags: string[];
};

export type PayoutHoldAssessment = {
  eligible: boolean;
  severity: "none" | "warning" | "critical";
  reasons: string[];
};

export type ChallengeLifecycleInput = {
  challengeType?: string | undefined;
  phaseCount?: number | undefined;
  currentPhase?: number | undefined;
  accountState?: string | undefined;
  startingBalance: number;
  phaseStartBalance?: number | undefined;
  currentBalance: number;
  currentEquity: number;
  profitTarget: number;
  dailyLossLimit: number;
  totalLossLimit: number;
  tradingDays: number;
  minTradingDays?: number | undefined;
};

export type ChallengeLifecycleEvaluation = {
  nextAccountState: string;
  nextPhase: number;
  nextPhaseStartBalance: number;
  transition:
    | "none"
    | "breached"
    | "phase-advanced"
    | "review-queued"
    | "passed"
    | "funded";
  snapshot: ChallengeSnapshot;
};

function clampPercent(value: number) {
  return Math.min(100, Math.max(0, value));
}

function getEffectivePhaseCount(input: { phaseCount?: number | undefined }) {
  return Math.max(1, input.phaseCount ?? 1);
}

function getEffectiveCurrentPhase(input: { currentPhase?: number | undefined; phaseCount?: number | undefined }) {
  return Math.min(Math.max(1, input.currentPhase ?? 1), getEffectivePhaseCount(input));
}

function getPhaseTarget(input: { profitTarget: number; phaseCount?: number | undefined }) {
  const phaseCount = getEffectivePhaseCount(input);
  return phaseCount > 1 ? input.profitTarget / phaseCount : input.profitTarget;
}

export function getChallengeSnapshot(input: ChallengeSnapshotInput): ChallengeSnapshot {
  const minTradingDays = input.minTradingDays ?? 3;
  const phaseCount = getEffectivePhaseCount(input);
  const phaseNumber = getEffectiveCurrentPhase(input);
  const phaseStartBalance = input.phaseStartBalance ?? input.startingBalance;
  const currentProfit = input.currentBalance - input.startingBalance;
  const phaseProfit = input.currentBalance - phaseStartBalance;
  const safeProfit = Math.max(0, currentProfit);
  const phaseTarget = getPhaseTarget({ profitTarget: input.profitTarget, phaseCount });
  const safePhaseProfit = Math.max(0, phaseProfit);
  const targetProgressPct = input.profitTarget > 0 ? clampPercent((safeProfit / input.profitTarget) * 100) : 0;
  const targetRemaining = Math.max(0, input.profitTarget - safeProfit);
  const phaseProgressPct = phaseTarget > 0 ? clampPercent((safePhaseProfit / phaseTarget) * 100) : 0;
  const phaseTargetRemaining = Math.max(0, phaseTarget - safePhaseProfit);
  const totalDrawdownUsed = Math.max(0, input.startingBalance - input.currentEquity);
  const dailyDrawdownUsed = Math.max(0, input.currentBalance - input.currentEquity);
  const dailyLossRemaining = Math.max(0, input.dailyLossLimit - dailyDrawdownUsed);
  const totalLossRemaining = Math.max(0, input.totalLossLimit - totalDrawdownUsed);
  const tradingDaysRemaining = Math.max(0, minTradingDays - input.tradingDays);
  const payoutEligible = input.accountState === "FUNDED" && tradingDaysRemaining === 0 && currentProfit > 0;
  const riskFlags: string[] = [];

  if (dailyLossRemaining <= input.dailyLossLimit * 0.2) {
    riskFlags.push("Daily loss buffer is inside the last 20% of available room.");
  }

  if (totalLossRemaining <= input.totalLossLimit * 0.2) {
    riskFlags.push("Overall drawdown buffer is inside the last 20% of available room.");
  }

  if (tradingDaysRemaining > 0) {
    riskFlags.push(`Minimum trading-day threshold still needs ${tradingDaysRemaining} more day${tradingDaysRemaining === 1 ? "" : "s"}.`);
  }

  let ruleStatus: ChallengeSnapshot["ruleStatus"] = "stable";

  if (dailyLossRemaining <= 0 || totalLossRemaining <= 0 || input.accountState === "BREACHED") {
    ruleStatus = "breached";
  } else if (riskFlags.length > 0) {
    ruleStatus = "warning";
  }

  let reviewStatus: ChallengeSnapshot["reviewStatus"] = "building";

  if (input.accountState === "FUNDED" || payoutEligible) {
    reviewStatus = "funded";
  } else if (["REVIEW", "PASSED"].includes(input.accountState ?? "") || (phaseProgressPct >= 100 && phaseNumber === phaseCount && tradingDaysRemaining === 0)) {
    reviewStatus = "review";
  }

  let phaseLabel = `Phase ${phaseNumber}`;

  if (input.accountState === "FUNDED") {
    phaseLabel = "Funded";
  } else if (input.accountState === "PASSED") {
    phaseLabel = "Passed review";
  } else if (input.accountState === "REVIEW") {
    phaseLabel = "Review";
  } else if (input.accountState === "BREACHED") {
    phaseLabel = "Breached";
  } else if (phaseCount === 1) {
    phaseLabel = "Evaluation";
  }

  return {
    currentProfit,
    phaseProfit,
    targetProgressPct,
    targetRemaining,
    phaseTarget,
    phaseProgressPct,
    phaseTargetRemaining,
    dailyDrawdownUsed,
    dailyLossRemaining,
    totalDrawdownUsed,
    totalLossRemaining,
    minTradingDays,
    tradingDaysRemaining,
    payoutEligible,
    phaseNumber,
    phaseCount,
    phaseLabel,
    ruleStatus,
    reviewStatus,
    riskFlags
  };
}

type PayoutHoldInput = {
  accountState?: string | undefined;
  currentProfit: number;
  dailyLossRemaining: number;
  dailyLossLimit: number;
  totalLossRemaining: number;
  totalLossLimit: number;
  tradingDaysRemaining: number;
  ruleStatus: ChallengeSnapshot["ruleStatus"];
};

export function getPayoutHoldAssessment(input: PayoutHoldInput): PayoutHoldAssessment {
  const reasons: string[] = [];
  let severity: PayoutHoldAssessment["severity"] = "none";

  if (input.accountState !== "FUNDED") {
    reasons.push("Account is not funded.");
    severity = "critical";
  }

  if (input.currentProfit <= 0) {
    reasons.push("Account does not have positive realized profit.");
    severity = "critical";
  }

  if (input.tradingDaysRemaining > 0) {
    reasons.push(`Minimum trading-day requirement still needs ${input.tradingDaysRemaining} more day${input.tradingDaysRemaining === 1 ? "" : "s"}.`);
    severity = severity === "critical" ? severity : "warning";
  }

  if (input.ruleStatus === "breached") {
    reasons.push("Account is breached or out of available loss room.");
    severity = "critical";
  }

  if (input.dailyLossRemaining <= input.dailyLossLimit * 0.15) {
    reasons.push("Daily loss buffer is inside the final 15% of available room.");
    severity = severity === "critical" ? severity : "warning";
  }

  if (input.totalLossRemaining <= input.totalLossLimit * 0.15) {
    reasons.push("Overall drawdown buffer is inside the final 15% of available room.");
    severity = severity === "critical" ? severity : "warning";
  }

  return {
    eligible: reasons.length === 0,
    severity,
    reasons
  };
}

export function evaluateChallengeLifecycle(input: ChallengeLifecycleInput): ChallengeLifecycleEvaluation {
  const phaseCount = getEffectivePhaseCount(input);
  const currentPhase = getEffectiveCurrentPhase(input);
  const snapshot = getChallengeSnapshot({
    ...input,
    phaseCount,
    currentPhase,
    phaseStartBalance: input.phaseStartBalance ?? input.startingBalance
  });
  const phaseGoalMet = snapshot.phaseProgressPct >= 100;
  const tradingDaysMet = snapshot.tradingDaysRemaining === 0;
  const readyForReview = phaseGoalMet && tradingDaysMet && currentPhase === phaseCount;

  if (snapshot.ruleStatus === "breached") {
    return {
      nextAccountState: "BREACHED",
      nextPhase: currentPhase,
      nextPhaseStartBalance: input.phaseStartBalance ?? input.startingBalance,
      transition: "breached",
      snapshot
    };
  }

  if (input.accountState === "FUNDED") {
    return {
      nextAccountState: "FUNDED",
      nextPhase: phaseCount,
      nextPhaseStartBalance: input.phaseStartBalance ?? input.startingBalance,
      transition: "none",
      snapshot
    };
  }

  if (phaseGoalMet && tradingDaysMet && currentPhase < phaseCount) {
    return {
      nextAccountState: "EVALUATION",
      nextPhase: currentPhase + 1,
      nextPhaseStartBalance: input.currentBalance,
      transition: "phase-advanced",
      snapshot
    };
  }

  if (readyForReview && input.accountState !== "REVIEW" && input.accountState !== "PASSED") {
    return {
      nextAccountState: "REVIEW",
      nextPhase: currentPhase,
      nextPhaseStartBalance: input.phaseStartBalance ?? input.startingBalance,
      transition: "review-queued",
      snapshot
    };
  }

  if (readyForReview && input.accountState === "REVIEW") {
    return {
      nextAccountState: "PASSED",
      nextPhase: currentPhase,
      nextPhaseStartBalance: input.phaseStartBalance ?? input.startingBalance,
      transition: "passed",
      snapshot
    };
  }

  if (input.accountState === "PASSED") {
    return {
      nextAccountState: "FUNDED",
      nextPhase: currentPhase,
      nextPhaseStartBalance: input.phaseStartBalance ?? input.startingBalance,
      transition: "funded",
      snapshot
    };
  }

  return {
    nextAccountState: "EVALUATION",
    nextPhase: currentPhase,
    nextPhaseStartBalance: input.phaseStartBalance ?? input.startingBalance,
    transition: "none",
    snapshot
  };
}
