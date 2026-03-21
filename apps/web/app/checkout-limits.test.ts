import { beforeEach, describe, expect, it, vi } from "vitest";

const mockQuery = vi.fn();
const getSession = vi.fn();
const redirect = vi.fn((url: string) => {
  throw new Error(`REDIRECT:${url}`);
});

vi.mock("@fundedpro/db", () => ({
  getDb: () => ({
    query: mockQuery
  })
}));

vi.mock("../lib/auth", () => ({
  getSession
}));

vi.mock("next/navigation", () => ({
  redirect
}));

vi.mock("../lib/challenge-lifecycle", () => ({
  evaluateAndPersistTradingAccountLifecycle: vi.fn()
}));

vi.mock("../lib/email/service", () => ({
  sendOrderReceivedEmail: vi.fn(),
  sendTradingCredentialsEmail: vi.fn()
}));

vi.mock("../lib/demo-trading/bootstrap", () => ({
  ensureDemoTradingWorkspaceForTradingAccount: vi.fn()
}));

vi.mock("../lib/internal-trading-sync", () => ({
  syncTradingAccountFromDemo: vi.fn()
}));

vi.mock("../lib/env", () => ({
  getWebEnv: () => ({
    appUrl: "http://localhost:3000",
    hasRealStripe: false,
    tradingCredentialSecret: "test-secret"
  })
}));

vi.mock("../lib/stripe", () => ({
  getStripeClient: () => null
}));

const { getCheckoutPurchaseCapacity, startChallengeCheckoutAction } = await import("../lib/trader");

describe("checkout purchase limits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSession.mockResolvedValue({
      userId: "user-1",
      email: "trader@example.com"
    });
  });

  it("counts only non-failed active accounts and apex accounts", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ activeAccountCount: "4", activeApexAccountCount: "2" }]
    });

    const result = await getCheckoutPurchaseCapacity({ query: mockQuery } as any, "user-1");

    expect(result).toEqual({
      activeAccountCount: 4,
      activeApexAccountCount: 2,
      maxActiveAccounts: 5,
      maxActiveApexAccounts: 2
    });
    expect(mockQuery).toHaveBeenCalledOnce();
  });

  it("blocks checkout when the trader already has 5 active accounts", async () => {
    mockQuery
      .mockResolvedValueOnce({
        rows: [{
          id: "plan-1",
          slug: "starter-50k",
          name: "Starter",
          accountSize: 50000,
          priceCents: 20000
        }]
      })
      .mockResolvedValueOnce({
        rows: [{ activeAccountCount: "5", activeApexAccountCount: "1" }]
      });

    await expect(startChallengeCheckoutAction(new FormData())).rejects.toThrow(
      "REDIRECT:/checkout?planSlug=starter-50k&error=account-limit"
    );
  });

  it("blocks apex checkout when the trader already has 2 active 600K accounts", async () => {
    const formData = new FormData();
    formData.set("planSlug", "apex-600k");

    mockQuery
      .mockResolvedValueOnce({
        rows: [{
          id: "plan-apex",
          slug: "apex-600k",
          name: "Apex",
          accountSize: 600000,
          priceCents: 90000
        }]
      })
      .mockResolvedValueOnce({
        rows: [{ activeAccountCount: "3", activeApexAccountCount: "2" }]
      });

    await expect(startChallengeCheckoutAction(formData)).rejects.toThrow(
      "REDIRECT:/checkout?planSlug=apex-600k&error=apex-limit"
    );
  });
});
