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
import { submitDemoOrderAction } from "../../../lib/demo-trading/actions";
import type { DemoCandle } from "../../../lib/demo-trading/chart";
import type { ChartTimeframe } from "../../../lib/demo-trading/delayed-feed";
import { useTradeLiveContext } from "./trade-live-context";
import { TRADE_LIVE_REFRESH_EVENT, emitTradeLiveRefresh } from "./trade-live-events";

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
  demoAccountId?: string | undefined;
  accountId?: string | undefined;
  layout?: string | undefined;
  instruments?: Array<{ symbol: string; instrumentId: string }> | undefined;
};

type Timeframe = ChartTimeframe;

const timeframeOptions: Timeframe[] = ["1m", "5m", "15m", "1h", "1d", "1w"];

export function LiveChart({
  symbol,
  initialCandles,
  lastPrice,
  change,
  linkedSymbols,
  initialTimeframe,
  compact = false,
  showLinkedSymbols = true,
  baseQuery = "",
  demoAccountId,
  accountId,
  layout = "focus",
  instruments = []
}: LiveChartProps) {
  const live = useTradeLiveContext();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const priceLineRef = useRef<IPriceLine | null>(null);
  const currentPriceRef = useRef(lastPrice);
  const viewportKeyRef = useRef(`${symbol}:${initialTimeframe}`);
  const triggerLockRef = useRef<"tp" | "sl" | null>(null);
  const [activeSymbol, setActiveSymbol] = useState(symbol);
  const [timeframe, setTimeframe] = useState<Timeframe>(initialTimeframe);
  const [currentPrice, setCurrentPrice] = useState(lastPrice);
  const [currentChange, setCurrentChange] = useState(change);
  const [isLoading, setIsLoading] = useState(false);
  const [feedBadge, setFeedBadge] = useState<"live" | "simulated" | "delayed" | "loading">("loading");
  const [lastTickAt, setLastTickAt] = useState<string | null>(null);
  const [takeProfitPrice, setTakeProfitPrice] = useState<number | null>(null);
  const [stopLossPrice, setStopLossPrice] = useState<number | null>(null);
  const [draggingLine, setDraggingLine] = useState<"tp" | "sl" | null>(null);
  const [placingProtection, setPlacingProtection] = useState<"tp" | "sl" | null>(null);
  const [entryMenuOpen, setEntryMenuOpen] = useState(false);
  const [orderMessage, setOrderMessage] = useState<string | null>(null);

  const activePosition = (live?.positions ?? []).find((position) => position.symbol === activeSymbol) ?? null;
  const activeInstrument = instruments.find((instrument) => instrument.symbol === activeSymbol) ?? null;
  const hasActivePosition = Boolean(activePosition && activeInstrument && demoAccountId);
  const entryPrice = activePosition ? Number(activePosition.averageEntryPrice) : null;
  const positionSide = activePosition?.side === "LONG" ? "LONG" : activePosition?.side === "SHORT" ? "SHORT" : null;
  const exitSide = positionSide === "LONG" ? "SELL" : positionSide === "SHORT" ? "BUY" : null;
  const tickSize = activeSymbol === "NQ" || activeSymbol === "ES" ? 0.25 : 0.01;

  function formatLinePrice(value: number | null) {
    if (value == null || !Number.isFinite(value)) {
      return "--";
    }

    return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function snapPrice(value: number) {
    return Number((Math.round(value / tickSize) * tickSize).toFixed(2));
  }

  function normalizeProtectionPrice(kind: "tp" | "sl", value: number) {
    const snapped = snapPrice(value);

    if (!entryPrice || !positionSide) {
      return snapped;
    }

    const offset = Math.max(tickSize * 4, tickSize);

    if (positionSide === "LONG") {
      return kind === "tp"
        ? Math.max(snapped, snapPrice(entryPrice + offset))
        : Math.min(snapped, snapPrice(entryPrice - offset));
    }

    return kind === "tp"
      ? Math.min(snapped, snapPrice(entryPrice - offset))
      : Math.max(snapped, snapPrice(entryPrice + offset));
  }

  function lineTop(price: number | null) {
    if (price == null || !seriesRef.current) {
      return null;
    }

    const coordinate = seriesRef.current.priceToCoordinate(price);
    return typeof coordinate === "number" && Number.isFinite(coordinate) ? coordinate : null;
  }

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
        entireTextOnly: true,
        minimumWidth: 72,
        scaleMargins: {
          top: 0.08,
          bottom: 0.12
        }
      },
      timeScale: {
        borderColor: "rgba(148, 163, 184, 0.18)",
        timeVisible: true,
        secondsVisible: !compact && (initialTimeframe === "1m" || initialTimeframe === "5m"),
        rightOffset: 8,
        barSpacing: compact ? 7 : 9,
        minBarSpacing: compact ? 0.5 : 0.8
      },
      crosshair: {
        vertLine: { color: "rgba(226, 232, 240, 0.35)" },
        horzLine: { color: "rgba(226, 232, 240, 0.35)" }
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: false
      },
      handleScale: {
        axisPressedMouseMove: true,
        mouseWheel: true,
        pinch: true
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
    if (!activePosition) {
      setTakeProfitPrice(null);
      setStopLossPrice(null);
      setPlacingProtection(null);
      setEntryMenuOpen(false);
      triggerLockRef.current = null;
      return;
    }

    const nextEntry = Number(activePosition.averageEntryPrice);
    const nextLast = Number(activePosition.lastPrice || currentPriceRef.current || nextEntry);
    const distance = Math.max(4, Math.abs(nextLast - nextEntry) || nextEntry * 0.0025);

    if (activePosition.side === "LONG") {
      setTakeProfitPrice((current) => current ?? normalizeProtectionPrice("tp", nextEntry + distance));
      setStopLossPrice((current) => current ?? normalizeProtectionPrice("sl", nextEntry - distance));
    } else {
      setTakeProfitPrice((current) => current ?? normalizeProtectionPrice("tp", nextEntry - distance));
      setStopLossPrice((current) => current ?? normalizeProtectionPrice("sl", nextEntry + distance));
    }
    triggerLockRef.current = null;
  }, [activePosition?.symbol, activePosition?.side, activePosition?.quantity, activePosition?.averageEntryPrice]);

  useEffect(() => {
    const series = seriesRef.current;

    if (!series) {
      return;
    }

    series.setData(toCandleData(initialCandles));
    chartRef.current?.timeScale().fitContent();
    viewportKeyRef.current = `${symbol}:${initialTimeframe}`;
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
    const nextUrl = `/dashboard/trades?symbol=${encodeURIComponent(activeSymbol)}&timeframe=${encodeURIComponent(timeframe)}${baseQuery}`;
    window.history.replaceState({}, "", nextUrl);
  }, [activeSymbol, timeframe, baseQuery]);

  useEffect(() => {
    const handleRefreshEvent = () => {
      setIsLoading(true);
    };

    window.addEventListener(TRADE_LIVE_REFRESH_EVENT, handleRefreshEvent);

    return () => {
      window.removeEventListener(TRADE_LIVE_REFRESH_EVENT, handleRefreshEvent);
    };
  }, []);

  useEffect(() => {
    if (!draggingLine || !seriesRef.current || !containerRef.current) {
      return;
    }

    const container = containerRef.current;

    const handleMove = (event: MouseEvent) => {
      const bounds = container.getBoundingClientRect();
      const y = Math.max(0, Math.min(bounds.height, event.clientY - bounds.top));
      const nextPrice = seriesRef.current?.coordinateToPrice(y);

      if (typeof nextPrice !== "number" || !Number.isFinite(nextPrice)) {
        return;
      }

      const normalizedPrice = normalizeProtectionPrice(draggingLine, nextPrice);
      if (draggingLine === "tp") {
        setTakeProfitPrice(normalizedPrice);
      } else {
        setStopLossPrice(normalizedPrice);
      }
      setOrderMessage(null);
    };

    const handleUp = () => {
      setDraggingLine(null);
    };

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);

    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [draggingLine]);

  useEffect(() => {
    if (!placingProtection || !seriesRef.current || !containerRef.current) {
      return;
    }

    const container = containerRef.current;

    const handleClick = (event: MouseEvent) => {
      const bounds = container.getBoundingClientRect();
      const y = Math.max(0, Math.min(bounds.height, event.clientY - bounds.top));
      const nextPrice = seriesRef.current?.coordinateToPrice(y);

      if (typeof nextPrice !== "number" || !Number.isFinite(nextPrice)) {
        return;
      }

      const normalizedPrice = normalizeProtectionPrice(placingProtection, nextPrice);
      if (placingProtection === "tp") {
        setTakeProfitPrice(normalizedPrice);
      } else {
        setStopLossPrice(normalizedPrice);
      }
      setPlacingProtection(null);
      setEntryMenuOpen(false);
      setOrderMessage(null);
    };

    window.addEventListener("click", handleClick);

    return () => {
      window.removeEventListener("click", handleClick);
    };
  }, [placingProtection]);

  useEffect(() => {
    if (!activePosition || !exitSide || !demoAccountId || triggerLockRef.current || !takeProfitPrice || !stopLossPrice) {
      return;
    }

    const positionLast = Number(activePosition.lastPrice || currentPrice);
    const tpTriggered =
      activePosition.side === "LONG"
        ? positionLast >= takeProfitPrice
        : positionLast <= takeProfitPrice;
    const slTriggered =
      activePosition.side === "LONG"
        ? positionLast <= stopLossPrice
        : positionLast >= stopLossPrice;

    if (!tpTriggered && !slTriggered) {
      return;
    }

    const triggerKind: "tp" | "sl" = tpTriggered ? "tp" : "sl";
    triggerLockRef.current = triggerKind;
    setOrderMessage(triggerKind === "tp" ? "Take profit triggered." : "Stop loss triggered.");

    const formData = new FormData();
    formData.set("demoAccountId", demoAccountId);
    formData.set("instrumentId", activeInstrument?.instrumentId ?? activePosition.instrumentId);
    formData.set("symbol", activeSymbol);
    formData.set("side", exitSide);
    formData.set("tab", "positions");
    formData.set("accountId", accountId ?? "");
    formData.set("type", "MARKET");
    formData.set("quantity", String(activePosition.quantity));
    formData.set("timeframe", timeframe);
    formData.set("layout", layout);

    startTransition(async () => {
      const result = await submitDemoOrderAction(formData);
      if (!result.ok) {
        setOrderMessage(
          result.error === "market-closed"
            ? "Market is closed for this instrument right now."
            : result.error === "price-stale"
              ? "Execution price is stale. Wait for a fresh tick before sending a market order."
              : "Protective exit was rejected."
        );
        triggerLockRef.current = null;
        return;
      }

      setTakeProfitPrice(null);
      setStopLossPrice(null);
      setEntryMenuOpen(false);
      setPlacingProtection(null);
      emitTradeLiveRefresh();
    });
  }, [
    activeInstrument?.instrumentId,
    activePosition,
    accountId,
    activeSymbol,
    currentPrice,
    demoAccountId,
    exitSide,
    layout,
    stopLossPrice,
    takeProfitPrice,
    timeframe
  ]);

  useEffect(() => {
    let cancelled = false;
    let inFlight = false;
    let timeoutId: number | null = null;
    const requestViewportKey = `${activeSymbol}:${timeframe}`;

    function applyIncomingData(data: {
      candles: DemoCandle[];
      lastPrice: number;
      source: "INTERNAL" | "DELAYED_EXTERNAL" | "HYBRID" | "EMPTY";
      tickSource: "ninjatrader" | "simulated" | null;
      lastTickAt: string | null;
    }) {
      if (cancelled || !seriesRef.current) {
        return;
      }

      seriesRef.current.setData(toCandleData(data.candles));
      if (viewportKeyRef.current !== requestViewportKey) {
        chartRef.current?.timeScale().fitContent();
        viewportKeyRef.current = requestViewportKey;
      }
      setCurrentChange(data.lastPrice - currentPriceRef.current);
      currentPriceRef.current = data.lastPrice;
      setCurrentPrice(data.lastPrice);
      setLastTickAt(data.lastTickAt);
      setFeedBadge(
        data.source === "DELAYED_EXTERNAL"
          ? "delayed"
          : data.tickSource === "ninjatrader"
            ? "live"
            : "simulated"
      );
    }

    async function refresh() {
      if (cancelled || inFlight) {
        return;
      }

      inFlight = true;

      try {
        const response = await fetch(`/api/demo-trading/chart?symbol=${encodeURIComponent(activeSymbol)}&timeframe=${encodeURIComponent(timeframe)}`, { cache: "no-store" });

        if (!response.ok || cancelled) {
          return;
        }

        const data = await response.json() as {
          candles: DemoCandle[];
          lastPrice: number;
          source: "INTERNAL" | "DELAYED_EXTERNAL" | "HYBRID" | "EMPTY";
          tickSource: "ninjatrader" | "simulated" | null;
          lastTickAt: string | null;
        };

        applyIncomingData(data);
      } finally {
        inFlight = false;
        if (!cancelled) {
          setIsLoading(false);
        }

        if (!cancelled) {
          timeoutId = window.setTimeout(() => {
            void refresh();
          }, 250);
        }
      }
    }
    setIsLoading(true);
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
                      setIsLoading(true);
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
                    setIsLoading(true);
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
          {!isLoading && feedBadge === "live" ? <span className="trade-data-badge live">Live Ticks</span> : null}
          {!isLoading && feedBadge === "simulated" ? <span className="trade-data-badge simulated">Simulated Live</span> : null}
          {!isLoading && feedBadge === "delayed" ? <span className="trade-data-badge delayed">Delayed Fallback</span> : null}
          {!isLoading && lastTickAt ? (
            <span className="trade-data-badge simulated">
              Updated {new Date(lastTickAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </span>
          ) : null}
          <strong>{currentPrice.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
          <span className={currentChange >= 0 ? "positive" : "negative"}>
            {currentChange.toLocaleString("en-US", { signDisplay: "always", minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
      </div>
      {hasActivePosition ? (
        <div className="trade-chart-protection-bar">
          <div className="trade-chart-protection-meta">
            <button
              type="button"
              className={`trade-data-badge entry${entryMenuOpen ? " active" : ""}`}
              onClick={() => {
                setEntryMenuOpen((value) => !value);
                setPlacingProtection(null);
              }}
            >
              Entry {formatLinePrice(entryPrice)}
            </button>
            <span className="trade-data-badge live">TP {formatLinePrice(takeProfitPrice)}</span>
            <span className="trade-data-badge delayed">SL {formatLinePrice(stopLossPrice)}</span>
          </div>
          <div className="trade-chart-protection-actions">
            {entryMenuOpen ? (
              <>
                <button
                  type="button"
                  className={`trade-chip${placingProtection === "tp" ? " active" : ""}`}
                  onClick={() => {
                    setPlacingProtection("tp");
                    setOrderMessage("Click on the chart to place take profit.");
                  }}
                >
                  Set TP
                </button>
                <button
                  type="button"
                  className={`trade-chip${placingProtection === "sl" ? " active" : ""}`}
                  onClick={() => {
                    setPlacingProtection("sl");
                    setOrderMessage("Click on the chart to place stop loss.");
                  }}
                >
                  Set SL
                </button>
              </>
            ) : null}
            <button
              type="button"
              className="trade-chip"
              onClick={() => {
                if (!entryPrice || !positionSide) return;
                const distance = Math.max(4, Math.abs(currentPrice - entryPrice) || entryPrice * 0.0025);
                setTakeProfitPrice(normalizeProtectionPrice("tp", positionSide === "LONG" ? entryPrice + distance : entryPrice - distance));
              }}
            >
              Reset TP
            </button>
            <button
              type="button"
              className="trade-chip"
              onClick={() => {
                if (!entryPrice || !positionSide) return;
                const distance = Math.max(4, Math.abs(currentPrice - entryPrice) || entryPrice * 0.0025);
                setStopLossPrice(normalizeProtectionPrice("sl", positionSide === "LONG" ? entryPrice - distance : entryPrice + distance));
              }}
            >
              Reset SL
            </button>
            <button
              type="button"
              className="trade-chip"
              onClick={() => {
                setTakeProfitPrice(null);
                setStopLossPrice(null);
                setPlacingProtection(null);
                setEntryMenuOpen(false);
                triggerLockRef.current = null;
              }}
            >
              Clear
            </button>
          </div>
        </div>
      ) : null}
      {orderMessage ? <div className="trade-chart-order-message">{orderMessage}</div> : null}
      <div ref={containerRef} className="trade-chart-canvas">
        {hasActivePosition && entryPrice != null && lineTop(entryPrice) != null ? (
          <button
            type="button"
            className={`trade-chart-line-handle entry-line${entryMenuOpen ? " active" : ""}`}
            style={{ top: `${lineTop(entryPrice)}px` }}
            onClick={() => {
              setEntryMenuOpen((value) => !value);
              setPlacingProtection(null);
            }}
          >
            <span>{placingProtection ? `Place ${placingProtection.toUpperCase()}` : "Entry"}</span>
            <strong>{formatLinePrice(entryPrice)}</strong>
          </button>
        ) : null}
        {hasActivePosition && takeProfitPrice != null && lineTop(takeProfitPrice) != null ? (
          <button
            type="button"
            className="trade-chart-line-handle take-profit"
            style={{ top: `${lineTop(takeProfitPrice)}px` }}
            onMouseDown={() => setDraggingLine("tp")}
          >
            <span>TP</span>
            <strong>{formatLinePrice(takeProfitPrice)}</strong>
          </button>
        ) : null}
        {hasActivePosition && stopLossPrice != null && lineTop(stopLossPrice) != null ? (
          <button
            type="button"
            className="trade-chart-line-handle stop-loss"
            style={{ top: `${lineTop(stopLossPrice)}px` }}
            onMouseDown={() => setDraggingLine("sl")}
          >
            <span>SL</span>
            <strong>{formatLinePrice(stopLossPrice)}</strong>
          </button>
        ) : null}
      </div>
    </div>
  );
}
