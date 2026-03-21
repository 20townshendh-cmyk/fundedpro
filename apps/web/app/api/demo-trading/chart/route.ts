import { NextResponse } from "next/server";
import { getChartFeed } from "../../../../lib/market-data";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const symbol = searchParams.get("symbol") || "ES";
  const timeframe = searchParams.get("timeframe") || "5m";

  try {
    const data = await getChartFeed({ symbol, timeframe });
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch data" },
      { status: 500 }
    );
  }
}
