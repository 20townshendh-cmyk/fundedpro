"use server";

import { randomUUID } from "node:crypto";
import { getDb } from "@fundedpro/db";

const STARTER_BALANCE = 50000;
const DEFAULT_SYMBOLS = ["ES", "NQ", "CL", "GC", "BTC"] as const;

export async function ensureDemoTradingWorkspaceForUser(userId: string) {
  const db = getDb();

  await db.query(`
    INSERT INTO "Instrument" ("id", "symbol", "name", "assetClass", "tickSize", "tickValue", "defaultPrice", "createdAt", "updatedAt")
    VALUES
      ('instrument_es', 'ES', 'E-mini S&P 500', 'FUTURES', 0.25, 12.50, 5234.25, NOW(), NOW()),
      ('instrument_nq', 'NQ', 'E-mini Nasdaq 100', 'FUTURES', 0.25, 5.00, 18342.75, NOW(), NOW()),
      ('instrument_cl', 'CL', 'Crude Oil', 'FUTURES', 0.01, 10.00, 77.42, NOW(), NOW()),
      ('instrument_gc', 'GC', 'Gold', 'FUTURES', 0.10, 10.00, 2188.40, NOW(), NOW()),
      ('instrument_btc', 'BTC', 'Bitcoin', 'CRYPTO', 1.00, 1.00, 68420.00, NOW(), NOW())
    ON CONFLICT ("symbol")
    DO UPDATE SET
      "name" = EXCLUDED."name",
      "assetClass" = EXCLUDED."assetClass",
      "tickSize" = EXCLUDED."tickSize",
      "tickValue" = EXCLUDED."tickValue",
      "defaultPrice" = EXCLUDED."defaultPrice",
      "updatedAt" = NOW();
  `);

  const existingAccountResult = await db.query<{ id: string }>(
    'SELECT "id" FROM "DemoAccount" WHERE "userId" = $1 ORDER BY "createdAt" ASC LIMIT 1',
    [userId]
  );

  let demoAccountId = existingAccountResult.rows[0]?.id;

  if (!demoAccountId) {
    const createdAccount = await db.query<{ id: string }>(
      `
        INSERT INTO "DemoAccount" (
          "id", "userId", "accountName", "startingBalance", "currentBalance", "buyingPower", "equity", "realizedPnl", "unrealizedPnl", "totalTrades", "status", "createdAt", "updatedAt"
        )
        VALUES ($1, $2, $3, $4, $4, $4, $4, 0, 0, 0, 'ACTIVE', NOW(), NOW())
        RETURNING "id"
      `,
      [randomUUID(), userId, "Starter Demo", STARTER_BALANCE]
    );

    demoAccountId = createdAccount.rows[0]?.id;
  }

  if (!demoAccountId) {
    throw new Error("Failed to create demo account.");
  }

  await db.query(
    'UPDATE "User" SET "activeDemoAccountId" = COALESCE("activeDemoAccountId", $1), "updatedAt" = NOW() WHERE "id" = $2',
    [demoAccountId, userId]
  );

  const watchlistResult = await db.query<{ id: string }>(
    'SELECT "id" FROM "Watchlist" WHERE "userId" = $1 AND "isDefault" = TRUE LIMIT 1',
    [userId]
  );

  let watchlistId = watchlistResult.rows[0]?.id;

  if (!watchlistId) {
    const createdWatchlist = await db.query<{ id: string }>(
      `
        INSERT INTO "Watchlist" ("id", "userId", "demoAccountId", "name", "isDefault", "createdAt", "updatedAt")
        VALUES ($1, $2, $3, 'Core Futures', TRUE, NOW(), NOW())
        RETURNING "id"
      `,
      [randomUUID(), userId, demoAccountId]
    );

    watchlistId = createdWatchlist.rows[0]?.id;
  }

  if (!watchlistId) {
    throw new Error("Failed to create watchlist.");
  }

  const instrumentsResult = await db.query<{ id: string; symbol: string }>(
    'SELECT "id", "symbol" FROM "Instrument" WHERE "symbol" = ANY($1::text[]) ORDER BY array_position($1::text[], "symbol")',
    [DEFAULT_SYMBOLS]
  );

  for (const [sortOrder, instrument] of instrumentsResult.rows.entries()) {
    await db.query(
      `
        INSERT INTO "WatchlistItem" ("id", "watchlistId", "instrumentId", "sortOrder", "createdAt")
        VALUES ($1, $2, $3, $4, NOW())
        ON CONFLICT ("watchlistId", "instrumentId") DO NOTHING
      `,
      [randomUUID(), watchlistId, instrument.id, sortOrder]
    );
  }

  await db.query(
    `
      INSERT INTO "PriceTick" ("id", "instrumentId", "price", "changeAmount", "changePct", "source", "createdAt")
      SELECT
        CONCAT('seed-', LOWER(i."symbol")),
        i."id",
        i."defaultPrice",
        0,
        0,
        'seed',
        NOW()
      FROM "Instrument" i
      WHERE i."symbol" = ANY($1::text[])
        AND NOT EXISTS (
          SELECT 1
          FROM "PriceTick" pt
          WHERE pt."instrumentId" = i."id"
        )
    `,
    [DEFAULT_SYMBOLS]
  );

  await db.query(
    `
      INSERT INTO "AccountActivityLog" ("id", "userId", "demoAccountId", "type", "summary", "metadata", "createdAt")
      VALUES ($1, $2, $3, 'ACCOUNT_CREATED', 'Starter demo workspace created.', $4::jsonb, NOW())
      ON CONFLICT DO NOTHING
    `,
    [
      `demo-bootstrap-${userId}`,
      userId,
      demoAccountId,
      JSON.stringify({ source: "bootstrap", watchlistId })
    ]
  );

  return { demoAccountId, watchlistId };
}

