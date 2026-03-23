"use client";

import { startTransition, useState } from "react";
import { submitDemoOrderAction } from "../../../lib/demo-trading/actions";
import { emitTradeLiveRefresh } from "./trade-live-events";

type TradeStripActionsProps = {
  accountId: string | undefined;
  demoAccountId: string;
  instrumentId: string;
  symbol: string;
  marketDataSource: "LIVE_EXTERNAL" | "SIMULATED";
  tab: string;
  maxContracts: number;
  timeframe: string;
  layout: string;
  tradingLockedReason: string | null;
  accountOptions: Array<{
    id: string;
    accountName: string;
    equity: string;
    href: string;
    isActive: boolean;
  }>;
};

export function TradeStripActions({
  accountId,
  demoAccountId,
  instrumentId,
  symbol,
  marketDataSource,
  tab,
  maxContracts,
  timeframe,
  layout,
  tradingLockedReason,
  accountOptions
}: TradeStripActionsProps) {
  const [isAccountsOpen, setIsAccountsOpen] = useState(false);
  const [quantity, setQuantity] = useState("1");
  const [isPending, setIsPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const maxAllowed = Math.max(1, Math.floor(maxContracts));
  const presets = [1, 2, 5, 10].filter((value, index, array) => value <= maxAllowed && array.indexOf(value) === index);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const submitter = event.nativeEvent instanceof SubmitEvent ? event.nativeEvent.submitter : null;
    if (submitter instanceof HTMLButtonElement && submitter.name) {
      formData.set(submitter.name, submitter.value);
    }
    setMessage(null);
    setIsPending(true);
    startTransition(async () => {
      const result = await submitDemoOrderAction(formData);
      if (!result.ok) {
        setMessage(
          result.error === "market-closed"
            ? "Market is closed for this instrument right now."
            : result.error === "account-breached"
              ? "Account breached. New trade entry is disabled."
              : result.error === "price-stale"
                ? "Execution price is stale. Wait for a fresh tick before sending a market order."
                : "Order was rejected. Check buying power and inputs."
        );
      } else {
        emitTradeLiveRefresh();
      }
      setIsPending(false);
    });
  }

  return (
    <div className="trade-strip-actions">
      <div className="trade-strip-actions-row">
        <div className="trade-strip-qty">
          <span>Contracts</span>
          <input
            className="surface-input"
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
            disabled={Boolean(tradingLockedReason)}
          />
          <small>Max {maxAllowed.toLocaleString("en-US")}</small>
        </div>
        <div className="trade-strip-presets">
          {presets.map((preset) => (
            <button
              key={preset}
              type="button"
              className={`trade-chip${quantity === String(preset) ? " active" : ""}`}
              onClick={() => setQuantity(String(preset))}
              disabled={Boolean(tradingLockedReason)}
            >
              {preset}
            </button>
          ))}
        </div>
        <form onSubmit={handleSubmit}>
          <input type="hidden" name="demoAccountId" value={demoAccountId} />
          <input type="hidden" name="instrumentId" value={instrumentId} />
          <input type="hidden" name="symbol" value={symbol} />
          <input type="hidden" name="tab" value={tab} />
          <input type="hidden" name="accountId" value={accountId ?? ""} />
          <input type="hidden" name="timeframe" value={timeframe} />
          <input type="hidden" name="layout" value={layout} />
          <input type="hidden" name="type" value="MARKET" />
          <input type="hidden" name="quantity" value={quantity} />
          <button type="submit" name="side" value="BUY" className="trade-action-button buy large" disabled={isPending || Boolean(tradingLockedReason)}>BUY</button>
        </form>
        <form onSubmit={handleSubmit}>
          <input type="hidden" name="demoAccountId" value={demoAccountId} />
          <input type="hidden" name="instrumentId" value={instrumentId} />
          <input type="hidden" name="symbol" value={symbol} />
          <input type="hidden" name="tab" value={tab} />
          <input type="hidden" name="accountId" value={accountId ?? ""} />
          <input type="hidden" name="timeframe" value={timeframe} />
          <input type="hidden" name="layout" value={layout} />
          <input type="hidden" name="type" value="MARKET" />
          <input type="hidden" name="quantity" value={quantity} />
          <button type="submit" name="side" value="SELL" className="trade-action-button sell large" disabled={isPending || Boolean(tradingLockedReason)}>SELL</button>
        </form>
        <div className="trade-strip-accounts">
          <button
            type="button"
            className={`trade-strip-accounts-button${isAccountsOpen ? " active" : ""}`}
            onClick={() => setIsAccountsOpen((value) => !value)}
          >
            Accounts
          </button>
          {isAccountsOpen ? (
            <div className="trade-strip-account-list">
              {accountOptions.length ? accountOptions.map((account) => (
                <a
                  key={account.id}
                  href={account.href}
                  className={`trade-strip-account-chip${account.isActive ? " active" : ""}`}
                >
                  <strong>{account.accountName}</strong>
                  <small>{Number(account.equity).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })}</small>
                </a>
              )) : <div className="trade-strip-account-empty">No linked accounts</div>}
            </div>
          ) : null}
        </div>
      </div>
      <div className="trade-strip-note-row">
        <small className={marketDataSource === "LIVE_EXTERNAL" ? "positive" : ""}>
          {marketDataSource === "LIVE_EXTERNAL"
            ? "Fresh external ticks are active. Market buys cross the ask and sells cross the bid."
            : "Orders submit against the current Trade Now simulated live feed with spread-aware execution."}
        </small>
        {tradingLockedReason ? <small className="negative">{tradingLockedReason}</small> : message ? <small className="negative">{message}</small> : null}
      </div>
    </div>
  );
}
