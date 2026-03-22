import { MARKETING_SALE_DISCOUNT_PCT, getChallengePlanBasePriceCents } from "@fundedpro/domain/marketing";
import { getDb } from "@fundedpro/db";
import { Footer, SiteShell, TopNav } from "@fundedpro/ui";
import { getSession } from "../../lib/auth";
import { getCheckoutPurchaseCapacity } from "../../lib/trader";
import { CheckoutSubmitCard } from "./checkout-submit-card";

const FALLBACK_CHECKOUT_PLANS = [
  {
    slug: "starter-50k",
    name: "Starter",
    challengeType: "ONE_STEP",
    accountSize: 50000,
    priceCents: 20000,
    phaseCount: 1,
    minTradingDays: 3,
    payoutSplitPct: "85.00",
    profitTargetPct: "6.00",
    dailyDrawdownPct: "2.00",
    maxDrawdownPct: "5.00"
  },
  {
    slug: "pro-100k",
    name: "Pro",
    challengeType: "ONE_STEP",
    accountSize: 100000,
    priceCents: 30000,
    phaseCount: 1,
    minTradingDays: 3,
    payoutSplitPct: "85.00",
    profitTargetPct: "6.00",
    dailyDrawdownPct: "2.00",
    maxDrawdownPct: "5.00"
  },
  {
    slug: "elite-150k",
    name: "Elite",
    challengeType: "ONE_STEP",
    accountSize: 150000,
    priceCents: 40000,
    phaseCount: 1,
    minTradingDays: 3,
    payoutSplitPct: "85.00",
    profitTargetPct: "6.00",
    dailyDrawdownPct: "2.00",
    maxDrawdownPct: "5.00"
  },
  {
    slug: "apex-600k",
    name: "Apex",
    challengeType: "ONE_STEP",
    accountSize: 600000,
    priceCents: 80000,
    phaseCount: 1,
    minTradingDays: 3,
    payoutSplitPct: "85.00",
    profitTargetPct: "6.00",
    dailyDrawdownPct: "2.00",
    maxDrawdownPct: "5.00"
  }
] as const;