export async function ensureDemoTradingWorkspaceForTradingAccount(input: {
  userId: string;
  tradingAccountId: string;
  accountName: string;
  startingBalance: number;
}) {
  const { watchlistId } = await ensureDemoTradingWorkspaceForUser(input.userId);
  const db = getDb();

  const existingResult = await db.query<{ id: string }>(
    'SELECT "id" FROM "DemoAccount" WHERE "tradingAccountId" = $1 LIMIT 1',
    [input.tradingAccountId]
  );
  let demoAccountId = existingResult.rows[0]?.id;

  if (!demoAccountId) {
    const created = await db.query<{ id: string }>(
      `
        INSERT INTO "DemoAccount" (
          "id", "userId", "tradingAccountId", "accountName", "startingBalance", "currentBalance", "buyingPower", "equity", "realizedPnl", "unrealizedPnl", "totalTrades", "status", "createdAt", "updatedAt"
        )
        VALUES ($1, $2, $3, $4, $5, $5, $5, $5, 0, 0, 0, 'ACTIVE', NOW(), NOW())
        RETURNING "id"
      `,
      [randomUUID(), input.userId, input.tradingAccountId, input.accountName, input.startingBalance]
    );

    demoAccountId = created.rows[0]?.id;
  }

  if (!demoAccountId) {
    throw new Error("Failed to create linked demo trading account.");
  }

  await db.query(
    'UPDATE "User" SET "activeDemoAccountId" = $1, "updatedAt" = NOW() WHERE "id" = $2',
    [demoAccountId, input.userId]
  );
  await db.query(
    'UPDATE "Watchlist" SET "demoAccountId" = COALESCE("demoAccountId", $1), "updatedAt" = NOW() WHERE "id" = $2',
    [demoAccountId, watchlistId]
  );

  await db.query(
    `
      INSERT INTO "AccountActivityLog" ("id", "userId", "demoAccountId", "type", "summary", "metadata", "createdAt")
      VALUES ($1, $2, $3, 'ACCOUNT_CREATED', $4, $5::jsonb, NOW())
      ON CONFLICT DO NOTHING
    `,
    [
      `linked-demo-bootstrap-${input.tradingAccountId}`,
      input.userId,
      demoAccountId,
      `Internal Phynic account created for ${input.accountName}.`,
      JSON.stringify({ source: "trading-account-link", tradingAccountId: input.tradingAccountId })
    ]
  );

  return { demoAccountId };
}
