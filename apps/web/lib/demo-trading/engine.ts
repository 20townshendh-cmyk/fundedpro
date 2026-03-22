"use server";

import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { getDb } from "@fundedpro/db";
import { syncTradingAccountFromDemoAccount } from "../internal-trading-sync";
import { getMaxContractsForBalance } from "./contracts";
import { assertDemoInstrumentMarketOpen } from "./market-hours";

const MARGIN_RATE = 0.1;
const LIVE_INGEST_FRESHNESS_MS = 3_000;

type LatestInstrumentRow = {
  instrumentId: string;
  symbol: string;
  tickSize: string;
  tickValue: string;
  defaultPrice: string;
  latestPrice: string | null;
  latestCreatedAt: Date | null;
  latestSource: string | null;
};

type OrderRow = {
  id: string;
  userId: string;
  demoAccountId: string;
  instrumentId: string;
  side: "BUY" | "SELL";
  type: "MARKET" | "LIMIT";
  status: "WORKING" | "FILLED" | "CANCELED" | "REJECTED";
  quantity: number;
  remainingQuantity: number;
  limitPrice: string | null;
};

type InstrumentMeta = {
  instrumentId: string;
  symbol: string;
  tickSize: string;
  tickValue: string;
  latestPrice: string;
};

function roundToTick(price: number, tickSize: number) {
  return Number((Math.round(price / tickSize) * tickSize).toFixed(6));
}

function getPointValue(tickSize: number, tickValue: number) {
  return tickValue / tickSize;
}

function getMarginRequirement(price: number, quantity: number, tickSize: number, tickValue: number) {
  return Number((price * getPointValue(tickSize, tickValue) * quantity * MARGIN_RATE).toFixed(2));
}

function getRealizedPnl(input: {
  positionSide: "LONG" | "SHORT";
  averageEntryPrice: number;
  fillPrice: number;
  quantity: number;
  tickSize: number;
  tickValue: number;
}) {
  const pointValue = getPointValue(input.tickSize, input.tickValue);
  const points =
    input.positionSide === "LONG"
      ? input.fillPrice - input.averageEntryPrice
      : input.averageEntryPrice - input.fillPrice;

  return Number((points * pointValue * input.quantity).toFixed(2));
}

async function logActivity(
  client: PoolClient,
  input: {
    userId: string;
    demoAccountId: string;
    type: string;
    summary: string;
    metadata?: unknown;
    orderId?: string | null;
    fillId?: string | null;
  }
) {
  await client.query(
    `
      INSERT INTO "AccountActivityLog" ("id", "userId", "demoAccountId", "orderId", "fillId", "type", "summary", "metadata", "createdAt")
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, NOW())
    `,
    [
      randomUUID(),
      input.userId,
      input.demoAccountId,
      input.orderId ?? null,
      input.fillId ?? null,
      input.type,
      input.summary,
      JSON.stringify(input.metadata ?? null)
    ]
  );
}

