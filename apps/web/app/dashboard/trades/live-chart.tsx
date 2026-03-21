"use client";

import { startTransition, useEffect, useRef, useState } from "react";
import {
  createChart,
  ColorType,
  type CandlestickData,
  type UTCTimestamp,
  CandlestickSeries,
  LineStyle,
  type IChartApi,
  type ISeriesApi,
  type IPriceLine
} from "lightweight-charts";
import type { DemoCandle } from "../../../lib/demo-trading/chart";
import type { ChartTimeframe } from "../../../lib/demo-trading/delayed-feed";

type LiveChartProps = {
  symbol: string;
  initialCandles: DemoCandle[];
  lastPrice: number;
  change: number;
  linkedSymbols: string[];
  initialTimeframe: Timeframe;
  compact?: boolean;
  showLinkedSymbols?: boolean;
  baseQuery?: string;
};

type Timeframe = ChartTimeframe;

const timeframeOptions: Timeframe[] = ["1m", "5m", "15m", "1h", "1d", "1w"];

export function LiveChart({ symbol, initialCandles, lastPrice, change, linkedSymbols, initialTimeframe, compact = false, showLinkedSymbols = true, baseQuery = "" }: LiveChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const priceLineRef = useRef<IPriceLine | null>(null);
  const currentPriceRef = useRef(lastPrice);
  const [activeSymbol, setActiveSymbol] = useState(symbol);
  const [timeframe, setTimeframe] = useState<Timeframe>(initialTimeframe);
  const [currentPrice, setCurrentPrice] = useState(lastPrice);
  const [currentChange, setCurrentChange] = useState(change);
  const [isLoading, setIsLoading] = useState(false);

  function normalizeCandles(candles: DemoCandle[]) {
    return [...candles]
      .sort((left, right) => left.time - right.time)
      .filter((candle, index, array) => index === array.findLastIndex((entry) => entry.time === candle.time));
  }

  function toCandleData(candles: DemoCandle[]): CandlestickData[] {
    return normalizeCandles(candles).map((candle) => ({
      time: candle.time as UTCTimestamp,
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close
    }));
  }

  useEffect(() => {
    const container = containerRef.current;

    if (!container) {
      return;
    }

    const chart = createChart(container, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "#060708" },
        textColor: "#cbd5e1",
        fontFamily: "Aptos, Segoe UI, sans-serif"
      },
      grid: {
        vertLines: { color: "rgba(148, 163, 184, 0.12)" },
        horzLines: { color: "rgba(148, 163, 184, 0.12)" }
      },
      rightPriceScale: {
        borderColor: "rgba(96, 165, 250, 0.38)",
        entireTextOnly: true
      },
      timeScale: {
        borderColor: "rgba(148, 163, 184, 0.18)",
        timeVisible: true,
        secondsVisible: !compact && (initialTimeframe === "1m" || initialTimeframe === "5m")
      },
      crosshair: {
        vertLine: { color: "rgba(226, 232, 240, 0.35)" },
        horzLine: { color: "rgba(226, 232, 240, 0.35)" }
      }
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#16a34a",
      downColor: "#ef4444",
      borderVisible: false,
      wickUpColor: "#22c55e",
      wickDownColor: "#f43f5e",
      lastValueVisible: true,
      priceLineVisible: false
    });

    series.setData(toCandleData(initialCandles));
    priceLineRef.current = series.createPriceLine({
      price: lastPrice,
      color: change >= 0 ? "#16a34a" : "#ef4444",
      lineWidth: 2,
      lineStyle: LineStyle.Solid,
      axisLabelVisible: true,
      title: "Last"
    });
    chart.timeScale().fitContent();

    chartRef.current = chart;
    seriesRef.current = series;

    return () => {
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      priceLineRef.current = null;
    };
  }, []);

  useEffect(() => {
    chartRef.current?.applyOptions({
      timeScale: {
        timeVisible: true,
        secondsVisible: !compact && (timeframe === "1m" || timeframe === "5m")
      }
    });
  }, [compact, timeframe]);

  useEffect(() => {
    const series = seriesRef.current;

    if (!series) {
      return;
    }

    series.setData(toCandleData(initialCandles));
    chartRef.current?.timeScale().fitContent();
    setCurrentPrice(lastPrice);
    currentPriceRef.current = lastPrice;
    setCurrentChange(change);
    if (initialTimeframe !== timeframe) {
      setTimeframe(initialTimeframe);
    }
    if (symbol !== activeSymbol) {
      setActiveSymbol(symbol);
    }
  }, [initialCandles, symbol, lastPrice, change, initialTimeframe]);

  useEffect(() => {
    if (!seriesRef.current) {
      return;
    }

    if (priceLineRef.current) {
      seriesRef.current.removePriceLine(priceLineRef.current);
    }

    priceLineRef.current = seriesRef.current.createPriceLine({
      price: currentPrice,
      color: currentChange >= 0 ? "#16a34a" : "#ef4444",
      lineWidth: 2,
      lineStyle: LineStyle.Solid,
      axisLabelVisible: true,
      title: "Last"
    });
  }, [currentPrice, currentChange]);

  useEffect(() => {
    let cancelled = false;
    let inFlight = false;
    let timeoutId: number | null = null;

    async function refresh() {
      if (cancelled || inFlight) {
        return;
      }

      inFlight = true;
      setIsLoading(true);

      try {
        const response = await fetch(`/api/demo-trading/chart?symbol=${encodeURIComponent(activeSymbol)}&timeframe=${encodeURIComponent(timeframe)}`, { cache: "no-store" });

        if (!response.ok || cancelled) {
          return;
        }

        const data = await response.json() as { candles: DemoCandle[]; lastPrice: number };

        if (cancelled || !seriesRef.current) {
          return;
        }

        seriesRef.current.setData(toCandleData(data.candles));
        setCurrentChange(data.lastPrice - currentPriceRef.current);
        currentPriceRef.current = data.lastPrice;
        setCurrentPrice(data.lastPrice);
      } finally {
        inFlight = false;
        if (!cancelled) {
          setIsLoading(false);
        }

        if (!cancelled) {
          timeoutId = window.setTimeout(() => {
            void refresh();
          }, 2500);
        }
      }
    }

    void refresh();

    return () => {
      cancelled = true;
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [activeSymbol, timeframe]);

  return (
    <div className="trade-chart-live">
      <div className="trade-chart-live-head">
        <div className="trade-chart-live-meta">
          {showLinkedSymbols ? (
            <div className="trade-chart-timeframes">
              {linkedSymbols.map((linkedSymbol) => (
                <button
                  key={linkedSymbol}
                  type="button"
                  className={`trade-chip trade-symbol-chip${linkedSymbol === activeSymbol ? " active" : ""}`}
                  onClick={() => {
                    if (linkedSymbol === activeSymbol) return;
                    startTransition(() => {
                      setActiveSymbol(linkedSymbol);
                    });
                  }}
                >
                  {linkedSymbol}
                </button>
              ))}
            </div>
          ) : (
            <div className="trade-chart-symbol-label">{activeSymbol}</div>
          )}
          <div className="trade-chart-timeframes">
            {timeframeOptions.map((option) => (
              <button
                key={option}
                type="button"
                className={`trade-chip${option === timeframe ? " active" : ""}`}
                onClick={() => {
                  if (option === timeframe) return;
                  startTransition(() => {
                    setTimeframe(option);
                  });
                }}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
        <div className="trade-chart-live-price">
          {isLoading ? <span className="trade-data-badge delayed">Loading</span> : null}
          <strong>{currentPrice.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
          <span className={currentChange >= 0 ? "positive" : "negative"}>
            {currentChange.toLocaleString("en-US", { signDisplay: "always", minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
      </div>
      <div ref={containerRef} className="trade-chart-canvas" />
    </div>
  );
}