function formatUsd(cents: number) {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function getDiscountedPriceCents(priceCents: number) {
  return Math.max(0, Math.round(priceCents * (1 - MARKETING_SALE_DISCOUNT_PCT / 100)));
}

function formatPct(value: string) {
  return `${Number(value)}%`;
}

type CheckoutPageProps = {
  searchParams: Promise<{ planSlug?: string; error?: string }>;
};

export default async function CheckoutLandingPage({ searchParams }: CheckoutPageProps) {
  const session = await getSession();
  const { planSlug, error } = await searchParams;
  const db = getDb();
  const plans = await db.query<{
    slug: string;
    name: string;
    challengeType: string;
    accountSize: number;
    priceCents: number;
    phaseCount: number;
    minTradingDays: number;
    payoutSplitPct: string;
    profitTargetPct: string;
    dailyDrawdownPct: string;
    maxDrawdownPct: string;
  }>(
    `
      SELECT "slug", "name", "challengeType", "accountSize", "priceCents", "phaseCount", "minTradingDays", "payoutSplitPct"::text, "profitTargetPct"::text, "dailyDrawdownPct"::text, "maxDrawdownPct"::text
      FROM "ChallengePlan"
      ORDER BY "priceCents" ASC
    `
  );
  const allPlans = [...plans.rows];

  for (const fallbackPlan of FALLBACK_CHECKOUT_PLANS) {
    if (!allPlans.some((plan) => plan.slug === fallbackPlan.slug)) {
      allPlans.push({ ...fallbackPlan });
    }
  }

  for (const plan of allPlans) {
    plan.priceCents = getChallengePlanBasePriceCents(plan.slug, plan.priceCents);
  }

  const selectedPlan = allPlans.find((plan) => plan.slug === planSlug) ?? allPlans[1] ?? allPlans[0] ?? FALLBACK_CHECKOUT_PLANS[0];
  const minTradingDays = selectedPlan.minTradingDays;
  const discountedSelectedPriceCents = getDiscountedPriceCents(selectedPlan.priceCents);
  const purchaseCapacity = session ? await getCheckoutPurchaseCapacity(db, session.userId) : {
    activeAccountCount: 0,
    activeApexAccountCount: 0,
    maxActiveAccounts: 5,
    maxActiveApexAccounts: 2
  };

  return (
    <SiteShell>
      <TopNav />
      <main className="checkout-shell">
        <section className="checkout-layout">
          <section className="checkout-builder">
            <div className="checkout-header">
              <div>
                <p className="eyebrow">New Challenge</p>
                <h1 className="page-title">Build your funded path</h1>
                <p className="page-copy">Choose the challenge that matches your trading style, then continue into checkout and Phynic account setup.</p>
                <p className="checkout-promo-callout">{MARKETING_SALE_DISCOUNT_PCT}% off</p>
              </div>
            </div>

            <section className="checkout-section">
              <div className="checkout-section-head">
                <h2>Challenge Size</h2>
                <p>Pick the account size and challenge model you want to launch</p>
              </div>
              <div className="checkout-option-grid three-up">
                {allPlans.map((plan) => (
                  (() => {
                    const discountedPriceCents = getDiscountedPriceCents(plan.priceCents);
                    const savingsCents = plan.priceCents - discountedPriceCents;
                    return (
                  <a key={plan.slug} href={`/checkout?planSlug=${plan.slug}`} className={`checkout-option${selectedPlan.slug === plan.slug ? " selected" : ""}${plan.slug === "apex-600k" ? " premium" : ""}`}>
                    <span className="checkout-radio" />
                    <div>
                      <strong>{plan.accountSize.toLocaleString("en-GB", { style: "currency", currency: "USD", maximumFractionDigits: 0 })}</strong>
                      <p>{plan.name}</p>
                      <span>{minTradingDays} day minimum</span>
                      <div className="checkout-option-price-line">
                        <span className="checkout-original-price">{formatUsd(plan.priceCents)}</span>
                        <strong>{formatUsd(discountedPriceCents)}</strong>
                        <span className="checkout-option-savings">Save {formatUsd(savingsCents)}</span>
                      </div>
                      {plan.slug === "apex-600k" ? (
                        <span className="checkout-option-limit-note">You can have up to 2 active 600K accounts at once. If one fails, you can buy another.</span>
                      ) : null}
                    </div>
                  </a>
                    );
                  })()
                ))}
                <div className="checkout-plan-side-note">
                  <strong>{purchaseCapacity.activeAccountCount} Active {purchaseCapacity.activeAccountCount === 1 ? "Account" : "Accounts"}</strong>
                  <span>
                    You can hold up to {purchaseCapacity.maxActiveAccounts} active challenge accounts at once, with up to {purchaseCapacity.maxActiveApexAccounts} active $600K accounts.
                    {" "}
                    Failed accounts no longer count, so once one fails you can buy another.
                  </span>
                  <span>
                    Current usage: {purchaseCapacity.activeAccountCount}/{purchaseCapacity.maxActiveAccounts} total and {purchaseCapacity.activeApexAccountCount}/{purchaseCapacity.maxActiveApexAccounts} for $600K.
                  </span>
                </div>
              </div>
            </section>

            <section className="checkout-section checkout-rules-card">
              <div className="checkout-rules-head">
                <div className="checkout-rules-icon">FP</div>
                <div>
                  <h2>Challenge Rules</h2>
                  <p>Evaluation and funded conditions for your selected plan.</p>
                </div>
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
                      <td>{selectedPlan.phaseCount > 1 ? "2-step evaluation" : "1-step evaluation"}</td>
                      <td>Master account</td>
                    </tr>
                    <tr>
                      <td>Account size</td>
                      <td>{selectedPlan.accountSize.toLocaleString("en-GB", { style: "currency", currency: "USD", maximumFractionDigits: 0 })}</td>
                      <td>{selectedPlan.accountSize.toLocaleString("en-GB", { style: "currency", currency: "USD", maximumFractionDigits: 0 })}</td>
                    </tr>
                    <tr>
                      <td>Profit target</td>
                      <td>{formatPct(selectedPlan.profitTargetPct)} profit target</td>
                      <td>No fixed target after approval</td>
                    </tr>
                    <tr>
                      <td>Daily drawdown</td>
                      <td>{formatPct(selectedPlan.dailyDrawdownPct)} daily drawdown</td>
                      <td>{formatPct(selectedPlan.dailyDrawdownPct)} daily drawdown</td>
                    </tr>
                    <tr>
                      <td>Max drawdown</td>
                      <td>{formatPct(selectedPlan.maxDrawdownPct)} max drawdown</td>
                      <td>{formatPct(selectedPlan.maxDrawdownPct)} max drawdown</td>
                    </tr>
                    <tr>
                      <td>Trading days</td>
                      <td>Minimum {minTradingDays} trading days</td>
                      <td>Minimum {minTradingDays} trading days</td>
                    </tr>
                    <tr>
                      <td>Payout split</td>
                      <td>Not active during evaluation</td>
                      <td>Up to {formatPct(selectedPlan.payoutSplitPct)}</td>
                    </tr>
                    <tr>
                      <td>Visibility</td>
                      <td>Targets, drawdown, and phase status</td>
                      <td>Payout holds, audits, and risk controls</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>
          </section>

          <aside className="checkout-summary">
            <div className="checkout-summary-block">
              <h2>Order Summary</h2>
            </div>
            <div className="checkout-summary-block">
              <strong className="checkout-summary-title">
                {selectedPlan.accountSize.toLocaleString("en-GB", { style: "currency", currency: "USD", maximumFractionDigits: 0 })} | {selectedPlan.name}
              </strong>
              <p className="surface-copy">Platform: Phynic</p>
              <div className="checkout-status-row">
                <span className="muted-label">Payout split</span>
                <span>{selectedPlan.payoutSplitPct}%</span>
              </div>
              <div className="checkout-status-row">
                <span className="muted-label">Minimum trading days</span>
                <span>{minTradingDays}</span>
              </div>
              <div className="checkout-status-row">
                <span className="muted-label">Standard price</span>
                <span className="checkout-original-price">{formatUsd(selectedPlan.priceCents)}</span>
              </div>
              <div className="checkout-status-row">
                <span className="muted-label">Sale</span>
                <span>-{MARKETING_SALE_DISCOUNT_PCT}%</span>
              </div>
            </div>
            <div className="checkout-summary-block">
              <div className="checkout-total-row">
                <span>Total</span>
                <strong>{formatUsd(discountedSelectedPriceCents)}</strong>
              </div>
              <div className="checkout-agreement">
                <label className="checkout-checkbox-row">
                  <input type="checkbox" checked readOnly />
                  <span>Challenge terms, Phynic account setup, and payment routing are included in this checkout flow.</span>
                </label>
              </div>
              {error === "invalid-coupon" ? <p className="checkout-error-copy">Coupon code is invalid.</p> : null}
              {error === "active-account" ? <p className="checkout-error-copy">You can hold up to 5 active challenge accounts at once, and only 2 of those can be $600K accounts. Failed accounts free up a slot.</p> : null}
              {error === "account-limit" ? <p className="checkout-error-copy">You can only hold 5 active challenge accounts at once. Failed accounts free up a slot so you can buy another.</p> : null}
              {error === "apex-limit" ? <p className="checkout-error-copy">You can only hold 2 active $600K accounts at once. Once one fails, you can buy another $600K challenge.</p> : null}
            </div>
            <CheckoutSubmitCard planSlug={selectedPlan.slug} priceCents={selectedPlan.priceCents} loggedIn={Boolean(session)} />
          </aside>
        </section>
      </main>
      <Footer />
    </SiteShell>
  );
}
