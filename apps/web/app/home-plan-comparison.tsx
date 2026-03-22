"use client";

import { useEffect, useState } from "react";
import { MARKETING_SALE_DISCOUNT_PCT, challengePlans } from "@fundedpro/domain/marketing";

function parsePriceLabel(label: string) {
  return Number(label.replace(/[^0-9.]/g, ""));
}

export function HomePlanComparison() {
  const defaultPlan = challengePlans.find((plan) => plan.featured) ?? challengePlans[1] ?? challengePlans[0];
  const [selectedPlanName, setSelectedPlanName] = useState(defaultPlan?.name);
  const selectedPlan = challengePlans.find((plan) => plan.name === selectedPlanName) ?? defaultPlan;
  const mobileRules = [
    { label: "Structure", evaluation: "1-step evaluation", funded: "Master account" },
    { label: "Account size", evaluation: selectedPlan?.accountSize ?? "$100K", funded: selectedPlan?.accountSize ?? "$100K" },
    { label: "Profit target", evaluation: "6% profit target", funded: "No fixed target after approval" },
    { label: "Daily drawdown", evaluation: "2% daily drawdown", funded: "2% daily drawdown" },
    { label: "Max drawdown", evaluation: "5% max drawdown", funded: "5% max drawdown" },
    { label: "Trading days", evaluation: "Minimum 3 trading days", funded: "Minimum 3 trading days" },
    { label: "Payout split", evaluation: "Inactive during evaluation", funded: "Up to 85%" },
    { label: "Visibility", evaluation: "Targets, drawdown, and phase status", funded: "Payout holds, audits, and risk controls" }
  ];

  useEffect(() => {
    const syncFromHash = () => {
      if (window.location.hash === "#plans-600k") {
        setSelectedPlanName("Apex");
      }
    };

    syncFromHash();
    window.addEventListener("hashchange", syncFromHash);
    return () => window.removeEventListener("hashchange", syncFromHash);
  }, []);

  return (
    <div
      className={`evaluation-board${selectedPlan?.name === "Apex" ? " evaluation-board-premium" : ""}`}
      id="plans-600k"
    >
      <div className="evaluation-pill-heading">Plans</div>

      <div className="evaluation-pill-row compact">
        {challengePlans.map((plan) => (
          (() => {
            const savings = plan.originalPrice ? parsePriceLabel(plan.originalPrice) - parsePriceLabel(plan.price) : 0;
            return (
          <button
            key={plan.shortLabel}
            type="button"
            className={`evaluation-pill compact${plan.name === selectedPlan?.name ? " active" : ""}${plan.name === "Apex" ? " premium" : ""}`}
            onClick={() => setSelectedPlanName(plan.name)}
          >
            <strong>{plan.accountSize}</strong>
            <span className="evaluation-pill-price-group">
              {plan.originalPrice ? <span className="evaluation-pill-original-price">{plan.originalPrice}</span> : null}
              <span>{plan.price}</span>
            </span>
            {savings > 0 ? <span className="evaluation-pill-savings">Save ${savings}</span> : null}
          </button>
            );
          })()
        ))}
      </div>
      <div className="evaluation-promo-note">{MARKETING_SALE_DISCOUNT_PCT}% off</div>
      <div className="evaluation-limit-note">
        {selectedPlan?.name === "Apex"
          ? "You can hold up to 5 active challenge accounts at once, but only 2 can be $600K accounts. If one fails, you can buy another."
          : "You can hold up to 5 active challenge accounts at once. Out of those 5, only 2 can be $600K accounts. Failed accounts free up a slot so you can buy another."}
      </div>

      <div className="evaluation-mobile-cards">
        {mobileRules.map((rule) => (
          <article key={rule.label} className="evaluation-mobile-card">
            <strong>{rule.label}</strong>
            <div>
              <span>Evaluation</span>
              <p>{rule.evaluation}</p>
            </div>
            <div>
              <span>Funded</span>
              <p>{rule.funded}</p>
            </div>
          </article>
        ))}
      </div>

      <div className="evaluation-table-wrap">
        <table className="evaluation-table">
          <thead>
            <tr>
              <th>Rule</th>
              <th>Evaluation</th>
              <th>Funded</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Structure</td>
              <td>1-step evaluation</td>
              <td>Master account</td>
            </tr>
            <tr>
              <td>Account size</td>
              <td>{selectedPlan?.accountSize ?? "$100K"}</td>
              <td>{selectedPlan?.accountSize ?? "$100K"}</td>
            </tr>
            <tr>
              <td>Profit target</td>
              <td>6% profit target</td>
              <td>No fixed target after approval</td>
            </tr>
            <tr>
              <td>Daily drawdown</td>
              <td>2% daily drawdown</td>
              <td>2% daily drawdown</td>
            </tr>
            <tr>
              <td>Max drawdown</td>
              <td>5% max drawdown</td>
              <td>5% max drawdown</td>
            </tr>
            <tr>
              <td>Trading days</td>
              <td>Minimum 3 trading days</td>
              <td>Minimum 3 trading days</td>
            </tr>
            <tr>
              <td>Payout split</td>
              <td>Not active during evaluation</td>
              <td>Up to 85%</td>
            </tr>
            <tr>
              <td>Visibility</td>
              <td>Targets, drawdown, and phase status</td>
              <td>Payout holds, audits, and risk controls</td>
            </tr>
          </tbody>
        </table>
      </div>
      <a href="/terms" className="evaluation-terms-link">
        Terms and Conditions
      </a>
      <div className="evaluation-activation-note">No activation fee on any FundedPro account.</div>
    </div>
  );
}
