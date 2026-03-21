import { redirect } from "next/navigation";
import { getDb } from "@fundedpro/db";
import { Footer, SiteShell, TopNav } from "@fundedpro/ui";
import { FlashToast, type ToastItem } from "../../components/flash-toast";
import { provisionManualTradingAccountAction, regenerateTradingCredentialsAction, resendTradingCredentialsAction } from "../../../lib/admin";
import { getSession } from "../../../lib/auth";
import { AdminSidebar } from "../admin-sidebar";

async function requireAdmin() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  if (session.role !== "ADMIN") {
    redirect("/dashboard");
  }
}

function formatUsd(cents: number) {
  return (cents / 100).toLocaleString("en-GB", { style: "currency", currency: "USD" });
}

function formatSessionLabel(sessionId: string | null) {
  if (!sessionId) return "No session";
  return sessionId.length > 18 ? `${sessionId.slice(0, 18)}...` : sessionId;
}

const billingMessages = {
  success: {
    provisioned: "Trading account provisioned and credentials email queued.",
    updated: "Billing order updated.",
    resent: "Trading credentials re-sent.",
    regenerated: "Trading credentials regenerated and re-sent."
  },
  error: {
    "invalid-review": "Billing update was invalid.",
    "missing-order": "That order could not be found.",
    "invalid-provision": "Enter platform, login, connection, and password to provision the account.",
    "order-not-paid": "Only paid orders can be provisioned.",
    "login-taken": "That account login is already assigned."
  }
} as const;

type AdminBillingPageProps = {
  searchParams: Promise<{ provisioned?: string; updated?: string; credentials?: string; error?: string }>;
};

