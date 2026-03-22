"use server";

import { getDb } from "@fundedpro/db";
import { ensureDemoTradingWorkspaceForTradingAccount, ensureDemoTradingWorkspaceForUser } from "./bootstrap";
import { advanceDemoMarket } from "./engine";

type TerminalSearch = {
  accountId?: string;
  symbol?: string;
  tab?: string;
};

async function resolveRequestedDemoAccountId(userId: string, accountId?: string) {
  if (!accountId) {
    return null;
  }

  const db = getDb();
  const requestedAccountResult = await db.query<{ id: string }>(
    `
      SELECT "id"
      FROM "DemoAccount"
      WHERE "userId" = $1 AND "tradingAccountId" = $2
      LIMIT 1
    `,
    [userId, accountId]
  );

  const existingDemoAccountId = requestedAccountResult.rows[0]?.id ?? null;

  if (existingDemoAccountId) {
    return existingDemoAccountId;
  }

  const tradingAccountResult = await db.query<{
    id: string;
    login: string;
    startingBalance: string;
  }>(
    `
      SELECT "id", "login", "startingBalance"::text AS "startingBalance"
      FROM "TradingAccount"
      WHERE "userId" = $1 AND "id" = $2
      LIMIT 1
    `,
    [userId, accountId]
  );

  const tradingAccount = tradingAccountResult.rows[0];

  if (!tradingAccount) {
    return null;
  }

  const created = await ensureDemoTradingWorkspaceForTradingAccount({
    userId,
    tradingAccountId: tradingAccount.id,
    accountName: tradingAccount.login,
    startingBalance: Number(tradingAccount.startingBalance)
  });

  return created.demoAccountId;
}

async function setActiveDemoAccount(userId: string, requestedDemoAccountId: string | null) {
  if (!requestedDemoAccountId) {
    return;
  }

  const db = getDb();
  await db.query(
    'UPDATE "User" SET "activeDemoAccountId" = $1, "updatedAt" = NOW() WHERE "id" = $2 AND COALESCE("activeDemoAccountId", \'\') <> $1',
    [requestedDemoAccountId, userId]
  );
}

export async function getDemoTradingLiveState(userId: string, search?: Pick<TerminalSearch, "accountId">) {
  const db = getDb();
  await ensureDemoTradingWorkspaceForUser(userId);
  await advanceDemoMarket();

  const requestedDemoAccountId = await resolveRequestedDemoAccountId(userId, search?.accountId);
  await setActiveDemoAccount(userId, requestedDemoAccountId);

  const activeAccountResult = await db.query<{
    id: string;
    accountName: string;
    equity: string;
    buyingPower: string;
    realizedPnl: string;
    unrealizedPnl: string;
    accountState: string | null;
    breachedAt: Date | null;
  }>(
    `
      SELECT da."id", da."accountName", da."equity", da."buyingPower", da."realizedPnl", da."unrealizedPnl", ta."accountState"::text, ta."breachedAt"
      FROM "User" u
      JOIN "DemoAccount" da ON da."id" = COALESCE($2, u."activeDemoAccountId", (
        SELECT da2."id"
        FROM "DemoAccount" da2
        WHERE da2."userId" = u."id"
        ORDER BY da2."updatedAt" DESC
        LIMIT 1
      ))
      LEFT JOIN "TradingAccount" ta ON ta."id" = da."tradingAccountId"
      WHERE u."id" = $1
      LIMIT 1
    `,
    [userId, requestedDemoAccountId]
  );

  const activeAccount = activeAccountResult.rows[0] ?? null;
  const positionsResult = activeAccount
    ? await db.query<{
        instrumentId: string;
        symbol: string;
        side: string;
        quantity: number;
        averageEntryPrice: string;
        lastPrice: string;
        unrealizedPnl: string;
      }>(
        `
          SELECT i."id" AS "instrumentId", i."symbol", p."side", p."quantity", p."averageEntryPrice"::text, p."lastPrice"::text, p."unrealizedPnl"::text
          FROM "DemoPosition" p
          JOIN "Instrument" i ON i."id" = p."instrumentId"
          WHERE p."demoAccountId" = $1
          ORDER BY p."updatedAt" DESC
        `,
        [activeAccount.id]
      )
    : { rows: [] };

  return {
    activeAccount,
    positions: positionsResult.rows
  };
}

