import type { DemoCandle } from "./chart";

const SYMBOL_MAP = {
  // Use index proxies for smoother, more available chart data while
  // keeping the trading engine on ES/NQ internally.
  ES: "^GSPC",
  NQ: "^NDX"
} as const;

type SupportedSymbol = keyof typeof SYMBOL_MAP;

export type ChartTimeframe = "1m" | "5m" | "15m" | "1h" | "1d" | "1w";

type DelayedSnapshot = {
  symbol: string;
  price: number;
  changeAmount: number;
  changePct: number;
  candles: DemoCandle[];
};

function isSupportedSymbol(symbol: string): symbol is SupportedSymbol {
  return symbol in SYMBOL_MAP;
}

function getYahooRange(timeframe: ChartTimeframe) {
  switch (timeframe) {
    case "1m":
      return { interval: "1m", range: "7d" };
    case "5m":
      return { interval: "5m", range: "60d" };
    case "15m":
      return { interval: "15m", range: "60d" };
    case "1h":
      return { interval: "60m", range: "2y" };
    case "1d":
      return { interval: "1d", range: "4y" };
    case "1w":
      return { interval: "1wk", range: "4y" };
    default:
      return { interval: "5m", range: "60d" };
  }
}

export function supportsDelayedChartSymbol(symbol: string): symbol is SupportedSymbol {
  return isSupportedSymbol(symbol);
}

const CME_MARKET_PATHS: Record<SupportedSymbol, string> = {
  ES: "sp/e-mini-sandp500",
  NQ: "nasdaq/e-mini-nasdaq-100"
};

async function getCmeFallbackSnapshot(symbol: SupportedSymbol): Promise<DelayedSnapshot | null> {
  const marketPath = CME_MARKET_PATHS[symbol];
  const url = `https://www.cmegroup.com/markets/equities/${marketPath}.html`;

  try {
    const response = await fetch(url, {
      cache: "no-store",
      headers: {
        "User-Agent": "Mozilla/5.0",
        Accept: "text/html"
      }
    });

    if (!response.ok) {
      return null;
    }

    const html = await response.text();
    const match =
      html.match(/class=["'][^"']*instrument-price[^"']*["'][^>]*>\s*([^<\s][^<]*)\s*</i) ??
      html.match(/"last"\s*:\s*"?(?<price>\d[\d,]*(?:\.\d+)?)"?/i);
    const rawPrice = match?.groups?.price ?? match?.[1] ?? null;

    if (!rawPrice) {
      return null;
    }

    const price = Number(rawPrice.replace(/,/g, ""));

    if (!Number.isFinite(price)) {
      return null;
    }

    return {
      symbol,
      price,
      changeAmount: 0,
      changePct: 0,
      candles: []
    };
  } catch {
    return null;
  }
}

export async function getDelayedSnapshot(symbol: string, timeframe: ChartTimeframe = "5m"): Promise<DelayedSnapshot | null> {
  if (!isSupportedSymbol(symbol)) {
    return null;
  }

  const { interval, range } = getYahooRange(timeframe);
  const ticker = SYMBOL_MAP[symbol];
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=${interval}&range=${range}&includePrePost=false&events=div%2Csplits`;

  try {
    const response = await fetch(url, {
      cache: "no-store",
      headers: {
        "User-Agent": "Mozilla/5.0",
        Accept: "application/json"
      }
    });

    if (!response.ok) {
      return null;
    }

    const payload = await response.json() as {
      chart?: {
        result?: Array<{
          timestamp?: number[];
          indicators?: {
            quote?: Array<{
              open?: Array<number | null>;
              high?: Array<number | null>;
              low?: Array<number | null>;
              close?: Array<number | null>;
              volume?: Array<number | null>;
            }>;
          };
          meta?: {
            regularMarketPrice?: number;
            chartPreviousClose?: number;
          };
        }>;
      };
    };

    const result = payload.chart?.result?.[0];
    const quote = result?.indicators?.quote?.[0];

    if (!result?.timestamp || !quote?.close?.length) {
      return getCmeFallbackSnapshot(symbol);
    }

    const candles: DemoCandle[] = [];

    for (let index = 0; index < result.timestamp.length; index += 1) {
      const time = result.timestamp[index];
      const open = quote.open?.[index];
      const high = quote.high?.[index];
      const low = quote.low?.[index];
      const close = quote.close?.[index];
      const volume = quote.volume?.[index];

      if (
        time == null ||
        open == null ||
        high == null ||
        low == null ||
        close == null
      ) {
        continue;
      }

      candles.push({
        time,
        open,
        high,
        low,
        close,
        volume: Math.max(1, Math.round(volume ?? 0))
      });
    }

    if (!candles.length) {
      return getCmeFallbackSnapshot(symbol);
    }

    const price = result.meta?.regularMarketPrice ?? candles[candles.length - 1]!.close;
    const previousClose = result.meta?.chartPreviousClose ?? candles[0]!.open;
    const changeAmount = Number((price - previousClose).toFixed(2));
    const changePct = Number((((price - previousClose) / Math.max(previousClose, 1)) * 100).toFixed(2));

    return {
      symbol,
      price,
      changeAmount,
      changePct,
      candles
    };
  } catch {
    return getCmeFallbackSnapshot(symbol);
  }
}
