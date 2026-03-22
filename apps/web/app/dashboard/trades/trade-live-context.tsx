"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

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
    if (!accountId) {
      return;
    }

    let cancelled = false;
    let inFlight = false;
    const query = new URLSearchParams({ accountId });

    const refresh = async () => {
      if (inFlight) {
        return;
      }

      inFlight = true;

      try {
        const requestQuery = new URLSearchParams(query);
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
    const interval = window.setInterval(refresh, 100);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [accountId]);

  return <TradeLiveContext.Provider value={state}>{children}</TradeLiveContext.Provider>;
}

export function useTradeLiveContext() {
  return useContext(TradeLiveContext);
}
