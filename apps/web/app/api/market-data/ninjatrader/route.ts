import { NextResponse } from "next/server";
import { getDb } from "@fundedpro/db";
import { getWebEnv } from "../../../../lib/env";
import { ninjaTraderTickBatchSchema, persistNinjaTraderTicks } from "../../../../lib/market-data";

function isAuthorized(request: Request) {
  const token = getWebEnv().ninjaTraderIngestToken;

  if (!token) {
    return false;
  }

  const authHeader = request.headers.get("authorization");
  return authHeader === `Bearer ${token}`;
}

export async function GET() {
  const env = getWebEnv();

  if (!env.ninjaTraderIngestToken) {
    return NextResponse.json({
      configured: false,
      status: "missing-token"
    });
  }

  const db = getDb();
  const latestTicks = await db.query<{
    symbol: string;
    price: string;
    source: string;
    createdAt: Date;
  }>(
    `
      SELECT DISTINCT ON (i."symbol")
        i."symbol",
        pt."price"::text AS "price",
        pt."source",
        pt."createdAt"
      FROM "PriceTick" pt
      JOIN "Instrument" i ON i."id" = pt."instrumentId"
      WHERE i."symbol" IN ('ES', 'NQ')
      ORDER BY i."symbol", pt."createdAt" DESC
    `
  );

  return NextResponse.json({
    configured: true,
    status: "ready",
    symbols: latestTicks.rows.map((row) => ({
      symbol: row.symbol,
      price: row.price,
      source: row.source,
      createdAt: row.createdAt.toISOString()
    }))
  });
}

export async function POST(request: Request) {
  if (!getWebEnv().ninjaTraderIngestToken) {
    return NextResponse.json({ error: "ninjatrader-ingest-not-configured" }, { status: 503 });
  }

  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = ninjaTraderTickBatchSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "invalid-request" }, { status: 400 });
  }

  const result = await persistNinjaTraderTicks({
    ticks: parsed.data.ticks.map((tick) => ({
      symbol: tick.symbol,
      price: tick.price,
      ...(tick.timestamp ? { timestamp: tick.timestamp } : {})
    }))
  });

  return NextResponse.json({
    ok: true,
    ...result
  });
}