async function recalcDemoAccount(client: PoolClient, demoAccountId: string) {
  const accountResult = await client.query<{ startingBalance: string }>(
    'SELECT "startingBalance"::text FROM "DemoAccount" WHERE "id" = $1 LIMIT 1',
    [demoAccountId]
  );
  const account = accountResult.rows[0];

  if (!account) {
    return;
  }

  const positionRows = await client.query<{
    id: string;
    quantity: number;
    averageEntryPrice: string;
    side: "LONG" | "SHORT";
    tickSize: string;
    tickValue: string;
    latestPrice: string;
  }>(
    `
      SELECT
        p."id",
        p."quantity",
        p."averageEntryPrice"::text,
        p."side",
        i."tickSize"::text,
        i."tickValue"::text,
        COALESCE(pt."price"::text, i."defaultPrice"::text) AS "latestPrice"
      FROM "DemoPosition" p
      JOIN "Instrument" i ON i."id" = p."instrumentId"
      LEFT JOIN LATERAL (
        SELECT "price"
        FROM "PriceTick"
        WHERE "instrumentId" = i."id"
        ORDER BY "createdAt" DESC
        LIMIT 1
      ) pt ON TRUE
      WHERE p."demoAccountId" = $1
    `,
    [demoAccountId]
  );

  let unrealizedPnl = 0;
  let openMargin = 0;

  for (const row of positionRows.rows) {
    const averageEntryPrice = Number(row.averageEntryPrice);
    const latestPrice = Number(row.latestPrice);
    const tickSize = Number(row.tickSize);
    const tickValue = Number(row.tickValue);
    const quantity = row.quantity;
    const points =
      row.side === "LONG"
        ? latestPrice - averageEntryPrice
        : averageEntryPrice - latestPrice;
    const positionUnrealized = Number((points * getPointValue(tickSize, tickValue) * quantity).toFixed(2));
    unrealizedPnl += positionUnrealized;
    openMargin += getMarginRequirement(latestPrice, quantity, tickSize, tickValue);

    await client.query(
      'UPDATE "DemoPosition" SET "lastPrice" = $1, "unrealizedPnl" = $2, "updatedAt" = NOW() WHERE "id" = $3',
      [latestPrice, positionUnrealized, row.id]
    );
  }

  const realizedResult = await client.query<{ realized: string; trades: string }>(
    `
      SELECT
        COALESCE(SUM("realizedPnl"), 0)::text AS "realized",
        COUNT(*)::text AS "trades"
      FROM "DemoFill"
      WHERE "demoAccountId" = $1
    `,
    [demoAccountId]
  );
  const workingOrdersResult = await client.query<{
    quantity: number;
    latestPrice: string;
    tickSize: string;
    tickValue: string;
  }>(
    `
      SELECT
        GREATEST(o."remainingQuantity", o."quantity") AS "quantity",
        COALESCE(pt."price"::text, i."defaultPrice"::text) AS "latestPrice",
        i."tickSize"::text,
        i."tickValue"::text
      FROM "DemoOrder" o
      JOIN "Instrument" i ON i."id" = o."instrumentId"
      LEFT JOIN LATERAL (
        SELECT "price"
        FROM "PriceTick"
        WHERE "instrumentId" = i."id"
        ORDER BY "createdAt" DESC
        LIMIT 1
      ) pt ON TRUE
      WHERE o."demoAccountId" = $1 AND o."status" = 'WORKING'
    `,
    [demoAccountId]
  );

  const realizedPnl = Number(realizedResult.rows[0]?.realized ?? 0);
  const totalTrades = Number(realizedResult.rows[0]?.trades ?? 0);
  const workingMargin = workingOrdersResult.rows.reduce((sum, row) => (
    sum + getMarginRequirement(
      Number(row.latestPrice),
      row.quantity,
      Number(row.tickSize),
      Number(row.tickValue)
    )
  ), 0);
  const currentBalance = Number((Number(account.startingBalance) + realizedPnl).toFixed(2));
  const equity = Number((currentBalance + unrealizedPnl).toFixed(2));
  const buyingPower = Number(Math.max(0, equity - openMargin - workingMargin).toFixed(2));

  await client.query(
    `
      UPDATE "DemoAccount"
      SET
        "currentBalance" = $1,
        "equity" = $2,
        "buyingPower" = $3,
        "realizedPnl" = $4,
        "unrealizedPnl" = $5,
        "totalTrades" = $6,
        "updatedAt" = NOW()
      WHERE "id" = $7
    `,
    [currentBalance, equity, buyingPower, realizedPnl, unrealizedPnl, totalTrades, demoAccountId]
  );
}

export async function recalculateDemoAccountState(demoAccountId: string) {
  const pool = getDb();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await recalcDemoAccount(client, demoAccountId);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  await syncTradingAccountFromDemoAccount(demoAccountId);
}

