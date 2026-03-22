"use client";

import { ClosePositionButton } from "./close-position-button";
import { useTradeLiveContext } from "./trade-live-context";

type PositionRow = {
  instrumentId: string;
  symbol: string;
  side: string;
  quantity: number;
  averageEntryPrice: string;
  lastPrice: string;
  unrealizedPnl: string;
};

type PositionsTableProps = {
  accountId: string | undefined;
  demoAccountId: string;
  symbol: string;
  timeframe: string;
  layout: string;
  positions: PositionRow[];
};

function formatUsd(value: string | number | null | undefined) {
  return Number(value ?? 0).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function getReduceQuantity(quantity: number, fraction: number) {
  return Math.max(1, Math.floor(quantity * fraction));
}

export function PositionsTable({ accountId, demoAccountId, symbol, timeframe, layout, positions: initialPositions }: PositionsTableProps) {
  const live = useTradeLiveContext();
  const positions = live?.positions ?? initialPositions;

  return (
    <div className="trade-table terminal">
      <div className="trade-table-head">
        <span>Symbol</span><span>Side</span><span>Qty</span><span>Avg</span><span>Last</span><span>P/L</span><span>Actions</span>
      </div>
      {positions.length ? positions.map((position) => (
        <div key={`${position.symbol}-${position.side}`} className="trade-table-row">
          <span>{position.symbol}</span>
          <span>{position.side}</span>
          <span>{position.quantity}</span>
          <span>{position.averageEntryPrice}</span>
          <span>{position.lastPrice}</span>
          <span className={Number(position.unrealizedPnl) >= 0 ? "positive" : "negative"}>{formatUsd(position.unrealizedPnl)}</span>
          <div className="trade-position-actions">
            <ClosePositionButton
              demoAccountId={demoAccountId}
              instrumentId={position.instrumentId}
              symbol={position.symbol}
              side={position.side === "LONG" ? "SELL" : "BUY"}
              quantity={getReduceQuantity(position.quantity, 0.5)}
              accountId={accountId}
              timeframe={timeframe}
              layout={layout}
              triggerLabel="1/2"
              confirmLabel="Reduce"
              confirmTone="warning"
              className="trade-close-button secondary"
              message={`Submit a market order to reduce ${position.symbol} by ${getReduceQuantity(position.quantity, 0.5)} contract${getReduceQuantity(position.quantity, 0.5) === 1 ? "" : "s"}?`}
            />
            <ClosePositionButton
              demoAccountId={demoAccountId}
              instrumentId={position.instrumentId}
              symbol={position.symbol}
              side={position.side === "LONG" ? "SELL" : "BUY"}
              quantity={position.quantity}
              accountId={accountId}
              timeframe={timeframe}
              layout={layout}
              triggerLabel="Flat"
              confirmLabel="Flatten"
              confirmTone="danger"
              className="trade-close-button"
              message={`Submit a market order to flatten all ${position.quantity} contract${position.quantity === 1 ? "" : "s"} of ${position.symbol}?`}
            />
            <ClosePositionButton
              demoAccountId={demoAccountId}
              instrumentId={position.instrumentId}
              symbol={position.symbol}
              side={position.side === "LONG" ? "SELL" : "BUY"}
              quantity={position.quantity * 2}
              accountId={accountId}
              timeframe={timeframe}
              layout={layout}
              triggerLabel="Rev"
              confirmLabel="Reverse"
              confirmTone="warning"
              className="trade-close-button secondary"
              message={`Submit a market order to reverse ${position.symbol} and open ${position.quantity} contract${position.quantity === 1 ? "" : "s"} in the opposite direction?`}
            />
          </div>
        </div>
      )) : <div className="trade-empty">No positions yet.</div>}
    </div>
  );
}
