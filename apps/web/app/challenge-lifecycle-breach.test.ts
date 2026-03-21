import { beforeEach, describe, expect, it, vi } from "vitest";

const query = vi.fn();
const sendAccountBreachedEmailIfNeeded = vi.fn();
const sendChallengeCertificateEmailIfNeeded = vi.fn();

vi.mock("@fundedpro/db", () => ({
  getDb: () => ({ query })
}));

vi.mock("../lib/account-breach-email", () => ({
  sendAccountBreachedEmailIfNeeded
}));

vi.mock("../lib/certificate-email", () => ({
  sendChallengeCertificateEmailIfNeeded
}));

const { evaluateAndPersistTradingAccountLifecycle } = await import("../lib/challenge-lifecycle");

describe("challenge lifecycle breach notifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends the breach email when an evaluation account newly breaches", async () => {
    query
      .mockResolvedValueOnce({
        rows: [{
          id: "acct-1",
          userId: "user-1",
          login: "FP12345",
          accountState: "EVALUATION",
          currentPhase: 1,
          startingBalance: "50000",
          phaseStartBalance: "50000",
          currentBalance: "49000",
          currentEquity: "47450",
          dailyLossLimit: "1500",
          totalLossLimit: "2500",
          profitTarget: "3000",
          tradingDays: 4,
          phaseStartedAt: new Date("2026-03-01T00:00:00.000Z"),
          reviewQueuedAt: null,
          passedAt: null,
          fundedAt: null,
          breachedAt: null
        }]
      })
      .mockResolvedValueOnce({
        rows: [{
          challengeType: "ONE_STEP",
          phaseCount: 1,
          minTradingDays: 3
        }]
      })
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: []
      });

    const result = await evaluateAndPersistTradingAccountLifecycle("acct-1");

    expect(result?.nextAccountState).toBe("BREACHED");
    expect(result?.transition).toBe("breached");
    expect(sendAccountBreachedEmailIfNeeded).toHaveBeenCalledWith({
      tradingAccountId: "acct-1",
      actorUserId: "user-1"
    });
    expect(sendChallengeCertificateEmailIfNeeded).not.toHaveBeenCalled();
  });

  it("does not send the breach email when no new breach transition happens", async () => {
    query
      .mockResolvedValueOnce({
        rows: [{
          id: "acct-1",
          userId: "user-1",
          login: "FP12345",
          accountState: "BREACHED",
          currentPhase: 1,
          startingBalance: "50000",
          phaseStartBalance: "50000",
          currentBalance: "49000",
          currentEquity: "47450",
          dailyLossLimit: "1500",
          totalLossLimit: "2500",
          profitTarget: "3000",
          tradingDays: 4,
          phaseStartedAt: new Date("2026-03-01T00:00:00.000Z"),
          reviewQueuedAt: null,
          passedAt: null,
          fundedAt: null,
          breachedAt: new Date("2026-03-15T00:00:00.000Z")
        }]
      })
      .mockResolvedValueOnce({
        rows: [{
          challengeType: "ONE_STEP",
          phaseCount: 1,
          minTradingDays: 3
        }]
      })
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: []
      });

    const result = await evaluateAndPersistTradingAccountLifecycle("acct-1");

    expect(result?.nextAccountState).toBe("BREACHED");
    expect(result?.transition).toBe("breached");
    expect(sendAccountBreachedEmailIfNeeded).not.toHaveBeenCalled();
    expect(sendChallengeCertificateEmailIfNeeded).not.toHaveBeenCalled();
  });
});
