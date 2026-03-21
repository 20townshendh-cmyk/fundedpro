"use server";

import { getDb } from "@fundedpro/db";
import { evaluateAndPersistTradingAccountLifecycle } from "./challenge-lifecycle";

type InternalClosedTrade = {
  ticket: string;
  symbol: string;
  side: "BUY" | "SELL";
  lots: number;
  openPrice: number;
  closePrice: number;
  realizedPnl: number;
  openedAt: string;
  closedAt: string;
};

type InternalPosition = {
  ticket: string;
  symbol: string;
  side: string;
  lots: number;
  openPrice: number;
  markPrice: number;
  unrealizedPnl: number;
};

type InternalSnapshotHistoryPoint = {
  id: string;
  balance: number;
  equity: number;
  syncedAt: string;
};

export async function syncTradingAccountFromDemo(tradingAccountId: string) {
  const db = getDb();
  const demoResult = await db.query<{
    tradingAccountId: string;
    currentBalance: string;
    equity: string;
    tradingDays: string;
  }>(
    `
      SELECT
        da."tradingAccountId",
        da."currentBalance"::text,
        da."equity"::text,
        COUNT(DISTINCT DATE(f."filledAt"))::text AS "tradingDays"
      FROM "DemoAccount" da
      LEFT JOIN "DemoFill" f ON f."demoAccountId" = da."id"
      WHERE da."tradingAccountId" = $1
      GROUP BY da."tradingAccountId", da."currentBalance", da."equity"
      LIMIT 1
    `,
    [tradingAccountId]
  );
  const demo = demoResult.rows[0];

  if (!demo) {
    return null;
  }

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
    [Number(demo.currentBalance), Number(demo.equity), Number(demo.tradingDays), tradingAccountId]
  );

  await evaluateAndPersistTradingAccountLifecycle(tradingAccountId);
  return demo;
}

export async function syncTradingAccountFromDemoAccount(demoAccountId: string) {
  const db = getDb();
  const accountResult = await db.query<{ tradingAccountId: string | null }>(
    'SELECT "tradingAccountId" FROM "DemoAccount" WHERE "id" = $1 LIMIT 1',
    [demoAccountId]
  );
  const tradingAccountId = accountResult.rows[0]?.tradingAccountId;

  if (!tradingAccountId) {
    return null;
  }

  return syncTradingAccountFromDemo(tradingAccountId);
}

export async function syncUserTradingAccountsFromDemo(userId: string) {
  const db = getDb();
  const accounts = await db.query<{ id: string }>(
    `
      SELECT ta."id"
      FROM "TradingAccount" ta
      JOIN "DemoAccount" da ON da."tradingAccountId" = ta."id"
      WHERE ta."userId" = $1
      ORDER BY ta."createdAt" DESC
    `,
    [userId]
  );

  for (const account of accounts.rows) {
    await syncTradingAccountFromDemo(account.id);
  }
}

export async function getInternalTradingSnapshot(tradingAccountId: string) {
  const db = getDb();
  const [accountResult, fillsResult, positionsResult] = await Promise.all([
    db.query<{
      demoAccountId: string;
      balance: string;
      equity: string;
      startingBalance: string;
    }>(
      `
        SELECT da."id" AS "demoAccountId", da."currentBalance"::text AS "balance", da."equity"::text, da."startingBalance"::text
        FROM "DemoAccount" da
        WHERE da."tradingAccountId" = $1
        LIMIT 1
      `,
      [tradingAccountId]
    ),
    db.query<{
      id: string;
      symbol: string;
      side: "BUY" | "SELL";
      quantity: number;
      submittedPrice: string | null;
      price: string;
      realizedPnl: string;
      submittedAt: Date;
      filledAt: Date;
    }>(
      `
        SELECT
          f."id",
          i."symbol",
          f."side",
          f."quantity",
          o."submittedPrice"::text,
          f."price"::text,
          f."realizedPnl"::text,
          o."submittedAt",
          f."filledAt"
        FROM "DemoAccount" da
        JOIN "DemoFill" f ON f."demoAccountId" = da."id"
        JOIN "DemoOrder" o ON o."id" = f."orderId"
        JOIN "Instrument" i ON i."id" = f."instrumentId"
        WHERE da."tradingAccountId" = $1
        ORDER BY f."filledAt" DESC
      `,
      [tradingAccountId]
    ),
    db.query<{
      id: string;
      symbol: string;
      side: string;
      quantity: number;
      averageEntryPrice: string;
      lastPrice: string;
      unrealizedPnl: string;
    }>(
      `
        SELECT
          p."id",
          i."symbol",
          p."side",
          p."quantity",
          p."averageEntryPrice"::text,
          p."lastPrice"::text,
          p."unrealizedPnl"::text
        FROM "DemoAccount" da
        JOIN "DemoPosition" p ON p."demoAccountId" = da."id"
        JOIN "Instrument" i ON i."id" = p."instrumentId"
        WHERE da."tradingAccountId" = $1
        ORDER BY p."updatedAt" DESC
      `,
      [tradingAccountId]
    )
  ]);

  const linkedAccount = accountResult.rows[0];

  if (!linkedAccount) {
    return null;
  }

  const closedTrades: InternalClosedTrade[] = fillsResult.rows.map((fill) => ({
    ticket: fill.id,
    symbol: fill.symbol,
    side: fill.side,
    lots: fill.quantity,
    openPrice: Number(fill.submittedPrice ?? fill.price),
    closePrice: Number(fill.price),
    realizedPnl: Number(fill.realizedPnl),
    openedAt: fill.submittedAt.toISOString(),
    closedAt: fill.filledAt.toISOString()
  }));

  const positions: InternalPosition[] = positionsResult.rows.map((position) => ({
    ticket: position.id,
    symbol: position.symbol,
    side: position.side,
    lots: position.quantity,
    openPrice: Number(position.averageEntryPrice),
    markPrice: Number(position.lastPrice),
    unrealizedPnl: Number(position.unrealizedPnl)
  }));

  const orderedTrades = closedTrades.slice().sort((left, right) => (
    new Date(left.closedAt).getTime() - new Date(right.closedAt).getTime()
  ));
  let runningBalance = Number(linkedAccount.startingBalance);
  const history: InternalSnapshotHistoryPoint[] = orderedTrades.map((trade) => {
    runningBalance += trade.realizedPnl;

    return {
      id: trade.ticket,
      balance: Number(runningBalance.toFixed(2)),
      equity: Number(runningBalance.toFixed(2)),
      syncedAt: trade.closedAt
    };
  });
  history.push({
    id: "current",
    balance: Number(linkedAccount.balance),
    equity: Number(linkedAccount.equity),
    syncedAt: new Date().toISOString()
  });

  return {
    balance: Number(linkedAccount.balance),
    equity: Number(linkedAccount.equity),
    tradingDays: new Set(closedTrades.map((trade) => trade.closedAt.slice(0, 10))).size,
    totalLossUsed: Math.max(0, Number(linkedAccount.startingBalance) - Number(linkedAccount.equity)),
    closedTrades,
    positions,
    history
  };
}
