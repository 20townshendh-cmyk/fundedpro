"use client";

import { startTransition, useEffect, useRef, useState } from "react";
import {
  createChart,
  ColorType,
  type CandlestickData,
  type LogicalRange,
  type UTCTimestamp,
  CandlestickSeries,
  LineStyle,
  type IChartApi,
  type ISeriesApi,
  type IPriceLine
} from "lightweight-charts";
import { updateDemoPositionProtectionAction } from "../../../lib/demo-trading/actions";
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
const CHART_REFRESH_MS = 1200;

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
  const entryPriceLineRef = useRef<IPriceLine | null>(null);
  const takeProfitLineRef = useRef<IPriceLine | null>(null);
  const stopLossLineRef = useRef<IPriceLine | null>(null);
  const visibleRangeRef = useRef<LogicalRange | null>(null);
  const candleCacheRef = useRef<CandlestickData[]>(toCandleData(initialCandles));
  const currentPriceRef = useRef(lastPrice);
  const takeProfitDraftRef = useRef<number | null>(null);
  const stopLossDraftRef = useRef<number | null>(null);
  const requestIdRef = useRef(0);
  const viewportKeyRef = useRef(`${symbol}:${initialTimeframe}`);
  const [activeSymbol, setActiveSymbol] = useState(symbol);
  const [timeframe, setTimeframe] = useState<Timeframe>(initialTimeframe);
  const [currentPrice, setCurrentPrice] = useState(lastPrice);
  const [currentChange, setCurrentChange] = useState(change);
  const [isLoading, setIsLoading] = useState(false);
  const [feedBadge, setFeedBadge] = useState<"live" | "simulated" | "delayed" | "loading">("loading");
  const [lastTickAt, setLastTickAt] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [takeProfitDraft, setTakeProfitDraft] = useState<number | null>(null);
  const [stopLossDraft, setStopLossDraft] = useState<number | null>(null);
  const [draggingLine, setDraggingLine] = useState<"tp" | "sl" | null>(null);
  const [placingProtection, setPlacingProtection] = useState<"tp" | "sl" | null>(null);
  const [entryMenuOpen, setEntryMenuOpen] = useState(false);
  const [orderMessage, setOrderMessage] = useState<string | null>(null);

  const activePosition = (live?.positions ?? []).find((position) => position.symbol === activeSymbol) ?? null;
  const activeInstrument = instruments.find((instrument) => instrument.symbol === activeSymbol) ?? null;
  const hasActivePosition = Boolean(activePosition && activeInstrument && demoAccountId);
  const entryPrice = activePosition ? Number(activePosition.averageEntryPrice) : null;
  const persistedTakeProfitPrice = activePosition?.takeProfitPrice ? Number(activePosition.takeProfitPrice) : null;
  const persistedStopLossPrice = activePosition?.stopLossPrice ? Number(activePosition.stopLossPrice) : null;
  const takeProfitPrice = takeProfitDraft ?? persistedTakeProfitPrice;
  const stopLossPrice = stopLossDraft ?? persistedStopLossPrice;
  const positionSide = activePosition?.side === "LONG" ? "LONG" : activePosition?.side === "SHORT" ? "SHORT" : null;
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

  async function persistProtectionLevels(nextTakeProfitPrice: number | null, nextStopLossPrice: number | null) {
    if (!activeInstrument || !demoAccountId) {
      return;
    }

    const formData = new FormData();
    formData.set("demoAccountId", demoAccountId);
    formData.set("instrumentId", activeInstrument.instrumentId);

    if (nextTakeProfitPrice != null) {
      formData.set("takeProfitPrice", String(nextTakeProfitPrice));
    }

    if (nextStopLossPrice != null) {
      formData.set("stopLossPrice", String(nextStopLossPrice));
    }

    const result = await updateDemoPositionProtectionAction(formData);

    if (!result.ok) {
      setOrderMessage("Protection update was rejected.");
      return;
    }

    emitTradeLiveRefresh();
  }

  function getCandleDurationMs(selectedTimeframe: Timeframe) {
    switch (selectedTimeframe) {
      case "1m":
        return 60_000;
      case "5m":
        return 5 * 60_000;
      case "15m":
        return 15 * 60_000;
      case "1h":
        return 60 * 60_000;
      case "1d":
        return 24 * 60 * 60_000;
      case "1w":
        return 7 * 24 * 60 * 60_000;
      default:
        return 60_000;
    }
  }

  function getNextCandleCloseMs(selectedTimeframe: Timeframe, currentMs: number) {
    const date = new Date(currentMs);

    switch (selectedTimeframe) {
      case "1m":
      case "5m":
      case "15m":
      case "1h": {
        const durationMs = getCandleDurationMs(selectedTimeframe);
        return Math.floor(currentMs / durationMs) * durationMs + durationMs;
      }
      case "1d": {
        const next = new Date(date);
        next.setUTCHours(24, 0, 0, 0);
        return next.getTime();
      }
      case "1w": {
        const next = new Date(date);
        const day = next.getUTCDay();
        const daysUntilMonday = (8 - day) % 7 || 7;
        next.setUTCDate(next.getUTCDate() + daysUntilMonday);
        next.setUTCHours(0, 0, 0, 0);
        return next.getTime();
      }
      default:
        return currentMs + 60_000;
    }
  }

  function formatCountdown(msRemaining: number) {
    const totalSeconds = Math.max(0, Math.floor(msRemaining / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    }

    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  const candleCountdown = formatCountdown(getNextCandleCloseMs(timeframe, nowMs) - nowMs);

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

  function candlesMatch(left: CandlestickData[], right: CandlestickData[]) {
    if (left.length !== right.length) {
      return false;
    }

    for (let index = 0; index < left.length; index += 1) {
      const leftCandle = left[index]!;
      const rightCandle = right[index]!;

      if (
        leftCandle.time !== rightCandle.time ||
        leftCandle.open !== rightCandle.open ||
        leftCandle.high !== rightCandle.high ||
        leftCandle.low !== rightCandle.low ||
        leftCandle.close !== rightCandle.close
      ) {
        return false;
      }
    }

    return true;
  }

  function applyCandles(nextCandles: CandlestickData[], requestViewportKey: string) {
    const chart = chartRef.current;
    const series = seriesRef.current;

    if (!chart || !series) {
      return;
    }

    const previousCandles = candleCacheRef.current;
    const sameViewport = viewportKeyRef.current === requestViewportKey;
    const previousRange = sameViewport ? visibleRangeRef.current : null;

    if (!sameViewport || previousCandles.length === 0) {
      series.setData(nextCandles);
      candleCacheRef.current = nextCandles;
      chart.timeScale().fitContent();
      viewportKeyRef.current = requestViewportKey;
      visibleRangeRef.current = chart.timeScale().getVisibleLogicalRange();
      return;
    }

    if (candlesMatch(previousCandles, nextCandles)) {
      if (previousRange) {
        chart.timeScale().setVisibleLogicalRange(previousRange);
      }
      return;
    }

    const previousLast = previousCandles.at(-1) ?? null;
    const nextLast = nextCandles.at(-1) ?? null;
    const previousBeforeLast = previousCandles.at(-2) ?? null;
    const nextBeforeLast = nextCandles.at(-2) ?? null;
    const canUpdateIncrementally =
      nextLast != null &&
      previousLast != null &&
      (
        (
          nextCandles.length === previousCandles.length &&
          previousBeforeLast != null &&
          nextBeforeLast != null &&
          candlesMatch(previousCandles.slice(0, -1), nextCandles.slice(0, -1))
        ) ||
        (
          nextCandles.length === previousCandles.length + 1 &&
          candlesMatch(previousCandles, nextCandles.slice(0, -1))
        )
      );

    if (canUpdateIncrementally) {
      series.update(nextLast);
      candleCacheRef.current = nextCandles;
      if (previousRange) {
        chart.timeScale().setVisibleLogicalRange(previousRange);
      }
      return;
    }

    series.setData(nextCandles);
    candleCacheRef.current = nextCandles;
    if (previousRange) {
      chart.timeScale().setVisibleLogicalRange(previousRange);
    } else {
      chart.timeScale().fitContent();
    }
  }

  function applyLivePriceToChart(nextPrice: number, tickAt: string | null) {
    const chart = chartRef.current;
    const series = seriesRef.current;
    const previousCandles = candleCacheRef.current;

    if (!chart || !series || !previousCandles.length || !Number.isFinite(nextPrice)) {
      return;
    }

    const candleTimeMs = tickAt ? new Date(tickAt).getTime() : Date.now();
    const intervalSeconds = getCandleDurationMs(timeframe) / 1000;
    const bucketTime = Math.floor(candleTimeMs / 1000 / intervalSeconds) * intervalSeconds;
    const lastCandle = previousCandles.at(-1) ?? null;
    const previousRange = visibleRangeRef.current;

    if (!lastCandle) {
      return;
    }

    let nextCandles = previousCandles;

    const lastCandleTime = Number(lastCandle.time);

    if (lastCandleTime === bucketTime) {
      nextCandles = [
        ...previousCandles.slice(0, -1),
        {
          ...lastCandle,
          high: Math.max(lastCandle.high, nextPrice),
          low: Math.min(lastCandle.low, nextPrice),
          close: nextPrice
        }
      ];
      series.update(nextCandles.at(-1)!);
    } else if (lastCandleTime < bucketTime) {
      const nextOpen = lastCandle.close;
      nextCandles = [
        ...previousCandles,
        {
          time: bucketTime as UTCTimestamp,
          open: nextOpen,
          high: Math.max(nextOpen, nextPrice),
          low: Math.min(nextOpen, nextPrice),
          close: nextPrice
        }
      ];
      series.update(nextCandles.at(-1)!);
    }

    candleCacheRef.current = nextCandles;
    if (previousRange) {
      chart.timeScale().setVisibleLogicalRange(previousRange);
    }
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

    const normalizedInitialCandles = toCandleData(initialCandles);
    candleCacheRef.current = normalizedInitialCandles;
    series.setData(normalizedInitialCandles);
    priceLineRef.current = series.createPriceLine({
      price: lastPrice,
      color: change >= 0 ? "#16a34a" : "#ef4444",
      lineWidth: 2,
      lineStyle: LineStyle.Solid,
      axisLabelVisible: true,
      title: "Last"
    });
    chart.timeScale().fitContent();
    chart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
      visibleRangeRef.current = range;
    });

    chartRef.current = chart;
    seriesRef.current = series;

    return () => {
      if (entryPriceLineRef.current) {
        series.removePriceLine(entryPriceLineRef.current);
      }
      if (takeProfitLineRef.current) {
        series.removePriceLine(takeProfitLineRef.current);
      }
      if (stopLossLineRef.current) {
        series.removePriceLine(stopLossLineRef.current);
      }
      if (priceLineRef.current) {
        series.removePriceLine(priceLineRef.current);
      }
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      priceLineRef.current = null;
      entryPriceLineRef.current = null;
      takeProfitLineRef.current = null;
      stopLossLineRef.current = null;
    };
  }, []);

  useEffect(() => {
    const series = seriesRef.current;

    if (!series) {
      return;
    }

    if (entryPriceLineRef.current) {
      series.removePriceLine(entryPriceLineRef.current);
      entryPriceLineRef.current = null;
    }
    if (takeProfitLineRef.current) {
      series.removePriceLine(takeProfitLineRef.current);
      takeProfitLineRef.current = null;
    }
    if (stopLossLineRef.current) {
      series.removePriceLine(stopLossLineRef.current);
      stopLossLineRef.current = null;
    }

    if (entryPrice != null) {
      entryPriceLineRef.current = series.createPriceLine({
        price: entryPrice,
        color: "#f97316",
        lineStyle: LineStyle.Dashed,
        lineWidth: 2,
        axisLabelVisible: true,
        title: "ENTRY"
      });
    }

    if (takeProfitPrice != null) {
      takeProfitLineRef.current = series.createPriceLine({
        price: takeProfitPrice,
        color: "#22c55e",
        lineStyle: LineStyle.Dashed,
        lineWidth: 2,
        axisLabelVisible: true,
        title: "TP"
      });
    }

    if (stopLossPrice != null) {
      stopLossLineRef.current = series.createPriceLine({
        price: stopLossPrice,
        color: "#f43f5e",
        lineStyle: LineStyle.Dashed,
        lineWidth: 2,
        axisLabelVisible: true,
        title: "SL"
      });
    }
  }, [entryPrice, stopLossPrice, takeProfitPrice]);

  useEffect(() => {
    chartRef.current?.applyOptions({
      timeScale: {
        timeVisible: true,
        secondsVisible: !compact && (timeframe === "1m" || timeframe === "5m")
      }
    });
  }, [compact, timeframe]);

  useEffect(() => {
    if (!hasActivePosition) {
      setTakeProfitDraft(null);
      setStopLossDraft(null);
      setPlacingProtection(null);
      setEntryMenuOpen(false);
      setOrderMessage(null);
    }
  }, [hasActivePosition]);

  useEffect(() => {
    const series = seriesRef.current;

    if (!series) {
      return;
    }

    const nextCandles = toCandleData(initialCandles);
    candleCacheRef.current = nextCandles;
    series.setData(nextCandles);
    chartRef.current?.timeScale().fitContent();
    viewportKeyRef.current = `${symbol}:${initialTimeframe}`;
    visibleRangeRef.current = chartRef.current?.timeScale().getVisibleLogicalRange() ?? null;
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

  function syncRoute(nextSymbol: string, nextTimeframe: Timeframe) {
    const nextUrl = `/dashboard/trades?symbol=${encodeURIComponent(nextSymbol)}&timeframe=${encodeURIComponent(nextTimeframe)}${baseQuery}`;
    window.history.replaceState({}, "", nextUrl);
  }

  function queueChartChange(nextSymbol: string, nextTimeframe: Timeframe) {
    if (nextSymbol === activeSymbol && nextTimeframe === timeframe) {
      return;
    }

    visibleRangeRef.current = null;
    setIsLoading(true);
    setFeedBadge("loading");
    setEntryMenuOpen(false);
    setPlacingProtection(null);
    setOrderMessage(null);
    setActiveSymbol(nextSymbol);
    setTimeframe(nextTimeframe);
    syncRoute(nextSymbol, nextTimeframe);
  }

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
    const interval = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    takeProfitDraftRef.current = takeProfitDraft;
  }, [takeProfitDraft]);

  useEffect(() => {
    stopLossDraftRef.current = stopLossDraft;
  }, [stopLossDraft]);

  useEffect(() => {
    if (draggingLine !== "tp") {
      setTakeProfitDraft(persistedTakeProfitPrice);
    }
  }, [draggingLine, persistedTakeProfitPrice]);

  useEffect(() => {
    if (draggingLine !== "sl") {
      setStopLossDraft(persistedStopLossPrice);
    }
  }, [draggingLine, persistedStopLossPrice]);

  useEffect(() => {
    if (!live?.selectedInstrument || live.selectedInstrument.symbol !== activeSymbol) {
      return;
    }

    const nextPrice = Number(live.selectedInstrument.price ?? 0);
    const nextChange = Number(live.selectedInstrument.changeAmount ?? 0);

    if (!Number.isFinite(nextPrice) || nextPrice <= 0) {
      return;
    }

    setCurrentPrice(nextPrice);
    currentPriceRef.current = nextPrice;
    setCurrentChange(nextChange);
    setLastTickAt(live.lastTickAt);
    setFeedBadge(
      live.feedStatus === "live"
        ? "live"
        : live.feedStatus === "stale"
          ? "delayed"
          : "simulated"
    );
    applyLivePriceToChart(nextPrice, live.lastTickAt);
  }, [activeSymbol, live, timeframe]);

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
        setTakeProfitDraft(normalizedPrice);
      } else {
        setStopLossDraft(normalizedPrice);
      }
      setOrderMessage(null);
    };

    const handleUp = () => {
      const nextTakeProfitPrice = draggingLine === "tp" ? takeProfitDraftRef.current : takeProfitPrice;
      const nextStopLossPrice = draggingLine === "sl" ? stopLossDraftRef.current : stopLossPrice;
      setDraggingLine(null);
      startTransition(async () => {
        await persistProtectionLevels(nextTakeProfitPrice ?? null, nextStopLossPrice ?? null);
      });
    };

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);

    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [draggingLine, stopLossPrice, takeProfitPrice]);

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
        setTakeProfitDraft(normalizedPrice);
      } else {
        setStopLossDraft(normalizedPrice);
      }
      const nextTakeProfitPrice = placingProtection === "tp" ? normalizedPrice : takeProfitPrice;
      const nextStopLossPrice = placingProtection === "sl" ? normalizedPrice : stopLossPrice;
      setPlacingProtection(null);
      setEntryMenuOpen(false);
      setOrderMessage(null);
      startTransition(async () => {
        await persistProtectionLevels(nextTakeProfitPrice ?? null, nextStopLossPrice ?? null);
      });
    };

    window.addEventListener("click", handleClick);

    return () => {
      window.removeEventListener("click", handleClick);
    };
  }, [placingProtection, stopLossPrice, takeProfitPrice]);

  useEffect(() => {
    let cancelled = false;
    let inFlight = false;
    let timeoutId: number | null = null;
    let activeController: AbortController | null = null;
    let streamSource: EventSource | null = null;
    let streamHealthy = false;
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

      applyCandles(toCandleData(data.candles), requestViewportKey);
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
      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;
      activeController?.abort();
      activeController = new AbortController();

      try {
        const response = await fetch(
          `/api/demo-trading/chart?symbol=${encodeURIComponent(activeSymbol)}&timeframe=${encodeURIComponent(timeframe)}&_ts=${Date.now()}`,
          {
            cache: "no-store",
            signal: activeController.signal
          }
        );

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

        if (requestId !== requestIdRef.current) {
          return;
        }

        applyIncomingData(data);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
      } finally {
        inFlight = false;
        if (!cancelled) {
          setIsLoading(false);
        }

        if (!cancelled) {
          timeoutId = window.setTimeout(() => {
            void refresh();
          }, CHART_REFRESH_MS);
        }
      }
    }
    setIsLoading(true);

    try {
      streamSource = new EventSource(
        `/api/demo-trading/chart/stream?symbol=${encodeURIComponent(activeSymbol)}&timeframe=${encodeURIComponent(timeframe)}`
      );
      streamSource.onmessage = (event) => {
        if (cancelled) {
          return;
        }

        try {
          const data = JSON.parse(event.data) as {
            candles: DemoCandle[];
            lastPrice: number;
            source: "INTERNAL" | "DELAYED_EXTERNAL" | "HYBRID" | "EMPTY";
            tickSource: "ninjatrader" | "simulated" | null;
            lastTickAt: string | null;
          };
          streamHealthy = true;
          applyIncomingData(data);
          setIsLoading(false);
        } catch {
          // fall back to polling below
        }
      };
      streamSource.onerror = () => {
        streamHealthy = false;
        streamSource?.close();
        streamSource = null;
        if (!cancelled && timeoutId === null) {
          void refresh();
        }
      };
    } catch {
      streamHealthy = false;
    }

    if (!streamSource) {
      void refresh();
    } else {
      timeoutId = window.setTimeout(() => {
        if (!cancelled && !streamHealthy) {
          void refresh();
        }
      }, 1200);
    }

    return () => {
      cancelled = true;
      streamSource?.close();
      activeController?.abort();
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
                  onClick={() => queueChartChange(linkedSymbol, timeframe)}
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
                onClick={() => queueChartChange(activeSymbol, option)}
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
          <span className="trade-data-badge entry">{candleCountdown} left</span>
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
            <span className={`trade-data-badge${takeProfitPrice != null ? " live" : " simulated"}`}>
              {takeProfitPrice != null ? `TP ${formatLinePrice(takeProfitPrice)}` : "TP not set"}
            </span>
            <span className={`trade-data-badge${stopLossPrice != null ? " delayed" : " simulated"}`}>
              {stopLossPrice != null ? `SL ${formatLinePrice(stopLossPrice)}` : "SL not set"}
            </span>
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
            {takeProfitPrice != null ? (
              <button
                type="button"
                className="trade-chip"
                onClick={() => {
                  setTakeProfitDraft(null);
                  setPlacingProtection(null);
                  startTransition(async () => {
                    await persistProtectionLevels(null, stopLossPrice);
                  });
                }}
              >
                Clear TP
              </button>
            ) : null}
            {stopLossPrice != null ? (
              <button
                type="button"
                className="trade-chip"
                onClick={() => {
                  setStopLossDraft(null);
                  setPlacingProtection(null);
                  startTransition(async () => {
                    await persistProtectionLevels(takeProfitPrice, null);
                  });
                }}
              >
                Clear SL
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
      {orderMessage ? <div className="trade-chart-order-message">{orderMessage}</div> : null}
      <div ref={containerRef} className="trade-chart-canvas" />
    </div>
  );
}
