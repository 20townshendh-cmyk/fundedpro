"use client";

import { useEffect, useId, useState, type ReactNode } from "react";

type TradeConfirmActionProps = {
  triggerClassName: string;
  triggerLabel: ReactNode;
  triggerAriaLabel?: string | undefined;
  title: string;
  message: string;
  confirmLabel: string;
  confirmTone?: "danger" | "warning";
  disabled?: boolean;
  onOpen?: ((trigger: HTMLButtonElement) => void) | undefined;
  onConfirm: () => void | Promise<void>;
};

export function TradeConfirmAction({
  triggerClassName,
  triggerLabel,
  triggerAriaLabel,
  title,
  message,
  confirmLabel,
  confirmTone = "warning",
  disabled = false,
  onOpen,
  onConfirm
}: TradeConfirmActionProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const titleId = useId();

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && !isPending) {
        setIsOpen(false);
      }
    }

    window.addEventListener("keydown", handleEscape);

    return () => window.removeEventListener("keydown", handleEscape);
  }, [isOpen, isPending]);

  async function handleConfirm() {
    setIsPending(true);

    try {
      await onConfirm();
      setIsOpen(false);
    } finally {
      setIsPending(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className={triggerClassName}
        aria-label={triggerAriaLabel}
        disabled={disabled}
        onClick={(event) => {
          onOpen?.(event.currentTarget);
          setIsOpen(true);
        }}
      >
        {triggerLabel}
      </button>
      {isOpen ? (
        <div className="trade-confirm-backdrop" role="presentation" onClick={() => (isPending ? null : setIsOpen(false))}>
          <section
            className="trade-confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="trade-confirm-head">
              <div>
                <p className="eyebrow">Confirm action</p>
                <strong id={titleId}>{title}</strong>
              </div>
              <button
                type="button"
                className="trade-confirm-close"
                aria-label="Close confirmation dialog"
                disabled={isPending}
                onClick={() => setIsOpen(false)}
              >
                x
              </button>
            </div>
            <p className="surface-copy">{message}</p>
            <div className="trade-confirm-actions">
              <button type="button" className="ghost-button compact-button" disabled={isPending} onClick={() => setIsOpen(false)}>
                Keep open
              </button>
              <button
                type="button"
                className={`trade-confirm-submit ${confirmTone}`}
                disabled={isPending}
                onClick={() => {
                  void handleConfirm();
                }}
              >
                {isPending ? "Working..." : confirmLabel}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
