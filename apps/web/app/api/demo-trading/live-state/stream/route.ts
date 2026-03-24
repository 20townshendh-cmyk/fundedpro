import { getSession } from "../../../../../lib/auth";
import { getDemoTradingLiveState } from "../../../../../lib/demo-trading/service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const STREAM_INTERVAL_MS = 100;
const encoder = new TextEncoder();

export async function GET(request: Request) {
  const session = await getSession();

  if (!session) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }

  const { searchParams } = new URL(request.url);
  const accountId = searchParams.get("accountId") ?? undefined;
  const symbol = searchParams.get("symbol") ?? undefined;

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;

      const push = async () => {
        if (closed) {
          return;
        }

        try {
          const liveState = await getDemoTradingLiveState(
            session.userId,
            accountId || symbol
              ? {
                  ...(accountId ? { accountId } : {}),
                  ...(symbol ? { symbol } : {})
                }
              : undefined
          );
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(liveState)}\n\n`));
        } catch {
          controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify({ error: "stream-failed" })}\n\n`));
        }
      };

      await push();
      const interval = setInterval(() => {
        void push();
      }, STREAM_INTERVAL_MS);

      request.signal.addEventListener("abort", () => {
        closed = true;
        clearInterval(interval);
        controller.close();
      });
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-store, no-cache, must-revalidate",
      Connection: "keep-alive"
    }
  });
}
