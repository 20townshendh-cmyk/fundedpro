"use client";

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

export function TradeAccountStatus({ initialAccount, mode }: TradeAccountStatusProps) {
  const live = useTradeLiveContext();
  const account = live?.activeAccount ?? initialAccount;

  if (mode === "topbar") {
    return (
      <div className="trade-now-status">
        <div><span>Account</span><strong>{account?.accountName ?? "No account"}</strong></div>
        <div><span>Status</span><strong className={account?.accountState === "BREACHED" ? "negative" : ""}>{account?.accountState ?? "ACTIVE"}</strong></div>
        <div><span>Equity</span><strong>{formatUsd(account?.equity)}</strong></div>
        <div><span>Open P/L</span><strong className={Number(account?.unrealizedPnl ?? 0) >= 0 ? "positive" : "negative"}>{formatUsd(account?.unrealizedPnl)}</strong></div>
      </div>
    );
  }

  return (
    <div className="trade-risk-grid">
      <div><span>Buying power</span><strong>{formatUsd(account?.buyingPower)}</strong></div>
      <div><span>Equity</span><strong>{formatUsd(account?.equity)}</strong></div>
      <div><span>Realized</span><strong>{formatUsd(account?.realizedPnl)}</strong></div>
      <div><span>Unrealized</span><strong className={Number(account?.unrealizedPnl ?? 0) >= 0 ? "positive" : "negative"}>{formatUsd(account?.unrealizedPnl)}</strong></div>
    </div>
  );
}
