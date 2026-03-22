import Link from "next/link";
import { redirect } from "next/navigation";
import { getDb } from "@fundedpro/db";
import { Footer, SiteShell, TopNav } from "@fundedpro/ui";
import { getSession } from "../../../lib/auth";
import { completeMockCheckoutAction } from "../../../lib/trader";

function formatUsd(cents: number) {
  return (cents / 100).toLocaleString("en-GB", { style: "currency", currency: "USD" });
}

function getChallengeTypeLabel(phaseCount: number) {
  return phaseCount > 1 ? "Two Step" : "One Step";
}

export default async function MockCheckoutPage({
  searchParams
}: {
  searchParams: Promise<{ orderId?: string }>;
}) {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  const { orderId } = await searchParams;

  if (!orderId) {
    redirect("/dashboard/billing?error=missing-order");
  }

  const db = getDb();
  const result = await db.query<{
    id: string;
    status: string;
    name: string;
    accountSize: number;
    priceCents: number;
    phaseCount: number;
  }>(
    `
      SELECT co."id", co."status", cp."name", cp."accountSize", i."amountCents" AS "priceCents", cp."phaseCount"
      FROM "ChallengeOrder" co
      JOIN "ChallengePlan" cp ON cp."id" = co."challengePlanId"
      JOIN "Invoice" i ON i."challengeOrderId" = co."id"
      WHERE co."id" = $1 AND co."userId" = $2
      LIMIT 1
    `,
    [orderId, session.userId]
  );

  const order = result.rows[0];

  if (!order) {
    redirect("/dashboard/billing?error=missing-order");
  }

  const challengeType = getChallengeTypeLabel(order.phaseCount);

  return (
    <SiteShell>
      <TopNav />
      <main className="checkout-shell">
        <section className="checkout-layout">
          <section className="checkout-builder">
            <div className="checkout-header">
              <div>
                <p className="eyebrow">Mock checkout</p>
                <h1 className="page-title">New challenge</h1>
                <p className="page-copy">Configure the challenge structure first, then confirm the order from the summary panel.</p>
              </div>
            </div>

            <section className="checkout-section">
              <div className="checkout-section-head">
                <h2>Challenge Type</h2>
                <p>Choose the type of challenge you want to take</p>
              </div>
              <div className="checkout-option-grid two-up">
                <article className={`checkout-option ${challengeType === "One Step" ? "selected" : ""}`}>
                  <span className="checkout-radio" />
                  <div>
                    <strong>One Step</strong>
                    <p>Fast-track evaluation structure</p>
                  </div>
                </article>
                <article className={`checkout-option ${challengeType === "Two Step" ? "selected" : ""}`}>
                  <span className="checkout-radio" />
                  <div>
                    <strong>Two Step</strong>
                    <p>More traditional funded progression</p>
                  </div>
                </article>
              </div>
            </section>

            <section className="checkout-section">
              <div className="checkout-section-head">
                <h2>Model</h2>
                <p>Choose the trading model</p>
              </div>
              <div className="checkout-option-grid two-up">
                <article className="checkout-option selected">
                  <span className="checkout-radio" />
                  <div>
                    <strong>{order.name}</strong>
                    <p>Configured for the current challenge order</p>
                  </div>
                </article>
                <article className="checkout-option">
                  <span className="checkout-radio" />
                  <div>
                    <strong>{order.name} Pro</strong>
                    <p>Extended payout rhythm and tighter ops review</p>
                  </div>
                </article>
              </div>
            </section>

            <section className="checkout-section checkout-rules-card">
              <div className="checkout-rules-head">
                <div className="checkout-rules-icon">~</div>
                <div>
                  <h2>Customise Trading Rules</h2>
                  <p>Adjust your challenge parameters to match your trading style</p>
                </div>
              </div>

              <div className="checkout-subsection">
                <h3>Profit Target</h3>
                <p>Choose options for profit target</p>
                <div className="checkout-option-grid two-up compact">
                  <article className="checkout-option selected compact-option">
                    <span className="checkout-radio" />
                    <strong>Default target</strong>
                    <span>{order.phaseCount > 1 ? "8%" : "6%"}</span>
                  </article>
                  <article className="checkout-option compact-option">
                    <span className="checkout-radio" />
                    <strong>Stretch target</strong>
                    <span>Lower fee later</span>
                  </article>
                </div>
              </div>

              <div className="checkout-subsection">
                <h3>Platform</h3>
                <p>Choose your preferred trading platform</p>
                <div className="checkout-option-grid three-up compact">
                  <article className="checkout-option selected compact-option">
                    <span className="checkout-radio" />
                    <strong>Phynic</strong>
                    <span>Included</span>
                  </article>
                  <article className="checkout-option compact-option">
                    <span className="checkout-radio" />
                    <strong>MatchTrader</strong>
                    <span>Planned</span>
                  </article>
                  <article className="checkout-option compact-option">
                    <span className="checkout-radio" />
                    <strong>cTrader</strong>
                    <span>Future option</span>
                  </article>
                </div>
              </div>

              <div className="checkout-subsection">
                <h3>Account Size</h3>
                <p>Choose your preferred account size</p>
                <div className="checkout-option-grid three-up compact">
                  <article className="checkout-option compact-option">
                    <span className="checkout-radio" />
                    <strong>{formatUsd(500000)}</strong>
                  </article>
                  <article className="checkout-option compact-option">
                    <span className="checkout-radio" />
                    <strong>{formatUsd(1000000)}</strong>
                  </article>
                  <article className="checkout-option selected compact-option">
                    <span className="checkout-radio" />
                    <strong>{order.accountSize.toLocaleString("en-GB", { style: "currency", currency: "USD", maximumFractionDigits: 0 })}</strong>
                  </article>
                </div>
              </div>
            </section>
          </section>

          <aside className="checkout-summary surface-card">
            <div className="checkout-summary-block">
              <h2>Order Summary</h2>
            </div>
            <div className="checkout-summary-block">
              <strong className="checkout-summary-title">
                {order.accountSize.toLocaleString("en-GB", { style: "currency", currency: "USD", maximumFractionDigits: 0 })} | {challengeType} {order.name}
              </strong>
              <p className="surface-copy">Platform: Phynic</p>
              <div className="checkout-status-row">
                <span className="muted-label">Order state</span>
                <span className="status-pill">{order.status}</span>
              </div>
            </div>
            <div className="checkout-summary-block">
              <div className="checkout-total-row">
                <span>Total</span>
                <strong>{formatUsd(order.priceCents)}</strong>
              </div>
              <div className="checkout-agreement">
                <label className="checkout-checkbox-row">
                  <input type="checkbox" checked readOnly />
                  <span>I agree with the current demo checkout terms and mock payment confirmation flow.</span>
                </label>
                <ul className="bullet-list compact-list">
                  <li>Order will be marked paid after confirmation.</li>
                  <li>An invoice record is already attached to this checkout.</li>
                  <li>A trading account is provisioned once payment completes.</li>
                </ul>
              </div>
            </div>
            <form action={completeMockCheckoutAction} className="checkout-confirm-form">
              <input type="hidden" name="orderId" value={order.id} />
              <button type="submit" className="checkout-confirm-button">Confirm mock payment</button>
            </form>
            <Link href="/dashboard/billing" className="dashboard-link">Return to billing</Link>
          </aside>
        </section>
      </main>
      <Footer />
    </SiteShell>
  );
}
