"use client";

import { useRef } from "react";
import { TradeConfirmAction } from "./trade-confirm-action";

type ConfirmButtonProps = {
  className: string;
  label: string;
  message: string;
  name?: string;
  value?: string;
  ariaLabel?: string;
};

export function ConfirmButton({ className, label, message, name, value, ariaLabel }: ConfirmButtonProps) {
  const formRef = useRef<HTMLFormElement | null>(null);

  return (
    <TradeConfirmAction
      triggerClassName={className}
      triggerLabel={label}
      triggerAriaLabel={ariaLabel}
      title="Cancel working order"
      message={message}
      confirmLabel="Cancel order"
      confirmTone="warning"
      onOpen={(trigger) => {
        formRef.current = trigger.closest("form");
      }}
      onConfirm={() => {
        const form = formRef.current;

        if (!(form instanceof HTMLFormElement)) {
          return;
        }

        const submitter = document.createElement("button");
        submitter.type = "submit";
        submitter.hidden = true;

        if (name) {
          submitter.name = name;
        }

        if (value) {
          submitter.value = value;
        }

        form.appendChild(submitter);
        form.requestSubmit(submitter);
        submitter.remove();
      }}
    />
  );
}
