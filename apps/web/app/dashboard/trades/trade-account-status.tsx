"use client";

import { useEffect, useRef, useState } from "react";
import { useTradeLiveContext } from "./trade-live-context";

type ActiveAccount = {
  accountName: string;
  equity: string;
  buyingPower: string;
  realizedPnl: string;
  unrealizedPnl: string;
  accountState: string | null;
} | null;

type TradeAccountStatusProps = {
  initialAccount: ActiveAccount;
  mode: "topbar" | "risk";
};

function formatUsd(value: string | number | null | undefined) {
  return Number(value ?? 0).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function useSmoothedNumber(value: string | number | null | undefined, duration = 140) {
  const target = Number(value ?? 0);
  const [displayValue, setDisplayValue] = useState(target);
  const frameRef = useRef<number | null>(null);
  const startValueRef = useRef(target);
  const startedAtRef = useRef(0);

  useEffect(() => {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }

    startValueRef.current = displayValue;
    startedAtRef.current = performance.now();

    const step = (now: number) => {
      const elapsed = now - startedAtRef.current;
      const progress = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      const nextValue = startValueRef.current + (target - startValueRef.current) * eased;
      setDisplayValue(nextValue);

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(step);
      } else {
        frameRef.current = null;
      }
    };

    frameRef.current = requestAnimationFrame(step);

    return () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [target]);

  return displayValue;
}

export function TradeAccountStatus({ initialAccount, mode }: TradeAccountStatusProps) {
  const live = useTradeLiveContext();
  const account = live?.activeAccount ?? initialAccount;
  const equity = useSmoothedNumber(account?.equity);
  const realizedPnl = useSmoothedNumber(account?.realizedPnl);
  const unrealizedPnl = useSmoothedNumber(account?.unrealizedPnl);
  const buyingPower = useSmoothedNumber(account?.buyingPower);

  if (mode === "topbar") {
    return (
      <div className="trade-now-status">
        <div><span>Account</span><strong>{account?.accountName ?? "No account"}</strong></div>
        <div><span>Status</span><strong className={account?.accountState === "BREACHED" ? "negative" : ""}>{account?.accountState ?? "ACTIVE"}</strong></div>
        <div><span>Equity</span><strong>{formatUsd(equity)}</strong></div>
        <div><span>Open P/L</span><strong className={Number(account?.unrealizedPnl ?? 0) >= 0 ? "positive" : "negative"}>{formatUsd(unrealizedPnl)}</strong></div>
      </div>
    );
  }

  return (
    <div className="trade-risk-grid">
      <div><span>Buying power</span><strong>{formatUsd(buyingPower)}</strong></div>
      <div><span>Equity</span><strong>{formatUsd(equity)}</strong></div>
      <div><span>Realized</span><strong>{formatUsd(realizedPnl)}</strong></div>
      <div><span>Unrealized</span><strong className={Number(account?.unrealizedPnl ?? 0) >= 0 ? "positive" : "negative"}>{formatUsd(unrealizedPnl)}</strong></div>
    </div>
  );
}
