"use client";

export const TRADE_LIVE_REFRESH_EVENT = "fundedpro:trade-live-refresh";

export function emitTradeLiveRefresh() {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new CustomEvent(TRADE_LIVE_REFRESH_EVENT));
}
