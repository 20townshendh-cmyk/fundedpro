import { beforeEach, describe, expect, it, vi } from "vitest";

const evaluateAndPersistTradingAccountLifecycle = vi.fn();
const sendOrderReceivedEmail = vi.fn();
const sendTradingCredentialsEmail = vi.fn();
const ensureDemoTradingWorkspaceForTradingAccount = vi.fn();
const syncTradingAccountFromDemo = vi.fn();

vi.mock("../lib/challenge-lifecycle", () => ({
  evaluateAndPersistTradingAccountLifecycle
}));

vi.mock("../lib/email/service", () => ({
  sendOrderReceivedEmail,
  sendTradingCredentialsEmail
}));

vi.mock("../lib/demo-trading/bootstrap", () => ({
  ensureDemoTradingWorkspaceForTradingAccount
}));

vi.mock("../lib/internal-trading-sync", () => ({
  syncTradingAccountFromDemo
}));

vi.mock("../lib/env", () => ({
  getWebEnv: () => ({
    appUrl: "http://localhost:3000",
    tradingCredentialSecret: "test-secret"
  })
}));

const { finalizePaidOrder, provisionTradingAccountForOrder } = await import("../lib/trader");

describe("trader provisioning", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a fresh trading account for a new paid order", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rowCount: 0, rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const db = { query } as any;

    const result = await provisionTradingAccountForOrder({
      db,
      userId: "user-1",
      orderId: "order-1",
      accountSize: 50000,
      profitTargetPct: "6.00",
      dailyDrawdownPct: "3.00",
      maxDrawdownPct: "5.00",
      actorUserId: "admin-1"
    });

    expect(result.wasCreated).toBe(true);
    expect(result.accountId).toBeTruthy();
    expect(result.login).toMatch(/^FP/);
    expect(result.tradingPassword).toBeTruthy();
    expect(query).toHaveBeenCalledTimes(4);
    expect(query.mock.calls[0]?.[1]).toEqual(["order-1"]);
    expect(evaluateAndPersistTradingAccountLifecycle).toHaveBeenCalledOnce();
  });

  it("reuses the same order-linked account on replay instead of creating a duplicate", async () => {
    const query = vi.fn().mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ id: "account-1" }]
    });

    const db = { query } as any;

    const result = await provisionTradingAccountForOrder({
      db,
      userId: "user-1",
      orderId: "order-1",
      accountSize: 50000,
      profitTargetPct: "6.00",
      dailyDrawdownPct: "3.00",
      maxDrawdownPct: "5.00",
      actorUserId: "admin-1"
    });

    expect(result).toEqual({
      accountId: "account-1",
      wasCreated: false
    });
    expect(query).toHaveBeenCalledTimes(1);
    expect(evaluateAndPersistTradingAccountLifecycle).not.toHaveBeenCalled();
  });

  it("emails credentials only when a new account is provisioned", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({
        rows: [{
          id: "order-1",
          userId: "user-1",
          status: "PAID",
          challengePlanId: "plan-1",
          planName: "Starter",
          accountSize: 50000,
          profitTargetPct: "6.00",
          dailyDrawdownPct: "3.00",
          maxDrawdownPct: "5.00",
          phaseCount: 1,
          email: "trader@example.com",
          fullName: "Trader Example",
          invoiceReference: "INV-1",
          invoiceAmountCents: 8900
        }]
      })
      .mockResolvedValueOnce({
        rowCount: 0,
        rows: []
      })
      .mockResolvedValueOnce({ rows: [] });

    const db = { query } as any;

    await finalizePaidOrder({
      db,
      orderId: "order-1",
      actorUserId: "user-1"
    });

    expect(sendOrderReceivedEmail).not.toHaveBeenCalled();
    expect(sendTradingCredentialsEmail).toHaveBeenCalledOnce();
  });
});
