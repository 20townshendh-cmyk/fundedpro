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

export function PositionsTable({ accountId, demoAccountId, symbol, timeframe, layout, positions: initialPositions }: PositionsTableProps) {
  const live = useTradeLiveContext();
  const positions = live?.positions ?? initialPositions;

  return (
    <div className="trade-table terminal">
      <div className="trade-table-head">
        <span>Symbol</span><span>Side</span><span>Qty</span><span>Avg</span><span>Last</span><span>P/L</span><span>Close</span>
      </div>
      {positions.length ? positions.map((position) => (
        <div key={`${position.symbol}-${position.side}`} className="trade-table-row">
          <span>{position.symbol}</span>
          <span>{position.side}</span>
          <span>{position.quantity}</span>
          <span>{position.averageEntryPrice}</span>
          <span>{position.lastPrice}</span>
          <span className={Number(position.unrealizedPnl) >= 0 ? "positive" : "negative"}>{formatUsd(position.unrealizedPnl)}</span>
          <ClosePositionButton
            demoAccountId={demoAccountId}
            instrumentId={position.instrumentId}
            symbol={position.symbol}
            side={position.side === "LONG" ? "SELL" : "BUY"}
            quantity={position.quantity}
            accountId={accountId}
            timeframe={timeframe}
            layout={layout}
          />
        </div>
      )) : <div className="trade-empty">No positions yet.</div>}
    </div>
  );
}
