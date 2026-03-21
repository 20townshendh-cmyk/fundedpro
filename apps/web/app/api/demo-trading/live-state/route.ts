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
  const liveState = await getDemoTradingLiveState(session.userId, accountId ? { accountId } : undefined);

  return NextResponse.json(
    liveState,
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate"
      }
    }
  );
}
