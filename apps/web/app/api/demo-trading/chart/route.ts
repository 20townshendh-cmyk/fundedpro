import { NextResponse } from "next/server";
import { advanceDemoMarket } from "../../../../lib/demo-trading/engine";
import { getChartFeed } from "../../../../lib/market-data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const symbol = searchParams.get("symbol") || "ES";
  const timeframe = searchParams.get("timeframe") || "5m";

  try {
    await advanceDemoMarket();
    const data = await getChartFeed({ symbol, timeframe });
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate"
      }
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch data" },
      { status: 500 }
    );
  }
}
