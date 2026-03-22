import { redirect } from "next/navigation";
import { getDb } from "@fundedpro/db";
import { Footer, SiteShell, TopNav } from "@fundedpro/ui";
import { getSession, logoutAction } from "../../../lib/auth";

export default async function SupportPage() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  const db = getDb();
  const accountSummary = await db.query<{ totalAccounts: string }>(
    `
      SELECT COUNT(*)::text AS "totalAccounts"
      FROM "TradingAccount"
      WHERE "userId" = $1
    `,
    [session.userId]
  );

  if (!Number(accountSummary.rows[0]?.totalAccounts ?? "0")) {
    redirect("/dashboard");
  }

  return (
    <SiteShell>
      <TopNav />
      <main className="dashboard-shell">
        <aside className="dashboard-sidebar">
          <div className="sidebar-brand">
            <p className="eyebrow">Trader workspace</p>
            <h2 className="sidebar-title">FundedPro</h2>
            <p className="surface-copy">A dedicated support lane for billing, payout, account, and operational review questions.</p>
          </div>
          <nav className="sidebar-nav">
            <a className="sidebar-link sidebar-link-gold" href="/checkout">New Challenge</a>
            <a className="sidebar-link" href="/dashboard/trades">Trade Now</a>
            <a className="sidebar-link" href="/dashboard">Overview</a>
            <a className="sidebar-link" href="/dashboard/account">Account detail</a>
            <a className="sidebar-link" href="/dashboard/trades?tab=history">Trade history</a>
            <a className="sidebar-link" href="/dashboard/billing">Billing</a>
            <a className="sidebar-link" href="/dashboard/payouts">Payouts</a>
            <a className="sidebar-link active" href="/dashboard/support">Support</a>
            <a className="sidebar-link" href="/login">Switch account</a>
            {session.role === "ADMIN" ? <a className="sidebar-link" href="/admin">Admin panel</a> : null}
          </nav>
          <form action={logoutAction}>
            <button className="ghost-button" type="submit">
              Log out
            </button>
          </form>
        </aside>

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
              <p className="surface-copy">Questions about access, linked accounts, Trade Now setup, or account state.</p>
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
              <p className="surface-copy">Use the floating AI assistance box in the lower corner for quick guidance on account access, payouts, billing, and Trade Now routing before escalating to manual review.</p>
            </article>
          </section>
        </section>
      </main>
      <Footer />
    </SiteShell>
  );
}
