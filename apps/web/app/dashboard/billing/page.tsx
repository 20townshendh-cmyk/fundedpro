import { redirect } from "next/navigation";
import { getDb } from "@fundedpro/db";
import { Footer, SiteShell, TopNav } from "@fundedpro/ui";
import { getSession } from "../../../lib/auth";
import { ensureOwnerShowcaseWorkspace } from "../../../lib/owner-showcase";
import { startChallengeCheckoutAction } from "../../../lib/trader";
import { showcaseWorkspace } from "../../../lib/showcase-workspace";
import { DashboardSidebar } from "../dashboard-sidebar";

function formatUsd(cents: number) {
  return (cents / 100).toLocaleString("en-GB", { style: "currency", currency: "USD" });
}

function renderShowcaseBilling(session: Awaited<ReturnType<typeof getSession>>) {
  const invoices = showcaseWorkspace.invoices;
  const paidTotal = invoices.reduce((sum, invoice) => sum + Math.round(Number(invoice.amount.replace(/[$,]/g, "")) * 100), 0);

  return (
    <SiteShell>
      <TopNav />
      <main className="dashboard-shell">
        <DashboardSidebar
          active="billing"
          isAdmin={session?.role === "ADMIN"}
          description="Billing visibility for challenge purchases, invoices, and account-related charges."
        />

        <section className="dashboard-main account-page">
          <section className="dashboard-hero">
            <div className="hero-stack">
              <div>
                <p className="eyebrow">Billing</p>
                <h1 className="page-title">Invoices and challenge purchase history</h1>
                <p className="page-copy">This showcase billing view mirrors the premium invoice presentation used in the designed demo workspace.</p>
              </div>
              <div className="hero-inline-metrics">
                <article className="inline-metric">
                  <span>Invoices</span>
                  <strong>{invoices.length}</strong>
                </article>
                <article className="inline-metric">
                  <span>Paid total</span>
                  <strong>{formatUsd(paidTotal)}</strong>
                </article>
                <article className="inline-metric">
                  <span>Latest state</span>
                  <strong>{invoices[0]?.status ?? "PAID"}</strong>
                </article>
                <article className="inline-metric">
                  <span>Trading accounts</span>
                  <strong>1</strong>
                </article>
              </div>
            </div>

            <div className="surface-card callout-card spotlight-card">
              <div className="spotlight-head">
                <span className="muted-label">Latest invoice</span>
                <span className="status-pill">{invoices[0]?.status ?? "PAID"}</span>
              </div>
              <strong className="spotlight-value">{invoices[0]?.reference ?? "INV-20481"}</strong>
              <p className="surface-copy">Preview invoice records stay linked to the demo workspace until a live order is created.</p>
              <div className="spotlight-grid">
                <div>
                  <span className="muted-label">Amount</span>
                  <strong>{invoices[0]?.amount ?? "$210"}</strong>
                </div>
                <div>
                  <span className="muted-label">Records</span>
                  <strong>{invoices.length}</strong>
                </div>
              </div>
            </div>
          </section>

          <section className="dashboard-grid trader-summary-grid">
            <article className="surface-card metric-panel">
              <span className="muted-label">Billing state</span>
              <strong className="metric-value">Current</strong>
              <p className="surface-copy">Challenge purchase receipts and invoice history remain attached to the trader workspace.</p>
            </article>
            <article className="surface-card metric-panel">
              <span className="muted-label">Paid invoices</span>
              <strong className="metric-value">{invoices.length}</strong>
              <p className="surface-copy">Completed payments confirmed by the showcase ledger.</p>
            </article>
            <article className="surface-card metric-panel">
              <span className="muted-label">Open issues</span>
              <strong className="metric-value">0</strong>
              <p className="surface-copy">No support follow-up is required in the preview billing state.</p>
            </article>
            <article className="surface-card metric-panel">
              <span className="muted-label">Latest login</span>
              <strong className="metric-value">#{showcaseWorkspace.login}</strong>
              <p className="surface-copy">Each paid order provisions a dedicated trading login for the funded workspace.</p>
            </article>
          </section>

          <section className="table-card">
            <div className="table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Reference</th>
                    <th>Status</th>
                    <th>Amount</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((invoice) => (
                    <tr key={invoice.reference}>
                      <td>{invoice.reference}</td>
                      <td>{invoice.status}</td>
                      <td>{invoice.amount}</td>
                      <td>{invoice.date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </section>
      </main>
      <Footer />
    </SiteShell>
  );
}

export default async function BillingPage() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  await ensureOwnerShowcaseWorkspace(session.userId, session.email);

  const db = getDb();
  const [invoices, accountSummary, orderHistory] = await Promise.all([
    db.query<{
      reference: string;
      amountCents: number;
      status: string;
      createdAt: Date;
    }>(
      `
        SELECT i."reference", i."amountCents", i."status", i."createdAt"
        FROM "Invoice" i
        JOIN "ChallengeOrder" co ON co."id" = i."challengeOrderId"
        WHERE co."userId" = $1
        ORDER BY i."createdAt" DESC
      `,
      [session.userId]
    ),
    db.query<{ totalAccounts: string; latestLogin: string | null }>(
      `
        SELECT
          COUNT(*)::text AS "totalAccounts",
          (
            SELECT ta."login"
            FROM "TradingAccount" ta
            WHERE ta."userId" = $1
            ORDER BY ta."createdAt" DESC
            LIMIT 1
          ) AS "latestLogin"
        FROM "TradingAccount"
        WHERE "userId" = $1
      `,
      [session.userId]
    ),
    db.query<{
      orderId: string;
      reference: string;
      amountCents: number;
      invoiceStatus: string;
      challengeName: string;
      accountSize: number;
      tradingLogin: string | null;
      createdAt: Date;
    }>(
      `
        SELECT
          co."id" AS "orderId",
          i."reference",
          i."amountCents",
          i."status" AS "invoiceStatus",
          cp."name" AS "challengeName",
          cp."accountSize",
          ta."login" AS "tradingLogin",
          i."createdAt"
        FROM "ChallengeOrder" co
        JOIN "Invoice" i ON i."challengeOrderId" = co."id"
        JOIN "ChallengePlan" cp ON cp."id" = co."challengePlanId"
        LEFT JOIN "TradingAccount" ta ON ta."challengeOrderId" = co."id"
        WHERE co."userId" = $1
        ORDER BY i."createdAt" DESC
      `,
      [session.userId]
    )
  ]);
  const summary = accountSummary.rows[0] ?? { totalAccounts: "0", latestLogin: null };

  if (!invoices.rows.length && !orderHistory.rows.length) {
    return renderShowcaseBilling(session);
  }

  return (
    <SiteShell>
      <TopNav />
      <main className="dashboard-shell">
        <DashboardSidebar
          active="billing"
          isAdmin={session.role === "ADMIN"}
          description="Billing visibility for challenge purchases, invoices, and account-related charges."
        />

        <section className="dashboard-main account-page">
          <section className="dashboard-hero">
            <div className="hero-stack">
              <div>
                <p className="eyebrow">Billing</p>
                <h1 className="page-title">Invoices and challenge purchase history</h1>
                <p className="page-copy">Clean financial visibility across charges, invoice state, and challenge purchase records.</p>
              </div>
              <div className="hero-inline-metrics">
                <article className="inline-metric">
                  <span>Invoices</span>
                  <strong>{invoices.rows.length}</strong>
                </article>
                <article className="inline-metric">
                  <span>Paid total</span>
                  <strong>{formatUsd(invoices.rows.filter((invoice) => invoice.status === "PAID").reduce((sum, invoice) => sum + invoice.amountCents, 0))}</strong>
                </article>
                <article className="inline-metric">
                  <span>Latest state</span>
                  <strong>{invoices.rows[0]?.status ?? "None"}</strong>
                </article>
                <article className="inline-metric">
                  <span>Trading accounts</span>
                  <strong>{summary.totalAccounts}</strong>
                </article>
              </div>
            </div>

            <div className="surface-card callout-card spotlight-card">
              <div className="spotlight-head">
                <span className="muted-label">Latest invoice</span>
                <span className="status-pill">{invoices.rows[0]?.status ?? "Pending"}</span>
              </div>
              <strong className="spotlight-value">{invoices.rows[0]?.reference ?? "No invoice yet"}</strong>
              <p className="surface-copy">
                {invoices.rows[0]
                  ? `Created ${new Date(invoices.rows[0].createdAt).toLocaleDateString("en-GB")}`
                  : "Your billing history will appear here after the first purchase."}
              </p>
              <div className="spotlight-grid">
                <div>
                  <span className="muted-label">Amount</span>
                  <strong>{invoices.rows[0] ? formatUsd(invoices.rows[0].amountCents) : formatUsd(0)}</strong>
                </div>
                <div>
                  <span className="muted-label">Records</span>
                  <strong>{invoices.rows.length}</strong>
                </div>
              </div>
              {!Number(summary.totalAccounts) ? (
                <div className="action-row">
                  <form action={startChallengeCheckoutAction}>
                    <button type="submit" className="ghost-button">Start starter challenge checkout</button>
                  </form>
                </div>
              ) : null}
            </div>
          </section>

          <section className="dashboard-grid trader-summary-grid">
            <article className="surface-card metric-panel">
              <span className="muted-label">Billing state</span>
              <strong className="metric-value">{invoices.rows.some((invoice) => invoice.status === "PAID") ? "Current" : "Awaiting purchase"}</strong>
              <p className="surface-copy">Challenge purchase receipts and invoice history remain attached to the trader workspace.</p>
            </article>
            <article className="surface-card metric-panel">
              <span className="muted-label">Paid invoices</span>
              <strong className="metric-value">{invoices.rows.filter((invoice) => invoice.status === "PAID").length}</strong>
              <p className="surface-copy">Completed payments confirmed by the current billing records.</p>
            </article>
            <article className="surface-card metric-panel">
              <span className="muted-label">Open issues</span>
              <strong className="metric-value">{invoices.rows.filter((invoice) => invoice.status !== "PAID").length}</strong>
              <p className="surface-copy">Anything outside paid state should be visible quickly for support follow-up.</p>
            </article>
            <article className="surface-card metric-panel">
              <span className="muted-label">Latest login</span>
              <strong className="metric-value">{summary.latestLogin ? `#${summary.latestLogin}` : "Pending"}</strong>
              <p className="surface-copy">Each paid order now provisions its own trading login and stays linked to that invoice record.</p>
            </article>
          </section>

          <section className="table-card">
            <div className="table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Reference</th>
                    <th>Status</th>
                    <th>Amount</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.rows.map((invoice) => (
                    <tr key={invoice.reference}>
                      <td>{invoice.reference}</td>
                      <td>{invoice.status}</td>
                      <td>{formatUsd(invoice.amountCents)}</td>
                      <td>{new Date(invoice.createdAt).toLocaleDateString("en-GB")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="table-card">
            <div className="table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Challenge</th>
                    <th>Account size</th>
                    <th>Invoice</th>
                    <th>Trading login</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {orderHistory.rows.length ? orderHistory.rows.map((row) => (
                    <tr key={row.orderId}>
                      <td>{row.challengeName}</td>
                      <td>{Number(row.accountSize).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })}</td>
                      <td>{row.reference} ({row.invoiceStatus})</td>
                      <td>{row.tradingLogin ? `#${row.tradingLogin}` : "Provisioning"}</td>
                      <td>{new Date(row.createdAt).toLocaleDateString("en-GB")}</td>
                    </tr>
                  )) : (
                    <tr><td colSpan={5}>No challenge purchases yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </section>
      </main>
      <Footer />
    </SiteShell>
  );
}