export default async function AdminBillingPage({ searchParams }: AdminBillingPageProps) {
  await requireAdmin();
  const { provisioned, updated, credentials, error } = await searchParams;
  const successMessage =
    provisioned ? billingMessages.success.provisioned :
    updated ? billingMessages.success.updated :
    credentials === "resent" ? billingMessages.success.resent :
    credentials === "regenerated" ? billingMessages.success.regenerated :
    null;
  const errorMessage = error ? billingMessages.error[error as keyof typeof billingMessages.error] ?? "Billing action failed." : null;
  const toastItems: ToastItem[] = [];
  if (successMessage) toastItems.push({ id: "billing-success", tone: "success", message: successMessage });
  if (errorMessage) toastItems.push({ id: "billing-error", tone: "error", message: errorMessage });

  const db = getDb();
  const orders = await db.query<{
    id: string;
    orderStatus: string;
    stripeSessionId: string | null;
    createdAt: Date;
    fullName: string;
    email: string;
    planName: string;
    priceCents: number;
    invoiceReference: string | null;
    invoiceStatus: string | null;
    tradingAccountId: string | null;
    login: string | null;
  }>(
    `
      SELECT
        co."id",
        co."status" AS "orderStatus",
        co."stripeSessionId",
        co."createdAt",
        u."fullName",
        u."email",
        cp."name" AS "planName",
        cp."priceCents",
        i."reference" AS "invoiceReference",
        i."status" AS "invoiceStatus",
        ta."id" AS "tradingAccountId",
        ta."login"
      FROM "ChallengeOrder" co
      JOIN "User" u ON u."id" = co."userId"
      JOIN "ChallengePlan" cp ON cp."id" = co."challengePlanId"
      LEFT JOIN "Invoice" i ON i."challengeOrderId" = co."id"
      LEFT JOIN "TradingAccount" ta ON ta."challengeOrderId" = co."id"
      ORDER BY co."createdAt" DESC
      LIMIT 20
    `
  );

  return (
    <SiteShell>
      <TopNav />
      <FlashToast items={toastItems} />
      <main className="dashboard-shell">
        <AdminSidebar
          active="billing"
          title="Billing ops"
          description="Review challenge purchases, invoice states, and account provisioning from one finance-facing queue."
        />

        <section className="dashboard-main admin-page">
          <section className="dashboard-hero">
            <div className="hero-stack">
              <div>
                <p className="eyebrow">Admin billing</p>
                <h1 className="page-title">Track purchases, invoices, and provisioning</h1>
                <p className="page-copy">Orders, invoice state, and downstream account provisioning should stay visible before live Stripe is connected.</p>
              </div>
              <div className="hero-inline-metrics">
                <article className="inline-metric">
                  <span>Orders</span>
                  <strong>{orders.rows.length}</strong>
                </article>
                <article className="inline-metric">
                  <span>Paid</span>
                  <strong>{orders.rows.filter((order) => order.orderStatus === "PAID").length}</strong>
                </article>
                <article className="inline-metric">
                  <span>Provisioned</span>
                  <strong>{orders.rows.filter((order) => order.login).length}</strong>
                </article>
                <article className="inline-metric">
                  <span>Pending</span>
                  <strong>{orders.rows.filter((order) => !order.login && order.orderStatus === "PAID").length}</strong>
                </article>
              </div>
            </div>

            <div className="surface-card callout-card spotlight-card">
              <div className="spotlight-head">
                <span className="muted-label">Latest order</span>
                <span className="status-pill">{orders.rows[0]?.orderStatus ?? "No orders"}</span>
              </div>
              <strong className="spotlight-value">{orders.rows[0]?.planName ?? "No purchase activity yet"}</strong>
              <p className="surface-copy">
                {orders.rows[0] ? `${orders.rows[0].fullName} | ${orders.rows[0].email}` : "Challenge purchase activity will appear here."}
              </p>
              <div className="spotlight-grid">
                <div>
                  <span className="muted-label">Invoice</span>
                  <strong>{orders.rows[0]?.invoiceReference ?? "-"}</strong>
                </div>
                <div>
                  <span className="muted-label">Provisioned login</span>
                  <strong>{orders.rows[0]?.login ?? "Pending"}</strong>
                </div>
              </div>
            </div>
          </section>

          <section className="dashboard-grid trader-summary-grid admin-billing-summary">
            <article className="surface-card metric-panel">
              <span className="muted-label">Provisioning lane</span>
              <strong className="metric-value">{orders.rows.filter((order) => order.orderStatus === "PAID" && !order.login).length}</strong>
              <p className="surface-copy">Paid orders waiting on account provisioning and credential issuance.</p>
            </article>
            <article className="surface-card metric-panel">
              <span className="muted-label">Invoice visibility</span>
              <strong className="metric-value">{orders.rows.filter((order) => order.invoiceReference).length}</strong>
              <p className="surface-copy">Orders already carrying invoice references for finance review.</p>
            </article>
            <article className="surface-card metric-panel">
              <span className="muted-label">Credential support</span>
              <strong className="metric-value">{orders.rows.filter((order) => order.tradingAccountId).length}</strong>
              <p className="surface-copy">Accounts that can already receive resend or regenerate actions.</p>
            </article>
          </section>

          <section className="table-card admin-table-panel">
            <div className="detail-head">
              <div>
                <span className="muted-label">Finance queue</span>
                <strong className="metric-value">Orders, invoices, and provisioning actions</strong>
              </div>
            </div>
            <div className="table-wrap">
              <table className="admin-table admin-billing-table">
                <thead>
                  <tr>
                    <th>Trader</th>
                    <th>Plan</th>
                    <th>Order</th>
                    <th>Session</th>
                    <th>Invoice</th>
                    <th>Amount</th>
                    <th>Account</th>
                    <th>Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.rows.length ? (
                    orders.rows.map((order) => (
                      <tr key={order.id}>
                        <td>
                          {order.fullName}
                          <br />
                          <span className="table-subtext">{order.email}</span>
                        </td>
                        <td>{order.planName}</td>
                        <td>{order.orderStatus}</td>
                        <td>
                          <span>{formatSessionLabel(order.stripeSessionId)}</span>
                          {order.stripeSessionId ? <span className="table-subtext billing-session-copy">{order.stripeSessionId}</span> : null}
                        </td>
                        <td>{order.invoiceStatus ? `${order.invoiceStatus} | ${order.invoiceReference}` : "No invoice"}</td>
                        <td>{formatUsd(order.priceCents)}</td>
                        <td>{order.login ?? "Pending"}</td>
                        <td>{new Date(order.createdAt).toLocaleDateString("en-GB")}</td>
                        <td className="billing-actions-cell">
                          <div className="billing-actions-stack">
                          {order.orderStatus === "PAID" && !order.login ? (
                            <form action={provisionManualTradingAccountAction} className="stacked-form">
                              <input type="hidden" name="orderId" value={order.id} />
                              <input name="platform" className="surface-input compact-input" placeholder="Platform e.g. Tradovate" aria-label={`Platform for ${order.email}`} />
                              <input name="login" className="surface-input compact-input" placeholder="Account login" aria-label={`Account login for ${order.email}`} />
                              <input name="connection" className="surface-input compact-input" placeholder="Server or connection" aria-label={`Connection for ${order.email}`} />
                              <input name="password" className="surface-input compact-input" placeholder="Account password" aria-label={`Account password for ${order.email}`} />
                              <button type="submit" className="ghost-button compact-button">Provision account</button>
                            </form>
                          ) : null}
                          {order.tradingAccountId ? (
                            <>
                              <form action={resendTradingCredentialsAction} className="stacked-form">
                                <input type="hidden" name="tradingAccountId" value={order.tradingAccountId} />
                                <button type="submit" className="ghost-button compact-button">Resend credentials</button>
                              </form>
                              <form action={regenerateTradingCredentialsAction} className="stacked-form">
                                <input type="hidden" name="tradingAccountId" value={order.tradingAccountId} />
                                <button type="submit" className="ghost-button compact-button">Regenerate password</button>
                              </form>
                            </>
                          ) : null}
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={9}>No billing activity has been recorded yet.</td>
                    </tr>
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
