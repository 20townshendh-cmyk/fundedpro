import { NextResponse } from "next/server";
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
