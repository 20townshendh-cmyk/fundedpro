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

const timeframeHistoryConfig: Record<ChartTimeframe, { maxTicks: number; lookbackDays: number }> = {
  "1m": { maxTicks: 200000, lookbackDays: 365 },
  "5m": { maxTicks: 80000, lookbackDays: 365 },
  "15m": { maxTicks: 60000, lookbackDays: 365 },
  "1h": { maxTicks: 35000, lookbackDays: 730 },
  "1d": { maxTicks: 12000, lookbackDays: 1095 },
  "1w": { maxTicks: 12000, lookbackDays: 1095 }
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

function getHistoryConfig(timeframe?: string) {
  return timeframeHistoryConfig[getTimeframe(timeframe)];
}

function shouldPreferDeeperHistory(timeframe: ChartTimeframe, candleCount: number) {
  switch (timeframe) {
    case "5m":
      return candleCount < 1200;
    case "15m":
      return candleCount < 900;
    case "1h":
      return candleCount < 240;
    case "1d":
      return candleCount < 180;
    case "1w":
      return candleCount < 104;
    default:
      return false;
  }
}

export async function getChartFeed(input: {
  symbol: string;
  timeframe?: string;
}): Promise<{
  candles: DemoCandle[];
  lastPrice: number;
  source: "INTERNAL" | "DELAYED_EXTERNAL" | "HYBRID" | "EMPTY";
  tickSource: "ninjatrader" | "simulated" | null;
  lastTickAt: string | null;
}> {
  const timeframe = getTimeframe(input.timeframe);
  const historyConfig = getHistoryConfig(timeframe);
  const db = getDb();

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
    const ticksResult = await db.query<{ price: string; createdAt: Date; source: string }>(
      `
        SELECT "price"::text, "createdAt", "source"
        FROM "PriceTick"
        WHERE "instrumentId" = $1
          AND "createdAt" >= $2
        ORDER BY "createdAt" DESC
        LIMIT $3
      `,
      [
        instrument.instrumentId,
        new Date(Date.now() - historyConfig.lookbackDays * 24 * 60 * 60 * 1000),
        historyConfig.maxTicks
      ]
    );
    const ticks = ticksResult.rows.slice().reverse();

    if (ticks.length) {
      const candles = buildCandlesFromTicks(ticks, getIntervalSeconds(timeframe));
      const lastPrice = Number(ticks[ticks.length - 1]?.price ?? 0);
      const lastTickSource =
        ticks[ticks.length - 1]?.source === "ninjatrader"
          ? "ninjatrader"
          : ticks[ticks.length - 1]?.source === "simulated"
            ? "simulated"
            : null;
      const lastTickAt = ticks[ticks.length - 1]?.createdAt?.toISOString() ?? null;

      if (candles.length && Number.isFinite(lastPrice)) {
        const delayed =
          supportsDelayedChartSymbol(input.symbol) && shouldPreferDeeperHistory(timeframe, candles.length)
            ? await getDelayedSnapshot(input.symbol, timeframe)
            : null;

        if (delayed?.candles.length && delayed.candles.length > candles.length) {
          return {
            candles: delayed.candles,
            lastPrice,
            source: "HYBRID",
            tickSource: lastTickSource,
            lastTickAt
          };
        }

        return {
          candles,
          lastPrice,
          source: "INTERNAL",
          tickSource: lastTickSource,
          lastTickAt
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
      source: "DELAYED_EXTERNAL",
      tickSource: null,
      lastTickAt: null
    };
  }

  return {
    candles: [],
    lastPrice: 0,
    source: "EMPTY",
    tickSource: null,
    lastTickAt: null
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
