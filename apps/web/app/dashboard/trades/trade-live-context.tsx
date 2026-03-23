"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { TRADE_LIVE_REFRESH_EVENT } from "./trade-live-events";

type ActiveAccount = {
  accountName: string;
  equity: string;
  buyingPower: string;
  realizedPnl: string;
  unrealizedPnl: string;
  accountState: string | null;
  breachedAt?: string | Date | null;
} | null;

type PositionRow = {
  instrumentId: string;
  symbol: string;
  side: string;
  quantity: number;
  averageEntryPrice: string;
  lastPrice: string;
  unrealizedPnl: string;
};

type LiveInstrument = {
  instrumentId: string;
  symbol: string;
  price: string | null;
  changeAmount: string | null;
  latestSource: string | null;
  latestTickAt: string | Date | null;
} | null;

type TradeLiveState = {
  activeAccount: ActiveAccount;
  positions: PositionRow[];
  selectedInstrument: LiveInstrument;
  feedStatus: "live" | "simulated" | "stale";
  lastTickAt: string | null;
};

const TradeLiveContext = createContext<TradeLiveState | null>(null);

type TradeLiveProviderProps = {
  accountId: string | undefined;
  symbol: string;
  initialState: TradeLiveState;
  children: ReactNode;
};

export function TradeLiveProvider({ accountId, symbol, initialState, children }: TradeLiveProviderProps) {
  const [state, setState] = useState(initialState);

  useEffect(() => {
    setState(initialState);
  }, [initialState]);

  useEffect(() => {
    let cancelled = false;
    let inFlight = false;

    const refresh = async () => {
      if (cancelled || inFlight) {
        return;
      }

      inFlight = true;

      try {
        const requestQuery = new URLSearchParams();
        if (accountId) {
          requestQuery.set("accountId", accountId);
        }
        requestQuery.set("symbol", symbol);
        requestQuery.set("_ts", String(Date.now()));
        const response = await fetch(`/api/demo-trading/live-state?${requestQuery.toString()}`, { cache: "no-store" });
        if (!response.ok || cancelled) {
          return;
        }

        const next = await response.json() as TradeLiveState;
        if (!cancelled) {
          setState(next);
        }
      } finally {
        inFlight = false;
      }
    };

    void refresh();

    const handleRefreshEvent = () => {
      void refresh();
    };

    window.addEventListener(TRADE_LIVE_REFRESH_EVENT, handleRefreshEvent);

    const interval = window.setInterval(() => {
      void refresh();
    }, 100);

    return () => {
      cancelled = true;
      window.removeEventListener(TRADE_LIVE_REFRESH_EVENT, handleRefreshEvent);
      window.clearInterval(interval);
    };
  }, [accountId, symbol]);

  return <TradeLiveContext.Provider value={state}>{children}</TradeLiveContext.Provider>;
}

export function useTradeLiveContext() {
  return useContext(TradeLiveContext);
}
