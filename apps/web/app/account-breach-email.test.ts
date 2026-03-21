import { beforeEach, describe, expect, it, vi } from "vitest";

const query = vi.fn();
const sendAccountBreachedEmail = vi.fn();

vi.mock("@fundedpro/db", () => ({
  getDb: () => ({ query })
}));

vi.mock("../lib/email/service", () => ({
  sendAccountBreachedEmail
}));

vi.mock("../lib/env", () => ({
  getWebEnv: () => ({
    appUrl: "http://localhost:3000"
  })
}));

const { sendAccountBreachedEmailIfNeeded } = await import("../lib/account-breach-email");

describe("account breach email", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends the breach email and writes an audit log the first time", async () => {
    query
      .mockResolvedValueOnce({
        rows: [{
          id: "acct-1",
          userId: "user-1",
          email: "trader@example.com",
          fullName: "Trader Example",
          login: "FP12345",
          accountState: "BREACHED"
        }]
      })
      .mockResolvedValueOnce({
        rowCount: 0,
        rows: []
      })
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: []
      });

    const result = await sendAccountBreachedEmailIfNeeded({
      tradingAccountId: "acct-1",
      actorUserId: "admin-1"
    });

    expect(result).toBe(true);
    expect(sendAccountBreachedEmail).toHaveBeenCalledWith({
      to: "trader@example.com",
      fullName: "Trader Example",
      login: "FP12345",
      accountUrl: "http://localhost:3000/dashboard/account?accountId=acct-1"
    });
    expect(query).toHaveBeenCalledTimes(3);
  });

  it("does not resend when an audit log already exists", async () => {
    query
      .mockResolvedValueOnce({
        rows: [{
          id: "acct-1",
          userId: "user-1",
          email: "trader@example.com",
          fullName: "Trader Example",
          login: "FP12345",
          accountState: "BREACHED"
        }]
      })
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ id: "audit-1" }]
      });

    const result = await sendAccountBreachedEmailIfNeeded({
      tradingAccountId: "acct-1"
    });

    expect(result).toBe(false);
    expect(sendAccountBreachedEmail).not.toHaveBeenCalled();
    expect(query).toHaveBeenCalledTimes(2);
  });

  it("does nothing when the account is not breached", async () => {
    query.mockResolvedValueOnce({
      rows: [{
        id: "acct-1",
        userId: "user-1",
        email: "trader@example.com",
        fullName: "Trader Example",
        login: "FP12345",
        accountState: "EVALUATION"
      }]
    });

    const result = await sendAccountBreachedEmailIfNeeded({
      tradingAccountId: "acct-1"
    });

    expect(result).toBe(false);
    expect(sendAccountBreachedEmail).not.toHaveBeenCalled();
    expect(query).toHaveBeenCalledTimes(1);
  });
});