export async function getDemoTradingTerminal(userId: string, search?: TerminalSearch) {
  const db = getDb();
  await ensureDemoTradingWorkspaceForUser(userId);
  await advanceDemoMarket();

  const requestedDemoAccountId = await resolveRequestedDemoAccountId(userId, search?.accountId);
  await setActiveDemoAccount(userId, requestedDemoAccountId);

  const [accountsResult, activeAccountResult, watchlistsResult] = await Promise.all([
    db.query<{
      id: string;
      tradingAccountId: string | null;
      accountName: string;
      startingBalance: string;
      currentBalance: string;
      equity: string;
      buyingPower: string;
      status: string;
      accountState: string | null;
      updatedAt: Date;
    }>(
      `
        SELECT da."id", da."tradingAccountId", da."accountName", da."startingBalance"::text, da."currentBalance", da."equity", da."buyingPower", da."status"::text, ta."accountState"::text, da."updatedAt"
        FROM "DemoAccount" da
        LEFT JOIN "TradingAccount" ta ON ta."id" = da."tradingAccountId"
        WHERE da."userId" = $1
        ORDER BY da."updatedAt" DESC
      `,
      [userId]
    ),
    db.query<{
      id: string;
      accountName: string;
      startingBalance: string;
      currentBalance: string;
      equity: string;
      buyingPower: string;
      realizedPnl: string;
      unrealizedPnl: string;
      totalTrades: number;
      status: string;
      accountState: string | null;
      breachedAt: Date | null;
    }>(
      `
          SELECT da."id", da."accountName", da."startingBalance"::text, da."currentBalance", da."equity", da."buyingPower", da."realizedPnl", da."unrealizedPnl", da."totalTrades", da."status"::text, ta."accountState"::text, ta."breachedAt"
          FROM "User" u
          JOIN "DemoAccount" da ON da."id" = COALESCE($2, u."activeDemoAccountId", (
            SELECT da2."id"
            FROM "DemoAccount" da2
            WHERE da2."userId" = u."id"
            ORDER BY da2."updatedAt" DESC
            LIMIT 1
          ))
          LEFT JOIN "TradingAccount" ta ON ta."id" = da."tradingAccountId"
        WHERE u."id" = $1
        LIMIT 1
      `,
      [userId, requestedDemoAccountId]
    ),
    db.query<{ id: string; name: string; isDefault: boolean }>(
      `
        SELECT "id", "name", "isDefault"
        FROM "Watchlist"
        WHERE "userId" = $1
        ORDER BY "isDefault" DESC, "updatedAt" DESC
      `,
      [userId]
    )
  ]);

  const activeAccount = activeAccountResult.rows[0]
    ?? (accountsResult.rows[0]
      ? {
          ...accountsResult.rows[0],
          realizedPnl: "0",
          unrealizedPnl: "0",
          totalTrades: 0
        }
      : null);
  const activeWatchlist = watchlistsResult.rows[0] ?? null;

  const watchlistItemsResult = activeWatchlist
    ? await db.query<{
        instrumentId: string;
        symbol: string;
        name: string;
      assetClass: string;
      tickSize: string;
      tickValue: string;
      price: string | null;
      changeAmount: string | null;
      changePct: string | null;
      }>(
        `
          SELECT
            i."id" AS "instrumentId",
            i."symbol",
            i."name",
            i."assetClass",
            i."tickSize"::text,
            i."tickValue"::text,
            pt."price"::text,
            pt."changeAmount"::text,
            pt."changePct"::text
          FROM "WatchlistItem" wi
          JOIN "Instrument" i ON i."id" = wi."instrumentId"
          LEFT JOIN LATERAL (
            SELECT "price", "changeAmount", "changePct"
            FROM "PriceTick"
            WHERE "instrumentId" = i."id"
            ORDER BY "createdAt" DESC
            LIMIT 1
          ) pt ON TRUE
          WHERE wi."watchlistId" = $1
          ORDER BY wi."sortOrder" ASC, i."symbol" ASC
        `,
        [activeWatchlist.id]
      )
    : { rows: [] };

  const selectedInstrument =
    watchlistItemsResult.rows.find((item) => item.symbol === search?.symbol) ??
    watchlistItemsResult.rows[0] ??
    null;

  const watchlistItems = watchlistItemsResult.rows;
  const selectedInstrumentWithDelayed = selectedInstrument;
  const executionInstrument = selectedInstrument;
  const marketDataSource: "DELAYED_EXTERNAL" | "SIMULATED" = "SIMULATED";

  const [chartTicksResult, positionsResult, ordersResult, fillsResult, historyResult] = selectedInstrumentWithDelayed && activeAccount
    ? await Promise.all([
        db.query<{ price: string; createdAt: Date }>(
          `
            SELECT "price"::text, "createdAt"
            FROM "PriceTick"
            WHERE "instrumentId" = $1
            ORDER BY "createdAt" DESC
            LIMIT 480
          `,
          [selectedInstrumentWithDelayed.instrumentId]
        ),
        db.query<{
          instrumentId: string;
          symbol: string;
          side: string;
          quantity: number;
          averageEntryPrice: string;
          lastPrice: string;
          realizedPnl: string;
          unrealizedPnl: string;
        }>(
          `
            SELECT i."id" AS "instrumentId", i."symbol", p."side", p."quantity", p."averageEntryPrice"::text, p."lastPrice"::text, p."realizedPnl"::text, p."unrealizedPnl"::text
            FROM "DemoPosition" p
            JOIN "Instrument" i ON i."id" = p."instrumentId"
            WHERE p."demoAccountId" = $1
            ORDER BY p."updatedAt" DESC
          `,
          [activeAccount.id]
        ),
        db.query<{
          id: string;
          symbol: string;
          side: string;
          type: string;
          status: string;
          quantity: number;
          limitPrice: string | null;
          averageFillPrice: string | null;
          createdAt: Date;
        }>(
          `
            SELECT o."id", i."symbol", o."side", o."type", o."status", o."quantity", o."limitPrice"::text, o."averageFillPrice"::text, o."createdAt"
            FROM "DemoOrder" o
            JOIN "Instrument" i ON i."id" = o."instrumentId"
            WHERE o."demoAccountId" = $1
            ORDER BY o."createdAt" DESC
            LIMIT 20
          `,
          [activeAccount.id]
        ),
        db.query<{
          id: string;
          symbol: string;
          side: string;
          quantity: number;
          price: string;
          realizedPnl: string;
          filledAt: Date;
        }>(
          `
            SELECT f."id", i."symbol", f."side", f."quantity", f."price"::text, f."realizedPnl"::text, f."filledAt"
            FROM "DemoFill" f
            JOIN "Instrument" i ON i."id" = f."instrumentId"
            WHERE f."demoAccountId" = $1
            ORDER BY f."filledAt" DESC
            LIMIT 20
          `,
          [activeAccount.id]
        ),
        db.query<{
          id: string;
          symbol: string;
          side: string;
          quantity: number;
          type: string;
          status: string;
          price: string | null;
          realizedPnl: string | null;
          createdAt: Date;
        }>(
          `
            SELECT *
            FROM (
              SELECT
                f."id",
                i."symbol",
                f."side",
                f."quantity",
                'MARKET'::text AS "type",
                'FILLED'::text AS "status",
                f."price"::text AS "price",
                f."realizedPnl"::text AS "realizedPnl",
                f."filledAt" AS "createdAt"
              FROM "DemoFill" f
              JOIN "Instrument" i ON i."id" = f."instrumentId"
              WHERE f."demoAccountId" = $1

              UNION ALL

              SELECT
                o."id",
                i."symbol",
                o."side",
                o."quantity",
                o."type"::text AS "type",
                o."status"::text AS "status",
                COALESCE(o."averageFillPrice"::text, o."limitPrice"::text) AS "price",
                NULL::text AS "realizedPnl",
                o."updatedAt" AS "createdAt"
              FROM "DemoOrder" o
              JOIN "Instrument" i ON i."id" = o."instrumentId"
              WHERE o."demoAccountId" = $1 AND o."status" = 'CANCELED'
            ) history
            ORDER BY "createdAt" DESC
            LIMIT 20
          `,
          [activeAccount.id]
        )
      ])
    : [
        { rows: [] },
        { rows: [] },
        { rows: [] },
        { rows: [] },
        { rows: [] }
      ];

  return {
    accounts: accountsResult.rows,
    activeAccount,
    watchlists: watchlistsResult.rows,
    activeWatchlist,
    watchlistItems,
    selectedInstrument: selectedInstrumentWithDelayed,
    executionInstrument,
    marketDataSource,
    chartTicks: chartTicksResult.rows.slice().reverse(),
    positions: positionsResult.rows,
    orders: ordersResult.rows,
    fills: fillsResult.rows,
    history: historyResult.rows,
    selectedTab: search?.tab ?? "positions"
  };
}
