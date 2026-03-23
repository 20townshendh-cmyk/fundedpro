import { beforeEach, describe, expect, it, vi } from "vitest";

const query = vi.fn();
const getDelayedSnapshot = vi.fn();

vi.mock("@fundedpro/db", () => ({
  getDb: () => ({ query })
}));

vi.mock("../lib/demo-trading/delayed-feed", () => ({
  getDelayedSnapshot,
  supportsDelayedChartSymbol: (symbol: string) => symbol === "ES" || symbol === "NQ"
}));

const { getChartFeed, persistNinjaTraderTicks } = await import("../lib/market-data");

describe("market data", () => {
  beforeEach(() => {
    query.mockReset();
    getDelayedSnapshot.mockReset();
  });

  it("returns internal candles when price ticks exist", async () => {
    query
      .mockResolvedValueOnce({
        rows: [{ instrumentId: "inst-1" }]
      })
      .mockResolvedValueOnce({
        rows: [
          { price: "5001.00", createdAt: new Date("2026-03-20T10:01:00.000Z") },
          { price: "5000.00", createdAt: new Date("2026-03-20T10:00:00.000Z") }
        ]
      });

    const result = await getChartFeed({ symbol: "BTC", timeframe: "1m" });

    expect(result.source).toBe("INTERNAL");
    expect(result.lastPrice).toBe(5001);
    expect(result.candles).toHaveLength(2);
    expect(getDelayedSnapshot).not.toHaveBeenCalled();
  });

  it("uses deeper delayed history for higher timeframes while keeping internal live price", async () => {
    query
      .mockResolvedValueOnce({
        rows: [{ instrumentId: "inst-1" }]
      })
      .mockResolvedValueOnce({
        rows: [
          { price: "5200.00", createdAt: new Date("2026-03-20T10:00:00.000Z"), source: "simulated" },
          { price: "5205.00", createdAt: new Date("2026-03-21T10:00:00.000Z"), source: "simulated" }
        ]
      });

    getDelayedSnapshot.mockResolvedValueOnce({
      symbol: "ES",
      price: 5000,
      changeAmount: 10,
      changePct: 0.2,
      candles: Array.from({ length: 300 }, (_, index) => ({
        time: index + 1,
        open: 1,
        high: 2,
        low: 1,
        close: 2,
        volume: 10
      }))
    });

    const result = await getChartFeed({ symbol: "ES", timeframe: "1d" });

    expect(result.source).toBe("HYBRID");
    expect(result.lastPrice).toBe(5205);
    expect(result.tickSource).toBe("simulated");
    expect(result.candles).toHaveLength(300);
  });

  it("prefers delayed external data for supported chart symbols", async () => {
    query
      .mockResolvedValueOnce({
        rows: [{ instrumentId: "inst-1" }]
      })
      .mockResolvedValueOnce({
        rows: []
      });
    getDelayedSnapshot.mockResolvedValueOnce({
      symbol: "ES",
      price: 5010,
      changeAmount: 10,
      changePct: 0.2,
      candles: [{ time: 1, open: 1, high: 2, low: 1, close: 2, volume: 10 }]
    });

    const result = await getChartFeed({ symbol: "ES", timeframe: "5m" });

    expect(result.source).toBe("DELAYED_EXTERNAL");
    expect(result.lastPrice).toBe(5010);
    expect(result.candles).toHaveLength(1);
    expect(query).toHaveBeenCalledTimes(0);
  });

  it("writes NinjaTrader ticks with normalized source values", async () => {
    query
      .mockResolvedValueOnce({
        rows: [{ instrumentId: "inst-1", symbol: "ES" }]
      })
      .mockResolvedValueOnce({
        rows: [{ price: "5000.00" }]
      })
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: []
      });

    const result = await persistNinjaTraderTicks({
      ticks: [{ symbol: "ES", price: 5001.25, timestamp: new Date("2026-03-20T10:00:00.000Z") }]
    });

    expect(result).toEqual({ inserted: 1, skipped: 0 });
    expect(query).toHaveBeenCalledTimes(3);
    expect(query.mock.calls[2]?.[1]?.[3]).toBe(1.25);
    expect(query.mock.calls[2]?.[1]?.[4]).toBe(0.025);
  });
});