async function applyFill(
  client: PoolClient,
  input: {
    order: OrderRow;
    instrument: InstrumentMeta;
    fillPrice: number;
  }
) {
  const positionResult = await client.query<{
    id: string;
    side: "LONG" | "SHORT";
    quantity: number;
    averageEntryPrice: string;
  }>(
    `
      SELECT "id", "side", "quantity", "averageEntryPrice"::text
      FROM "DemoPosition"
      WHERE "demoAccountId" = $1 AND "instrumentId" = $2
      LIMIT 1
    `,
    [input.order.demoAccountId, input.instrument.instrumentId]
  );

  const existingPosition = positionResult.rows[0];
  const quantity = input.order.remainingQuantity || input.order.quantity;
  const orderSide = input.order.side === "BUY" ? "LONG" : "SHORT";
  const tickSize = Number(input.instrument.tickSize);
  const tickValue = Number(input.instrument.tickValue);
  let realizedPnl = 0;

  if (!existingPosition) {
    await client.query(
      `
        INSERT INTO "DemoPosition" (
          "id", "userId", "demoAccountId", "instrumentId", "side", "quantity", "averageEntryPrice", "lastPrice", "realizedPnl", "unrealizedPnl", "openedAt", "createdAt", "updatedAt"
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $7, 0, 0, NOW(), NOW(), NOW())
      `,
      [
        randomUUID(),
        input.order.userId,
        input.order.demoAccountId,
        input.instrument.instrumentId,
        orderSide,
        quantity,
        input.fillPrice
      ]
    );
  } else if (existingPosition.side === orderSide) {
    const newQuantity = existingPosition.quantity + quantity;
    const nextAverage = Number(
      (
        ((Number(existingPosition.averageEntryPrice) * existingPosition.quantity) + (input.fillPrice * quantity)) /
        newQuantity
      ).toFixed(6)
    );

    await client.query(
      `
        UPDATE "DemoPosition"
        SET "quantity" = $1, "averageEntryPrice" = $2, "lastPrice" = $3, "updatedAt" = NOW()
        WHERE "id" = $4
      `,
      [newQuantity, nextAverage, input.fillPrice, existingPosition.id]
    );
  } else {
    const closingQuantity = Math.min(existingPosition.quantity, quantity);
    realizedPnl = getRealizedPnl({
      positionSide: existingPosition.side,
      averageEntryPrice: Number(existingPosition.averageEntryPrice),
      fillPrice: input.fillPrice,
      quantity: closingQuantity,
      tickSize,
      tickValue
    });

    const remainingPositionQuantity = existingPosition.quantity - closingQuantity;
    const leftoverOrderQuantity = quantity - closingQuantity;

    if (remainingPositionQuantity > 0) {
      await client.query(
        `
          UPDATE "DemoPosition"
          SET "quantity" = $1, "lastPrice" = $2, "updatedAt" = NOW()
          WHERE "id" = $3
        `,
        [remainingPositionQuantity, input.fillPrice, existingPosition.id]
      );
    } else if (leftoverOrderQuantity > 0) {
      await client.query(
        `
          UPDATE "DemoPosition"
          SET "side" = $1, "quantity" = $2, "averageEntryPrice" = $3, "lastPrice" = $3, "updatedAt" = NOW()
          WHERE "id" = $4
        `,
        [orderSide, leftoverOrderQuantity, input.fillPrice, existingPosition.id]
      );
    } else {
      await client.query('DELETE FROM "DemoPosition" WHERE "id" = $1', [existingPosition.id]);
    }
  }

  const fillId = randomUUID();

  await client.query(
    `
      INSERT INTO "DemoFill" ("id", "userId", "demoAccountId", "orderId", "instrumentId", "side", "quantity", "price", "realizedPnl", "filledAt", "createdAt")
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
    `,
    [
      fillId,
      input.order.userId,
      input.order.demoAccountId,
      input.order.id,
      input.instrument.instrumentId,
      input.order.side,
      quantity,
      input.fillPrice,
      realizedPnl
    ]
  );

  await client.query(
    `
      UPDATE "DemoOrder"
      SET
        "status" = 'FILLED',
        "submittedPrice" = COALESCE("submittedPrice", $1),
        "averageFillPrice" = $1,
        "filledQuantity" = $2,
        "remainingQuantity" = 0,
        "filledAt" = NOW(),
        "updatedAt" = NOW()
      WHERE "id" = $3
    `,
    [input.fillPrice, quantity, input.order.id]
  );

  await logActivity(client, {
    userId: input.order.userId,
    demoAccountId: input.order.demoAccountId,
    type: "ORDER_FILLED",
    summary: `${input.order.side} ${quantity} ${input.instrument.symbol} filled at ${input.fillPrice.toFixed(2)}.`,
    metadata: { orderId: input.order.id, symbol: input.instrument.symbol, quantity, realizedPnl },
    orderId: input.order.id,
    fillId
  });

  await recalcDemoAccount(client, input.order.demoAccountId);
}

