import { randomUUID } from "node:crypto";
import { getDb } from "@fundedpro/db";
import { z } from "zod";
import { buildCandlesFromTicks, type DemoCandle } from "./demo-trading/chart";
import { getDelayedSnapshot, supportsDelayedChartSymbol, type ChartTimeframe } from "./demo-trading/delayed-feed";

const timeframeToIntervalSeconds: Record<ChartTimeframe, number> = {
  "1m": 60,
  "5m": 300,
  "15m": 900,
  "1h": 3600,
  "1d": 86400,
  "1w": 604800
};

export const ninjaTraderTickSchema = z.object({
  symbol: z.string().trim().min(1).max(32),
  price: z.coerce.number().positive(),
  timestamp: z.coerce.date().optional()
});

export const ninjaTraderTickBatchSchema = z.object({
  ticks: z.array(ninjaTraderTickSchema).min(1).max(500)
});

function getTimeframe(timeframe?: string): ChartTimeframe {
  if (timeframe && timeframe in timeframeToIntervalSeconds) {
    return timeframe as ChartTimeframe;
  }

  return "5m";
}

function getIntervalSeconds(timeframe?: string) {
  return timeframeToIntervalSeconds[getTimeframe(timeframe)];
}

export async function getChartFeed(input: {
  symbol: string;
  timeframe?: string;
}): Promise<{ candles: DemoCandle[]; lastPrice: number; source: "INTERNAL" | "DELAYED_EXTERNAL" | "EMPTY" }> {
  const timeframe = getTimeframe(input.timeframe);
  const db = getDb();

  if (supportsDelayedChartSymbol(input.symbol)) {
    const delayed = await getDelayedSnapshot(input.symbol, timeframe);

    if (delayed?.candles.length) {
      return {
        candles: delayed.candles,
        lastPrice: delayed.price,
        source: "DELAYED_EXTERNAL"
      };
    }
  }

  const instrumentResult = await db.query<{ instrumentId: string }>(
    `
      SELECT "id" AS "instrumentId"
      FROM "Instrument"
      WHERE "symbol" = $1
      LIMIT 1
    `,
    [input.symbol]
  );
  const instrument = instrumentResult.rows[0];

  if (instrument) {
    const ticksResult = await db.query<{ price: string; createdAt: Date }>(
      `
        SELECT "price"::text, "createdAt"
        FROM "PriceTick"
        WHERE "instrumentId" = $1
        ORDER BY "createdAt" DESC
        LIMIT 1200
      `,
      [instrument.instrumentId]
    );
    const ticks = ticksResult.rows.slice().reverse();

    if (ticks.length) {
      const candles = buildCandlesFromTicks(ticks, getIntervalSeconds(timeframe));
      const lastPrice = Number(ticks[ticks.length - 1]?.price ?? 0);

      if (candles.length && Number.isFinite(lastPrice)) {
        return {
          candles,
          lastPrice,
          source: "INTERNAL"
        };
      }
    }
  }

  const delayed = supportsDelayedChartSymbol(input.symbol)
    ? await getDelayedSnapshot(input.symbol, timeframe)
    : null;

  if (delayed?.candles.length) {
    return {
      candles: delayed.candles,
      lastPrice: delayed.price,
      source: "DELAYED_EXTERNAL"
    };
  }

  return {
    candles: [],
    lastPrice: 0,
    source: "EMPTY"
  };
}

export async function persistNinjaTraderTicks(input: {
  ticks: Array<{ symbol: string; price: number; timestamp?: Date }>;
}) {
  const db = getDb();
  const symbols = [...new Set(input.ticks.map((tick) => tick.symbol.trim().toUpperCase()))];
  const instrumentsResult = await db.query<{ instrumentId: string; symbol: string }>(
    `
      SELECT "id" AS "instrumentId", "symbol"
      FROM "Instrument"
      WHERE "symbol" = ANY($1::text[])
    `,
    [symbols]
  );
  const instrumentMap = new Map(
    instrumentsResult.rows.map((row) => [row.symbol.toUpperCase(), row.instrumentId])
  );

  let inserted = 0;
  let skipped = 0;

  for (const tick of input.ticks) {
    const symbol = tick.symbol.trim().toUpperCase();
    const instrumentId = instrumentMap.get(symbol);

    if (!instrumentId) {
      skipped += 1;
      continue;
    }

    const previousResult = await db.query<{ price: string }>(
      `
        SELECT "price"::text
        FROM "PriceTick"
        WHERE "instrumentId" = $1
        ORDER BY "createdAt" DESC
        LIMIT 1
      `,
      [instrumentId]
    );
    const previousPrice = Number(previousResult.rows[0]?.price ?? tick.price);
    const changeAmount = Number((tick.price - previousPrice).toFixed(6));
    const changePct = Number((((tick.price - previousPrice) / Math.max(previousPrice, 1)) * 100).toFixed(4));

    await db.query(
      `
        INSERT INTO "PriceTick" ("id", "instrumentId", "price", "changeAmount", "changePct", "source", "createdAt")
        VALUES ($1, $2, $3, $4, $5, 'ninjatrader', $6)
      `,
      [
        randomUUID(),
        instrumentId,
        tick.price,
        changeAmount,
        changePct,
        tick.timestamp ?? new Date()
      ]
    );

    inserted += 1;
  }

  return { inserted, skipped };
}
