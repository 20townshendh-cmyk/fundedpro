import { getChartFeed } from "../../../../../lib/market-data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const STREAM_INTERVAL_MS = 150;
const encoder = new TextEncoder();

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const symbol = searchParams.get("symbol") || "ES";
  const timeframe = searchParams.get("timeframe") || "5m";

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;

      const push = async () => {
        if (closed) {
          return;
        }

        try {
          const data = await getChartFeed({ symbol, timeframe });
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify({ error: "stream-failed" })}\n\n`));
        }
      };

      await push();
      const interval = setInterval(() => {
        void push();
      }, STREAM_INTERVAL_MS);

      req.signal.addEventListener("abort", () => {
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