async function getLatestInstrumentMap(client: PoolClient) {
  const result = await client.query<LatestInstrumentRow>(
    `
      SELECT
        i."id" AS "instrumentId",
        i."symbol",
        i."tickSize"::text,
        i."tickValue"::text,
        i."defaultPrice"::text,
        pt."price"::text AS "latestPrice",
        pt."createdAt" AS "latestCreatedAt",
        pt."source" AS "latestSource"
      FROM "Instrument" i
      LEFT JOIN LATERAL (
        SELECT "price", "createdAt", "source"
        FROM "PriceTick"
        WHERE "instrumentId" = i."id"
        ORDER BY "createdAt" DESC
        LIMIT 1
      ) pt ON TRUE
    `
  );

  return new Map(result.rows.map((row) => [
    row.instrumentId,
    {
      instrumentId: row.instrumentId,
      symbol: row.symbol,
      tickSize: row.tickSize,
      tickValue: row.tickValue,
      latestPrice: row.latestPrice ?? row.defaultPrice
    }
  ]));
}

export async function advanceDemoMarket() {
  const pool = getDb();
  const client = await pool.connect();
  const touchedDemoAccountIds = new Set<string>();

  try {
    await client.query("BEGIN");

    const instrumentsResult = await client.query<LatestInstrumentRow>(
      `
        SELECT
          i."id" AS "instrumentId",
          i."symbol",
          i."tickSize"::text,
          i."tickValue"::text,
          i."defaultPrice"::text,
          pt."price"::text AS "latestPrice",
          pt."createdAt" AS "latestCreatedAt",
          pt."source" AS "latestSource"
        FROM "Instrument" i
        LEFT JOIN LATERAL (
          SELECT "price", "createdAt", "source"
          FROM "PriceTick"
          WHERE "instrumentId" = i."id"
          ORDER BY "createdAt" DESC
          LIMIT 1
        ) pt ON TRUE
      `
    );

    const nextPrices = new Map<string, number>();

    for (const instrument of instrumentsResult.rows) {
      const tickSize = Number(instrument.tickSize);
      const current = Number(instrument.latestPrice ?? instrument.defaultPrice);
      const hasFreshLiveIngest =
        instrument.latestSource === "ninjatrader" &&
        instrument.latestCreatedAt != null &&
        Date.now() - instrument.latestCreatedAt.getTime() <= LIVE_INGEST_FRESHNESS_MS;

      if (hasFreshLiveIngest) {
        nextPrices.set(instrument.instrumentId, current);
        continue;
      }

      const maxDrift = Math.max(tickSize * 4, current * 0.002);
      const nextPrice = roundToTick(Math.max(tickSize, current + ((Math.random() - 0.5) * maxDrift)), tickSize);
      nextPrices.set(instrument.instrumentId, nextPrice);

      await client.query(
        `
          INSERT INTO "PriceTick" ("id", "instrumentId", "price", "changeAmount", "changePct", "source", "createdAt")
          VALUES ($1, $2, $3, $4, $5, 'simulated', NOW())
        `,
        [
          randomUUID(),
          instrument.instrumentId,
          nextPrice,
          Number((nextPrice - current).toFixed(6)),
          Number((((nextPrice - current) / Math.max(current, 1)) * 100).toFixed(4))
        ]
      );
    }

    const workingOrdersResult = await client.query<OrderRow>(
      `
        SELECT "id", "userId", "demoAccountId", "instrumentId", "side", "type", "status", "quantity", "remainingQuantity", "limitPrice"::text
        FROM "DemoOrder"
        WHERE "status" = 'WORKING' AND "type" = 'LIMIT'
        ORDER BY "createdAt" ASC
      `
    );

    const instrumentMap = await getLatestInstrumentMap(client);

    for (const order of workingOrdersResult.rows) {
      const instrument = instrumentMap.get(order.instrumentId);

      if (!instrument || !order.limitPrice) {
        continue;
      }

      const marketPrice = nextPrices.get(order.instrumentId) ?? Number(instrument.latestPrice);
      const shouldFill =
        (order.side === "BUY" && marketPrice <= Number(order.limitPrice)) ||
        (order.side === "SELL" && marketPrice >= Number(order.limitPrice));

      if (shouldFill) {
        await applyFill(client, {
          order,
          instrument,
          fillPrice: Number(order.limitPrice)
        });
        touchedDemoAccountIds.add(order.demoAccountId);
      }
    }

    const accountIdsResult = await client.query<{ demoAccountId: string }>(
      'SELECT DISTINCT "demoAccountId" FROM "DemoPosition" UNION SELECT DISTINCT "demoAccountId" FROM "DemoOrder"'
    );

    for (const row of accountIdsResult.rows) {
      await recalcDemoAccount(client, row.demoAccountId);
      touchedDemoAccountIds.add(row.demoAccountId);
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  for (const demoAccountId of touchedDemoAccountIds) {
    await syncTradingAccountFromDemoAccount(demoAccountId);
  }
}

export async function placeDemoOrder(input: {
  userId: string;
  demoAccountId: string;
  instrumentId: string;
  side: "BUY" | "SELL";
  type: "MARKET" | "LIMIT";
  quantity: number;
  limitPrice?: number | null;
}) {
  const pool = getDb();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const [accountResult, instrumentResult, exposureResult, existingPositionResult] = await Promise.all([
      client.query<{ id: string; buyingPower: string; startingBalance: string; accountState: string | null }>(
        `
          SELECT da."id", da."buyingPower"::text, da."startingBalance"::text, ta."accountState"::text
          FROM "DemoAccount" da
          LEFT JOIN "TradingAccount" ta ON ta."id" = da."tradingAccountId"
          WHERE da."id" = $1 AND da."userId" = $2
          LIMIT 1
        `,
        [input.demoAccountId, input.userId]
      ),
      client.query<InstrumentMeta>(
        `
          SELECT
            i."id" AS "instrumentId",
            i."symbol",
            i."tickSize"::text,
            i."tickValue"::text,
            COALESCE(pt."price"::text, i."defaultPrice"::text) AS "latestPrice"
          FROM "Instrument" i
          LEFT JOIN LATERAL (
            SELECT "price"
            FROM "PriceTick"
            WHERE "instrumentId" = i."id"
            ORDER BY "createdAt" DESC
            LIMIT 1
          ) pt ON TRUE
          WHERE i."id" = $1
          LIMIT 1
        `,
        [input.instrumentId]
      ),
      client.query<{ openContracts: string }>(
        `
          SELECT (
            COALESCE((SELECT SUM(ABS("quantity")) FROM "DemoPosition" WHERE "demoAccountId" = $1), 0) +
            COALESCE((SELECT SUM(GREATEST("remainingQuantity", "quantity")) FROM "DemoOrder" WHERE "demoAccountId" = $1 AND "status" = 'WORKING'), 0)
          )::text AS "openContracts"
        `,
        [input.demoAccountId]
      ),
      client.query<{ side: "LONG" | "SHORT"; quantity: number }>(
        `
          SELECT "side", "quantity"
          FROM "DemoPosition"
          WHERE "demoAccountId" = $1 AND "instrumentId" = $2
          LIMIT 1
        `,
        [input.demoAccountId, input.instrumentId]
      )
    ]);

    const account = accountResult.rows[0];
    const instrument = instrumentResult.rows[0];

    if (!instrument) {
      throw new Error("Account or instrument not found.");
    }

    if (!account) {
      throw new Error("Account or instrument not found.");
    }

    if (account.accountState === "BREACHED") {
      throw new Error("ACCOUNT_BREACHED");
    }

    assertDemoInstrumentMarketOpen(instrument.symbol);

      const maxContracts = getMaxContractsForBalance(Number(account.startingBalance));
      const openContracts = Number(exposureResult.rows[0]?.openContracts ?? 0);
      const existingPosition = existingPositionResult.rows[0];
      const incomingSide = input.side === "BUY" ? "LONG" : "SHORT";
      const increasingOppositeExposure = existingPosition && existingPosition.side !== incomingSide
        ? Math.max(0, input.quantity - existingPosition.quantity)
        : input.quantity;
      const additionalContracts =
        existingPosition && existingPosition.side !== incomingSide
          ? Math.max(0, input.quantity - existingPosition.quantity)
          : input.quantity;

    if (openContracts + additionalContracts > maxContracts) {
      throw new Error("Order exceeds max contracts for account size.");
    }

      const referencePrice = input.type === "LIMIT" ? Number(input.limitPrice) : Number(instrument.latestPrice);
      const marginRequired = getMarginRequirement(referencePrice, increasingOppositeExposure, Number(instrument.tickSize), Number(instrument.tickValue));

      if (increasingOppositeExposure > 0 && marginRequired > Number(account.buyingPower)) {
        throw new Error("Order exceeds buying power.");
      }

    const orderId = randomUUID();
    const remainingQuantity = input.quantity;

    await client.query(
      `
        INSERT INTO "DemoOrder" (
          "id", "userId", "demoAccountId", "instrumentId", "side", "type", "status", "quantity", "limitPrice", "submittedPrice", "filledQuantity", "remainingQuantity", "submittedAt", "createdAt", "updatedAt"
        )
        VALUES ($1, $2, $3, $4, $5, $6, 'WORKING', $7, $8, $9, 0, $7, NOW(), NOW(), NOW())
      `,
      [
        orderId,
        input.userId,
        input.demoAccountId,
        input.instrumentId,
        input.side,
        input.type,
        input.quantity,
        input.limitPrice ?? null,
        instrument.latestPrice
      ]
    );

    await logActivity(client, {
      userId: input.userId,
      demoAccountId: input.demoAccountId,
      type: "ORDER_SUBMITTED",
      summary: `${input.side} ${input.quantity} ${instrument.symbol} ${input.type.toLowerCase()} order submitted.`,
      metadata: { symbol: instrument.symbol, type: input.type, quantity: input.quantity, limitPrice: input.limitPrice ?? null },
      orderId
    });

    const marketPrice = Number(instrument.latestPrice);
    const shouldFillImmediately =
      input.type === "MARKET" ||
      (input.side === "BUY" && input.limitPrice != null && marketPrice <= input.limitPrice) ||
      (input.side === "SELL" && input.limitPrice != null && marketPrice >= input.limitPrice);

    if (shouldFillImmediately) {
      await applyFill(client, {
        order: {
          id: orderId,
          userId: input.userId,
          demoAccountId: input.demoAccountId,
          instrumentId: input.instrumentId,
          side: input.side,
          type: input.type,
          status: "WORKING",
          quantity: input.quantity,
          remainingQuantity,
          limitPrice: input.limitPrice != null ? String(input.limitPrice) : null
        },
        instrument,
        fillPrice: input.type === "MARKET" ? marketPrice : Number(input.limitPrice)
      });
    } else {
      await recalcDemoAccount(client, input.demoAccountId);
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  await syncTradingAccountFromDemoAccount(input.demoAccountId);
}
