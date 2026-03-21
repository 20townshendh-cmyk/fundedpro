import { randomUUID } from "node:crypto";
import { getDb } from "@fundedpro/db";
import { evaluateAllTradingAccountLifecycles, evaluateAndPersistTradingAccountLifecycle } from "../challenge-lifecycle";
import { sweepPayoutRequests } from "../payout-sweep";
import { MockPlatformProvider } from "./mock-provider";
import type { PlatformAccountSnapshot } from "./provider";

const mockProvider = new MockPlatformProvider();

type PersistedPlatformSnapshot = PlatformAccountSnapshot & {
  syncRunId: string | null;
  syncedAt: string | null;
  status: string;
  errorMessage: string | null;
};

type SyncOptions = {
  simulateFailure?: boolean;
};

type BatchSyncOptions = SyncOptions & {
  actorUserId?: string;
  limit?: number;
};

type PlatformSyncHealth = {
  latestStatus: string;
  lastSyncedAt: string | null;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  lastFailureMessage: string | null;
  warnings: string[];
};

function toFixedAmount(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

async function seedMockSyncHistory(args: {
  tradingAccountId: string;
  login: string;
  snapshot: PlatformAccountSnapshot;
}) {
  const db = getDb();
  const existingResult = await db.query<{ count: string }>(
    'SELECT COUNT(*)::text AS "count" FROM "Mt5SyncRun" WHERE "login" = $1',
    [args.login]
  );
  const existingCount = Number(existingResult.rows[0]?.count ?? 0);

  if (existingCount >= 6 || !args.snapshot.closedTrades.length) {
    return;
  }

  const orderedTrades = [...args.snapshot.closedTrades]
    .sort((a, b) => new Date(a.closedAt).getTime() - new Date(b.closedAt).getTime())
    .slice(0, 6);
  const totalRealized = orderedTrades.reduce((sum, trade) => sum + trade.realizedPnl, 0);
  const baseBalance = args.snapshot.balance - totalRealized;
  let runningPnl = 0;

  for (const [index, trade] of orderedTrades.entries()) {
    runningPnl += trade.realizedPnl;
    const balance = toFixedAmount(baseBalance + runningPnl);
    const equity = toFixedAmount(balance + (index % 2 === 0 ? 18 : -12));
    const syncedAt = new Date(new Date(trade.closedAt).getTime() + (index + 1) * 60000).toISOString();

    await db.query(
      `
        INSERT INTO "Mt5SyncRun" (
          "id", "tradingAccountId", "login", "provider", "status", "balance", "equity", "realizedPnl", "unrealizedPnl",
          "dailyLossUsed", "totalLossUsed", "tradingDays", "rawPayload", "syncedAt", "createdAt", "updatedAt"
        )
        VALUES ($1, $2, $3, $4, 'SUCCESS', $5, $6, $7, $8, $9, $10, $11, $12::jsonb, $13, NOW(), NOW())
      `,
      [
        randomUUID(),
        args.tradingAccountId,
        args.login,
        args.snapshot.provider,
        balance,
        equity,
        toFixedAmount(runningPnl),
        toFixedAmount(equity - balance),
        toFixedAmount(Math.max(0, balance - equity)),
        toFixedAmount(Math.max(0, 50000 - equity)),
        Math.min(args.snapshot.tradingDays, index + 1),
        JSON.stringify({
          bridge: "mock-history-seed",
          login: args.login,
          sourceTradeTicket: trade.ticket,
          syncedAt
        }),
        syncedAt
      ]
    );
  }
}

function toSnapshotWithMeta(snapshot: PlatformAccountSnapshot, meta?: { syncRunId?: string; syncedAt?: string; status?: string; errorMessage?: string | null }): PersistedPlatformSnapshot {
  return {
    ...snapshot,
    syncRunId: meta?.syncRunId ?? null,
    syncedAt: meta?.syncedAt ?? null,
    status: meta?.status ?? "SUCCESS",
    errorMessage: meta?.errorMessage ?? null
  };
}

export async function getPlatformSnapshot(login: string) {
  return mockProvider.getAccountSnapshot(login);
}

async function insertFailedSyncRun(args: {
  tradingAccountId: string;
  login: string;
  provider: string;
  errorMessage: string;
}) {
  const db = getDb();
  const syncRunId = randomUUID();
  const syncedAt = new Date().toISOString();

  await db.query(
    `
      INSERT INTO "Mt5SyncRun" (
        "id", "tradingAccountId", "login", "provider", "status", "errorMessage", "balance", "equity", "realizedPnl", "unrealizedPnl",
        "dailyLossUsed", "totalLossUsed", "tradingDays", "rawPayload", "syncedAt", "createdAt", "updatedAt"
      )
      VALUES ($1, $2, $3, $4, 'FAILED', $5, 0, 0, 0, 0, 0, 0, 0, $6::jsonb, $7, NOW(), NOW())
    `,
    [
      syncRunId,
      args.tradingAccountId,
      args.login,
      args.provider,
      args.errorMessage,
      JSON.stringify({
        bridge: args.provider,
        login: args.login,
        state: "failed",
        error: args.errorMessage,
        syncedAt
      }),
      syncedAt
    ]
  );
}

export async function syncPlatformAccountByLogin(login: string, options: SyncOptions = {}): Promise<PersistedPlatformSnapshot | null> {
  const db = getDb();
  const accountResult = await db.query<{ id: string; login: string }>(
    'SELECT "id", "login" FROM "TradingAccount" WHERE "login" = $1 LIMIT 1',
    [login]
  );
  const account = accountResult.rows[0];

  if (!account) {
    return null;
  }

  if (options.simulateFailure) {
    await insertFailedSyncRun({
      tradingAccountId: account.id,
      login,
      provider: "mock-mt5",
      errorMessage: "Simulated bridge timeout while fetching account snapshot."
    });

    return null;
  }

  const snapshot = await mockProvider.getAccountSnapshot(login);
  const syncRunId = randomUUID();
  const syncedAt = new Date().toISOString();

  await db.query("BEGIN");

  try {
    await db.query(
      `
        INSERT INTO "Mt5SyncRun" (
          "id", "tradingAccountId", "login", "provider", "status", "balance", "equity", "realizedPnl", "unrealizedPnl",
          "dailyLossUsed", "totalLossUsed", "tradingDays", "rawPayload", "syncedAt", "createdAt", "updatedAt"
        )
        VALUES ($1, $2, $3, $4, 'SUCCESS', $5, $6, $7, $8, $9, $10, $11, $12::jsonb, $13, NOW(), NOW())
      `,
      [
        syncRunId,
        account.id,
        snapshot.login,
        snapshot.provider,
        toFixedAmount(snapshot.balance),
        toFixedAmount(snapshot.equity),
        toFixedAmount(snapshot.realizedPnl),
        toFixedAmount(snapshot.unrealizedPnl),
        toFixedAmount(snapshot.dailyLossUsed),
        toFixedAmount(snapshot.totalLossUsed),
        snapshot.tradingDays,
        JSON.stringify(snapshot.rawPayload),
        syncedAt
      ]
    );

    await db.query(
      `
        UPDATE "TradingAccount"
        SET
          "currentBalance" = $1,
          "currentEquity" = $2,
          "tradingDays" = $3,
          "updatedAt" = NOW()
        WHERE "id" = $4
      `,
      [toFixedAmount(snapshot.balance), toFixedAmount(snapshot.equity), snapshot.tradingDays, account.id]
    );

    if (snapshot.positions.length) {
      await db.query(
        `
          INSERT INTO "Mt5PositionSnapshot" (
            "id", "tradingAccountId", "syncRunId", "ticket", "symbol", "side", "lots", "openPrice", "markPrice", "unrealizedPnl", "createdAt"
          )
          VALUES ${snapshot.positions.map((_, index) => `($${index * 10 + 1}, $${index * 10 + 2}, $${index * 10 + 3}, $${index * 10 + 4}, $${index * 10 + 5}, $${index * 10 + 6}, $${index * 10 + 7}, $${index * 10 + 8}, $${index * 10 + 9}, $${index * 10 + 10}, NOW())`).join(", ")}
        `,
        snapshot.positions.flatMap((position) => [
          randomUUID(),
          account.id,
          syncRunId,
          position.ticket,
          position.symbol,
          position.side,
          toFixedAmount(position.lots),
          Number(position.openPrice),
          Number(position.markPrice),
          toFixedAmount(position.unrealizedPnl)
        ])
      );
    }

    for (const trade of snapshot.closedTrades) {
      await db.query(
        `
          INSERT INTO "Mt5ClosedTrade" (
            "id", "tradingAccountId", "syncRunId", "ticket", "symbol", "side", "lots", "openPrice", "closePrice", "realizedPnl", "openedAt", "closedAt", "createdAt"
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
          ON CONFLICT ("tradingAccountId", "ticket")
          DO UPDATE SET
            "syncRunId" = EXCLUDED."syncRunId",
            "symbol" = EXCLUDED."symbol",
            "side" = EXCLUDED."side",
            "lots" = EXCLUDED."lots",
            "openPrice" = EXCLUDED."openPrice",
            "closePrice" = EXCLUDED."closePrice",
            "realizedPnl" = EXCLUDED."realizedPnl",
            "openedAt" = EXCLUDED."openedAt",
            "closedAt" = EXCLUDED."closedAt"
        `,
        [
          randomUUID(),
          account.id,
          syncRunId,
          trade.ticket,
          trade.symbol,
          trade.side,
          toFixedAmount(trade.lots),
          Number(trade.openPrice),
          Number(trade.closePrice),
          toFixedAmount(trade.realizedPnl),
          trade.openedAt,
          trade.closedAt
        ]
      );
    }

    await db.query("COMMIT");
  } catch (error) {
    await db.query("ROLLBACK");
    throw error;
  }

  await evaluateAndPersistTradingAccountLifecycle(account.id);
  await seedMockSyncHistory({
    tradingAccountId: account.id,
    login,
    snapshot
  });

  return toSnapshotWithMeta(snapshot, {
    syncRunId,
    syncedAt,
    status: "SUCCESS"
  });
}

export async function syncAllTradingAccounts(options: BatchSyncOptions = {}) {
  const db = getDb();
  const accountsResult = await db.query<{ login: string }>(
    `
      SELECT "login"
      FROM "TradingAccount"
      ORDER BY "updatedAt" ASC
      ${options.limit ? `LIMIT ${Math.max(1, Math.floor(options.limit))}` : ""}
    `
  );

  const results = [];

  for (const account of accountsResult.rows) {
    const snapshot = await syncPlatformAccountByLogin(account.login, options);
    results.push({
      login: account.login,
      status: snapshot?.status ?? (options.simulateFailure ? "FAILED" : "MISSING")
    });
  }

  const lifecycleUpdates = await evaluateAllTradingAccountLifecycles(options.limit ? { limit: options.limit } : {});
  const payoutUpdates = await sweepPayoutRequests(options);

  if (options.actorUserId) {
    await db.query(
      `
        INSERT INTO "AuditLog" ("id", "actorUserId", "targetType", "targetId", "action", "summary", "metadata", "createdAt")
        VALUES ($1, $2, 'PLATFORM_SYNC_FLEET', 'fleet', 'PLATFORM_SYNC_WORKER_CYCLE', $3, $4::jsonb, NOW())
      `,
      [
        randomUUID(),
        options.actorUserId,
        `Worker cycle synced ${results.length} account(s).`,
        JSON.stringify({
          total: results.length,
          success: results.filter((result) => result.status === "SUCCESS").length,
          failed: results.filter((result) => result.status === "FAILED").length,
          missing: results.filter((result) => result.status === "MISSING").length,
          logins: results.map((result) => result.login),
          lifecycleSweeps: lifecycleUpdates.length,
          lifecycleTransitions: lifecycleUpdates.filter((result) => result.transition !== "none").length,
          payoutAutoHolds: payoutUpdates.length
        })
      ]
    );
  }

  return {
    syncResults: results,
    lifecycleUpdates,
    payoutUpdates
  };
}

export async function getLatestPersistedPlatformSnapshot(login: string): Promise<PersistedPlatformSnapshot | null> {
  const db = getDb();
  const syncResult = await db.query<{
    id: string;
    tradingAccountId: string;
    login: string;
    provider: string;
    status: string;
    errorMessage: string | null;
    balance: string;
    equity: string;
    realizedPnl: string;
    unrealizedPnl: string;
    dailyLossUsed: string;
    totalLossUsed: string;
    tradingDays: number;
    rawPayload: Record<string, unknown> | null;
    syncedAt: Date;
  }>(
    `
      SELECT "id", "tradingAccountId", "login", "provider", "status", "errorMessage", "balance", "equity", "realizedPnl", "unrealizedPnl",
             "dailyLossUsed", "totalLossUsed", "tradingDays", "rawPayload", "syncedAt"
      FROM "Mt5SyncRun"
      WHERE "login" = $1
      ORDER BY "syncedAt" DESC
      LIMIT 1
    `,
    [login]
  );

  const syncRun = syncResult.rows[0];

  if (!syncRun) {
    return null;
  }

  const [positionsResult, tradesResult] = await Promise.all([
    db.query<{
      ticket: string;
      symbol: string;
      side: "BUY" | "SELL";
      lots: string;
      openPrice: string;
      markPrice: string;
      unrealizedPnl: string;
    }>(
      `
        SELECT "ticket", "symbol", "side", "lots", "openPrice", "markPrice", "unrealizedPnl"
        FROM "Mt5PositionSnapshot"
        WHERE "syncRunId" = $1
        ORDER BY "ticket" ASC
      `,
      [syncRun.id]
    ),
    db.query<{
      ticket: string;
      symbol: string;
      side: "BUY" | "SELL";
      lots: string;
      openPrice: string;
      closePrice: string;
      realizedPnl: string;
      openedAt: Date;
      closedAt: Date;
    }>(
      `
        SELECT "ticket", "symbol", "side", "lots", "openPrice", "closePrice", "realizedPnl", "openedAt", "closedAt"
        FROM "Mt5ClosedTrade"
        WHERE "tradingAccountId" = $1
        ORDER BY "closedAt" DESC
        LIMIT 20
      `,
      [syncRun.tradingAccountId]
    )
  ]);

  return {
    login: syncRun.login,
    provider: syncRun.provider,
    balance: Number(syncRun.balance),
    equity: Number(syncRun.equity),
    realizedPnl: Number(syncRun.realizedPnl),
    unrealizedPnl: Number(syncRun.unrealizedPnl),
    drawdown: Number(syncRun.totalLossUsed),
    dailyLossUsed: Number(syncRun.dailyLossUsed),
    totalLossUsed: Number(syncRun.totalLossUsed),
    tradingDays: syncRun.tradingDays,
    symbols: Array.from(
      new Set([
        ...positionsResult.rows.map((position) => position.symbol),
        ...tradesResult.rows.map((trade) => trade.symbol)
      ])
    ),
    positions: positionsResult.rows.map((position) => ({
      ticket: position.ticket,
      symbol: position.symbol,
      side: position.side,
      lots: Number(position.lots),
      openPrice: Number(position.openPrice),
      markPrice: Number(position.markPrice),
      unrealizedPnl: Number(position.unrealizedPnl)
    })),
    closedTrades: tradesResult.rows.map((trade) => ({
      ticket: trade.ticket,
      symbol: trade.symbol,
      side: trade.side,
      lots: Number(trade.lots),
      openPrice: Number(trade.openPrice),
      closePrice: Number(trade.closePrice),
      realizedPnl: Number(trade.realizedPnl),
      openedAt: trade.openedAt.toISOString(),
      closedAt: trade.closedAt.toISOString()
    })),
    rawPayload: syncRun.rawPayload ?? { state: "missing" },
    syncRunId: syncRun.id,
    syncedAt: syncRun.syncedAt.toISOString(),
    status: syncRun.status,
    errorMessage: syncRun.errorMessage
  };
}

export async function getPlatformSnapshotHistory(login: string) {
  const db = getDb();
  const result = await db.query<{
    id: string;
    status: string;
    errorMessage: string | null;
    balance: string;
    equity: string;
    realizedPnl: string;
    unrealizedPnl: string;
    syncedAt: Date;
  }>(
    `
      SELECT "id", "status", "errorMessage", "balance", "equity", "realizedPnl", "unrealizedPnl", "syncedAt"
      FROM "Mt5SyncRun"
      WHERE "login" = $1
      ORDER BY "syncedAt" DESC
      LIMIT 12
    `,
    [login]
  );

  return result.rows.map((row) => ({
    ...row,
    balance: Number(row.balance),
    equity: Number(row.equity),
    realizedPnl: Number(row.realizedPnl),
    unrealizedPnl: Number(row.unrealizedPnl)
  }));
}

export async function getPlatformSyncHealth(login: string): Promise<PlatformSyncHealth> {
  const db = getDb();
  const [latestResult, successResult, failureResult] = await Promise.all([
    db.query<{ status: string; syncedAt: Date; errorMessage: string | null }>(
      `
        SELECT "status", "syncedAt", "errorMessage"
        FROM "Mt5SyncRun"
        WHERE "login" = $1
        ORDER BY "syncedAt" DESC
        LIMIT 1
      `,
      [login]
    ),
    db.query<{ syncedAt: Date }>(
      `
        SELECT "syncedAt"
        FROM "Mt5SyncRun"
        WHERE "login" = $1 AND "status" = 'SUCCESS'
        ORDER BY "syncedAt" DESC
        LIMIT 1
      `,
      [login]
    ),
    db.query<{ syncedAt: Date; errorMessage: string | null }>(
      `
        SELECT "syncedAt", "errorMessage"
        FROM "Mt5SyncRun"
        WHERE "login" = $1 AND "status" = 'FAILED'
        ORDER BY "syncedAt" DESC
        LIMIT 1
      `,
      [login]
    )
  ]);

  const latest = latestResult.rows[0];
  const lastSuccess = successResult.rows[0];
  const lastFailure = failureResult.rows[0];
  const warnings: string[] = [];

  if (!lastSuccess) {
    warnings.push("No successful sync has completed for this account yet.");
  }

  if (latest?.status === "FAILED") {
    warnings.push("Latest sync attempt failed and needs a retry.");
  }

  if (lastFailure && lastSuccess && lastFailure.syncedAt > lastSuccess.syncedAt) {
    warnings.push("A newer failed sync exists after the last successful sync.");
  }

  return {
    latestStatus: latest?.status ?? "IDLE",
    lastSyncedAt: latest?.syncedAt?.toISOString() ?? null,
    lastSuccessAt: lastSuccess?.syncedAt?.toISOString() ?? null,
    lastFailureAt: lastFailure?.syncedAt?.toISOString() ?? null,
    lastFailureMessage: lastFailure?.errorMessage ?? null,
    warnings
  };
}

export {
  getPlatformSnapshot as getMt5Snapshot,
  syncPlatformAccountByLogin as syncMt5AccountByLogin,
  getLatestPersistedPlatformSnapshot as getLatestPersistedMt5Snapshot,
  getPlatformSnapshotHistory as getMt5SnapshotHistory,
  getPlatformSyncHealth as getMt5SyncHealth
};
