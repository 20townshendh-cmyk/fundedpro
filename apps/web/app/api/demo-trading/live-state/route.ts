import { NextResponse } from "next/server";
import { getSession } from "../../../../lib/auth";
import { getDemoTradingLiveState } from "../../../../lib/demo-trading/service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const accountId = searchParams.get("accountId") ?? undefined;
  const symbol = searchParams.get("symbol") ?? undefined;
  const search =
    accountId || symbol
      ? {
          ...(accountId ? { accountId } : {}),
          ...(symbol ? { symbol } : {})
        }
      : undefined;
  const liveState = await getDemoTradingLiveState(session.userId, search);

  return NextResponse.json(
    liveState,
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate"
      }
    }
  );
}
