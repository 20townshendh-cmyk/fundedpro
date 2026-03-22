"use client";

import { useRouter } from "next/navigation";
import { startTransition, useState } from "react";
import { submitDemoOrderAction } from "../../../lib/demo-trading/actions";

type DepthRow = {
  price: number;
  bid: number;
  ask: number;
  last: boolean;
};

type TradeTerminalControlsProps = {
  accountId: string | undefined;
  activeAccountId: string;
  instrumentId: string;
  symbol: string;
  tab: string;
  depthRows: DepthRow[];
  defaultLimitPrice: string;
  maxContracts: number;
  timeframe: string;
  layout: string;
  tradingLockedReason: string | null;
};

export function TradeTerminalControls({
  accountId,
  activeAccountId,
  instrumentId,
  symbol,
  tab,
  depthRows,
  defaultLimitPrice,
  maxContracts,
  timeframe,
  layout,
  tradingLockedReason
}: TradeTerminalControlsProps) {
  const router = useRouter();
  const [orderType, setOrderType] = useState<"MARKET" | "LIMIT">("MARKET");
  const [side, setSide] = useState<"BUY" | "SELL">("BUY");
  const [quantity, setQuantity] = useState("1");
  const [limitPrice, setLimitPrice] = useState(defaultLimitPrice);
  const [timeInForce, setTimeInForce] = useState("DAY");
  const [automation, setAutomation] = useState("OFF");
  const [isPending, setIsPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function prefillLimit(price: number) {
    setOrderType("LIMIT");
    setLimitPrice(price.toFixed(2));
  }

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
      }
      router.refresh();
      setIsPending(false);
    });
  }

  return (
    <>
      <div className="trade-ticket-stack">
        <div className="trade-ticket-toolbar">
          <div className="trade-ticket-capacity">Max {Math.max(0, Math.floor(maxContracts)).toLocaleString("en-US")} ctr</div>
          <div className="trade-ticket-meta">
            <label>
              <span>Qty</span>
              <input className="surface-input" value={quantity} onChange={(event) => setQuantity(event.target.value)} disabled={Boolean(tradingLockedReason)} />
            </label>
            <label>
              <span>Type</span>
              <select className="surface-select" value={orderType} onChange={(event) => setOrderType(event.target.value as "MARKET" | "LIMIT")} disabled={Boolean(tradingLockedReason)}>
                <option value="MARKET">Mkt</option>
                <option value="LIMIT">Lmt</option>
              </select>
            </label>
          </div>
          <div className="trade-ticket-meta">
            <label>
              <span>TIF</span>
              <select className="surface-select" value={timeInForce} onChange={(event) => setTimeInForce(event.target.value)} disabled={Boolean(tradingLockedReason)}>
                <option value="DAY">DAY</option>
                <option value="GTC">GTC</option>
              </select>
            </label>
            <label>
              <span>ATM</span>
              <select className="surface-select" value={automation} onChange={(event) => setAutomation(event.target.value)} disabled={Boolean(tradingLockedReason)}>
                <option value="OFF">OFF</option>
                <option value="BASIC">BASIC</option>
              </select>
            </label>
          </div>
        </div>
      </div>

      <div className="trade-ladder-book">
        <div className="trade-ladder-book-head">
          <span>Bid</span>
          <span>Price</span>
          <span>Ask</span>
        </div>
        {depthRows.map((row) => (
          <div key={row.price} className={`trade-ladder-row${row.last ? " active" : ""}`}>
            <form onSubmit={handleSubmit} className="trade-ladder-order-form">
              <input type="hidden" name="demoAccountId" value={activeAccountId} />
              <input type="hidden" name="instrumentId" value={instrumentId} />
              <input type="hidden" name="symbol" value={symbol} />
              <input type="hidden" name="tab" value={tab} />
              <input type="hidden" name="accountId" value={accountId ?? ""} />
              <input type="hidden" name="timeframe" value={timeframe} />
              <input type="hidden" name="layout" value={layout} />
              <input type="hidden" name="type" value="LIMIT" />
              <input type="hidden" name="quantity" value={quantity} />
              <input type="hidden" name="limitPrice" value={row.price.toFixed(2)} />
              <button type="submit" name="side" value="BUY" className="trade-ladder-side positive" disabled={isPending || Boolean(tradingLockedReason)}>
                <span>{row.bid || ""}</span>
                <strong>{row.price.toFixed(2)}</strong>
              </button>
            </form>
            <button
              type="button"
              className="trade-ladder-price"
              onClick={() => prefillLimit(row.price)}
              disabled={Boolean(tradingLockedReason)}
            >
              {row.price.toFixed(2)}
            </button>
            <form onSubmit={handleSubmit} className="trade-ladder-order-form">
              <input type="hidden" name="demoAccountId" value={activeAccountId} />
              <input type="hidden" name="instrumentId" value={instrumentId} />
              <input type="hidden" name="symbol" value={symbol} />
              <input type="hidden" name="tab" value={tab} />
              <input type="hidden" name="accountId" value={accountId ?? ""} />
              <input type="hidden" name="timeframe" value={timeframe} />
              <input type="hidden" name="layout" value={layout} />
              <input type="hidden" name="type" value="LIMIT" />
              <input type="hidden" name="quantity" value={quantity} />
              <input type="hidden" name="limitPrice" value={row.price.toFixed(2)} />
              <button type="submit" name="side" value="SELL" className="trade-ladder-side negative" disabled={isPending || Boolean(tradingLockedReason)}>
                <span>{row.ask || ""}</span>
                <strong>{row.price.toFixed(2)}</strong>
              </button>
            </form>
          </div>
        ))}
      </div>

      <article className="trade-order-strip">
        <form onSubmit={handleSubmit} className="trade-order-strip-form">
          <input type="hidden" name="demoAccountId" value={activeAccountId} />
          <input type="hidden" name="instrumentId" value={instrumentId} />
          <input type="hidden" name="symbol" value={symbol} />
          <input type="hidden" name="tab" value={tab} />
          <input type="hidden" name="accountId" value={accountId ?? ""} />
          <input type="hidden" name="timeframe" value={timeframe} />
          <input type="hidden" name="layout" value={layout} />
          <input type="hidden" name="timeInForce" value={timeInForce} />
          <input type="hidden" name="automation" value={automation} />
          <select className="surface-select" name="side" value={side} onChange={(event) => setSide(event.target.value as "BUY" | "SELL")} disabled={Boolean(tradingLockedReason)}>
            <option value="BUY">Buy</option>
            <option value="SELL">Sell</option>
          </select>
          <select className="surface-select" name="type" value={orderType} onChange={(event) => setOrderType(event.target.value as "MARKET" | "LIMIT")} disabled={Boolean(tradingLockedReason)}>
            <option value="MARKET">Mkt</option>
            <option value="LIMIT">Lmt</option>
          </select>
          <input className="surface-input" name="quantity" value={quantity} onChange={(event) => setQuantity(event.target.value)} disabled={Boolean(tradingLockedReason)} />
          {orderType === "LIMIT" ? (
            <input
              className="surface-input trade-order-limit-input"
              name="limitPrice"
              value={limitPrice}
              onChange={(event) => setLimitPrice(event.target.value)}
              disabled={Boolean(tradingLockedReason)}
              placeholder="Limit"
            />
          ) : (
            <input type="hidden" name="limitPrice" value={limitPrice} />
          )}
          <button type="submit" className="trade-action-button neutral trade-order-send" disabled={isPending || Boolean(tradingLockedReason)}>Send</button>
        </form>
        {tradingLockedReason ? <small className="negative">{tradingLockedReason}</small> : message ? <small className="negative">{message}</small> : null}
      </article>
    </>
  );
}
