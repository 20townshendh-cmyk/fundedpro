"use client";

import { useMemo, useState } from "react";
import { MARKETING_SALE_DISCOUNT_PCT } from "@fundedpro/domain/marketing";
import { startChallengeCheckoutAction } from "../../lib/trader";

function formatUsd(cents: number) {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

type CheckoutSubmitCardProps = {
  planSlug: string;
  priceCents: number;
  loggedIn: boolean;
};

export function CheckoutSubmitCard({ planSlug, priceCents, loggedIn }: CheckoutSubmitCardProps) {
  const [couponCode, setCouponCode] = useState("");
  const normalizedCode = couponCode.trim().toUpperCase();
  const extraDiscountPct = normalizedCode === "HELLO" ? 20 : 0;
  const finalPriceCents = useMemo(
    () => Math.max(0, Math.round(priceCents * (1 - (MARKETING_SALE_DISCOUNT_PCT + extraDiscountPct) / 100))),
    [extraDiscountPct, priceCents]
  );

  if (!loggedIn) {
    return (
      <div className="button-row">
        <a href="/signup" className="dashboard-link">Create account</a>
        <a href="/login" className="dashboard-link">Login to buy</a>
      </div>
    );
  }

  return (
    <>
      <div className="checkout-summary-block">
        <label className="field-block">
          <span className="muted-label">Coupon code</span>
          <input
            className="surface-input"
            type="text"
            name="couponCodePreview"
            value={couponCode}
            onChange={(event) => setCouponCode(event.target.value)}
            placeholder="Enter code"
          />
        </label>
        <div className="checkout-status-row">
          <span className="muted-label">Automatic sale</span>
          <span>-{MARKETING_SALE_DISCOUNT_PCT}%</span>
        </div>
        <div className="checkout-status-row">
          <span className="muted-label">Extra code discount</span>
          <span>{extraDiscountPct ? `-${extraDiscountPct}%` : "None"}</span>
        </div>
        <div className="checkout-total-row">
          <span>Total after discount</span>
          <strong>{formatUsd(finalPriceCents)}</strong>
        </div>
      </div>

      <form action={startChallengeCheckoutAction} className="checkout-confirm-form">
        <input type="hidden" name="planSlug" value={planSlug} />
        <input type="hidden" name="couponCode" value={couponCode} />
        <button type="submit" className="checkout-confirm-button">Continue to Checkout</button>
      </form>
    </>
  );
}
