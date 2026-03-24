"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
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
  takeProfitPrice: string | null;
  stopLossPrice: string | null;
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
  const pollTimerRef = useRef<number | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const fallbackTimerRef = useRef<number | null>(null);

  useEffect(() => {
    setState(initialState);
  }, [initialState]);

  useEffect(() => {
    let cancelled = false;
    let inFlight = false;
    let receivedStreamMessage = false;

    const clearPoll = () => {
      if (pollTimerRef.current !== null) {
        window.clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };

    const clearFallback = () => {
      if (fallbackTimerRef.current !== null) {
        window.clearTimeout(fallbackTimerRef.current);
        fallbackTimerRef.current = null;
      }
    };

    const closeStream = () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };

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

    const requestQuery = new URLSearchParams();
    if (accountId) {
      requestQuery.set("accountId", accountId);
    }
    requestQuery.set("symbol", symbol);

    try {
      const source = new EventSource(`/api/demo-trading/live-state/stream?${requestQuery.toString()}`);
      eventSourceRef.current = source;

      source.onmessage = (event) => {
        if (cancelled) {
          return;
        }

        try {
          const next = JSON.parse(event.data) as TradeLiveState;
          receivedStreamMessage = true;
          clearFallback();
          clearPoll();
          setState(next);
        } catch {
          // fall back to polling below
        }
      };

      source.onerror = () => {
        clearFallback();
        closeStream();
        if (!cancelled && pollTimerRef.current === null) {
          pollTimerRef.current = window.setInterval(() => {
            void refresh();
          }, 100);
        }
      };
    } catch {
      receivedStreamMessage = false;
    }

    if (eventSourceRef.current) {
      fallbackTimerRef.current = window.setTimeout(() => {
        if (!cancelled && !receivedStreamMessage && pollTimerRef.current === null) {
          pollTimerRef.current = window.setInterval(() => {
            void refresh();
          }, 100);
        }
      }, 1200);
    } else if (pollTimerRef.current === null) {
      pollTimerRef.current = window.setInterval(() => {
        void refresh();
      }, 100);
    }

    const handleRefreshEvent = () => {
      void refresh();
    };

    window.addEventListener(TRADE_LIVE_REFRESH_EVENT, handleRefreshEvent);

    return () => {
      cancelled = true;
      clearFallback();
      closeStream();
      clearPoll();
      window.removeEventListener(TRADE_LIVE_REFRESH_EVENT, handleRefreshEvent);
    };
  }, [accountId, symbol]);

  return <TradeLiveContext.Provider value={state}>{children}</TradeLiveContext.Provider>;
}

export function useTradeLiveContext() {
  return useContext(TradeLiveContext);
}
