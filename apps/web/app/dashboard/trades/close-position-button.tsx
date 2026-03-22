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
  triggerLabel?: string;
  triggerAriaLabel?: string;
  title?: string;
  message?: string;
  confirmLabel?: string;
  confirmTone?: "danger" | "warning";
  className?: string;
};

export function ClosePositionButton({
  demoAccountId,
  instrumentId,
  symbol,
  side,
  quantity,
  accountId,
  timeframe,
  layout,
  triggerLabel = "X",
  triggerAriaLabel,
  title,
  message,
  confirmLabel = "Close position",
  confirmTone = "danger",
  className = "trade-close-button"
}: ClosePositionButtonProps) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [messageText, setMessageText] = useState<string | null>(null);

  return (
    <>
      <TradeConfirmAction
        triggerClassName={className}
        triggerLabel={triggerLabel}
        triggerAriaLabel={triggerAriaLabel ?? `${confirmLabel} ${symbol} position`}
        title={title ?? `${confirmLabel} ${symbol} position`}
        message={message ?? `Submit a market order to close ${quantity} contract${quantity === 1 ? "" : "s"} of ${symbol}?`}
        confirmLabel={confirmLabel}
        confirmTone={confirmTone}
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

          setMessageText(null);
          setIsPending(true);
          await new Promise<void>((resolve) => {
            startTransition(async () => {
              const result = await submitDemoOrderAction(formData);
              if (!result.ok) {
                setMessageText(
                  result.error === "market-closed"
                    ? "Market is closed for this instrument right now."
                    : result.error === "price-stale"
                      ? "Execution price is stale. Wait for a fresh tick before sending a market order."
                      : "Order was rejected. Check buying power and inputs."
                );
              }
              router.refresh();
              setIsPending(false);
              resolve();
            });
          });
        }}
      />
      {messageText ? <small className="negative">{messageText}</small> : null}
    </>
  );
}
