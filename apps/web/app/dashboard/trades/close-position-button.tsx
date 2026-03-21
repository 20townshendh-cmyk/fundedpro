"use client";

import { useRouter } from "next/navigation";
import { startTransition, useState } from "react";
import { submitDemoOrderAction } from "../../../lib/demo-trading/actions";
import { TradeConfirmAction } from "./trade-confirm-action";

type ClosePositionButtonProps = {
  demoAccountId: string;
  instrumentId: string;
  symbol: string;
  side: "BUY" | "SELL";
  quantity: number;
  accountId: string | undefined;
  timeframe: string;
  layout: string;
};

export function ClosePositionButton({
  demoAccountId,
  instrumentId,
  symbol,
  side,
  quantity,
  accountId,
  timeframe,
  layout
}: ClosePositionButtonProps) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  return (
    <>
      <TradeConfirmAction
        triggerClassName="trade-close-button"
        triggerLabel="×"
        triggerAriaLabel={`Close ${symbol} position`}
        title={`Close ${symbol} position`}
        message={`Submit a market order to close ${quantity} contract${quantity === 1 ? "" : "s"} of ${symbol}?`}
        confirmLabel="Close position"
        confirmTone="danger"
        disabled={isPending}
        onConfirm={async () => {
          const formData = new FormData();
          formData.set("demoAccountId", demoAccountId);
          formData.set("instrumentId", instrumentId);
          formData.set("symbol", symbol);
          formData.set("side", side);
          formData.set("tab", "positions");
          formData.set("accountId", accountId ?? "");
          formData.set("type", "MARKET");
          formData.set("quantity", String(quantity));
          formData.set("timeframe", timeframe);
          formData.set("layout", layout);

          setMessage(null);
          setIsPending(true);
          await new Promise<void>((resolve) => {
            startTransition(async () => {
              const result = await submitDemoOrderAction(formData);
              if (!result.ok) {
                setMessage(result.error === "market-closed" ? "Market is closed for this instrument right now." : "Order was rejected. Check buying power and inputs.");
              }
              router.refresh();
              setIsPending(false);
              resolve();
            });
          });
        }}
      />
      {message ? <small className="negative">{message}</small> : null}
    </>
  );
}
