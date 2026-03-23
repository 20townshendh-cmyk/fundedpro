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

type TradeLiveState = {
  activeAccount: ActiveAccount;
  positions: PositionRow[];
};

const TradeLiveContext = createContext<TradeLiveState | null>(null);

type TradeLiveProviderProps = {
  accountId: string | undefined;
  initialState: TradeLiveState;
  children: ReactNode;
};

export function TradeLiveProvider({ accountId, initialState, children }: TradeLiveProviderProps) {
  const [state, setState] = useState(initialState);

  useEffect(() => {
    setState(initialState);
  }, [initialState]);

  useEffect(() => {
    let cancelled = false;
    let inFlight = false;
    let eventSource: EventSource | null = null;

    const refresh = async () => {
      if (inFlight) {
        return;
      }

      inFlight = true;

      try {
        const requestQuery = new URLSearchParams();
        if (accountId) {
          requestQuery.set("accountId", accountId);
        }
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

    try {
      const requestQuery = new URLSearchParams();
      if (accountId) {
        requestQuery.set("accountId", accountId);
      }
      eventSource = new EventSource(`/api/demo-trading/live-state/stream?${requestQuery.toString()}`);
      eventSource.onmessage = (event) => {
        const next = JSON.parse(event.data) as TradeLiveState;
        if (!cancelled) {
          setState(next);
        }
      };
      eventSource.onerror = () => {
        eventSource?.close();
        eventSource = null;
        void refresh();
      };
    } catch {
      void refresh();
    }

    const handleRefreshEvent = () => {
      void refresh();
    };

    window.addEventListener(TRADE_LIVE_REFRESH_EVENT, handleRefreshEvent);

    const interval = window.setInterval(() => {
      if (!eventSource) {
        void refresh();
      }
    }, 100);

    return () => {
      cancelled = true;
      eventSource?.close();
      window.removeEventListener(TRADE_LIVE_REFRESH_EVENT, handleRefreshEvent);
      window.clearInterval(interval);
    };
  }, [accountId]);

  return <TradeLiveContext.Provider value={state}>{children}</TradeLiveContext.Provider>;
}

export function useTradeLiveContext() {
  return useContext(TradeLiveContext);
}
