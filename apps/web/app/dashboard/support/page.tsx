import { redirect } from "next/navigation";
import { Footer, SiteShell, TopNav } from "@fundedpro/ui";
import { getSession } from "../../../lib/auth";
import { DashboardSidebar } from "../dashboard-sidebar";

export default async function SupportPage() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  return (
    <SiteShell>
      <TopNav />
      <main className="dashboard-shell">
        <DashboardSidebar
          active="support"
          isAdmin={session.role === "ADMIN"}
          description="A dedicated support lane for billing, payout, account, and operational review questions."
        />

        <section className="dashboard-main account-page">
          <section className="dashboard-hero">
            <div className="hero-stack">
              <div>
                <p className="eyebrow">Support</p>
                <h1 className="page-title">Trader support and review channels</h1>
                <p className="page-copy">Use the right support lane for billing, account setup, payout review, or operational escalations.</p>
              </div>
              <div className="hero-inline-metrics">
                <article className="inline-metric">
                  <span>Billing</span>
                  <strong>Invoices</strong>
                </article>
                <article className="inline-metric">
                  <span>Operations</span>
                  <strong>Account review</strong>
                </article>
                <article className="inline-metric">
                  <span>Payouts</span>
                  <strong>Funded only</strong>
                </article>
              </div>
            </div>

            <div className="surface-card callout-card spotlight-card">
              <div className="spotlight-head">
                <span className="muted-label">Recommended path</span>
                <span className="status-pill">Structured support</span>
              </div>
              <strong className="spotlight-value">Route the issue to the correct lane</strong>
              <p className="surface-copy">Clean support routing matters in a prop-firm workflow because billing, rules, and funded payouts have different review standards.</p>
            </div>
          </section>

          <section className="dashboard-grid trader-summary-grid">
            <article className="surface-card metric-panel">
              <span className="muted-label">Account support</span>
              <strong className="metric-value">Setup and credentials</strong>
              <p className="surface-copy">Questions about access, linked accounts, Phynic setup, or account state.</p>
            </article>
            <article className="surface-card metric-panel">
              <span className="muted-label">Billing help</span>
              <strong className="metric-value">Payments and invoices</strong>
              <p className="surface-copy">Questions about challenge purchases, receipts, failed charges, or invoice review.</p>
            </article>
            <article className="surface-card metric-panel">
              <span className="muted-label">Payout review</span>
              <strong className="metric-value">Funded accounts only</strong>
              <p className="surface-copy">Real payout requests only apply once the account has reached funded status.</p>
            </article>
            <article className="surface-card metric-panel">
              <span className="muted-label">Escalations</span>
              <strong className="metric-value">Risk and operations</strong>
              <p className="surface-copy">Suspicious flags, review holds, and operational issues are routed separately.</p>
            </article>
          </section>

          <section className="dashboard-detail-grid">
            <article className="surface-card emphasis-card">
              <span className="muted-label">Support lanes</span>
              <strong className="metric-value">What to use this for</strong>
              <ul className="bullet-list compact-list">
                <li>Billing questions and invoice support</li>
                <li>Challenge account setup or access review</li>
                <li>Funded payout queue questions after eligibility</li>
                <li>Operational review and risk escalations</li>
              </ul>
            </article>
            <article className="surface-card emphasis-card">
              <span className="muted-label">AI assistance</span>
              <strong className="metric-value">Fast guided support</strong>
              <p className="surface-copy">Use the floating AI assistance box in the lower corner for quick guidance on account access, payouts, billing, and Phynic routing before escalating to manual review.</p>
            </article>
          </section>
        </section>
      </main>
      <Footer />
    </SiteShell>
  );
}
