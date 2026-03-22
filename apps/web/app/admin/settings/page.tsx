import { redirect } from "next/navigation";
import { Footer, SiteShell, TopNav } from "@fundedpro/ui";
import { getSession } from "../../../lib/auth";
import { getWebEnv } from "../../../lib/env";
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

export default async function AdminSettingsPage() {
  await requireAdmin();
  const env = getWebEnv();

  const serviceStatus = [
    { label: "Auth", value: env.nextAuthSecret !== "change-me" ? "Configured" : "Needs review", note: "Session signing and RBAC protection." },
    { label: "Stripe", value: env.hasRealStripe ? "Live-ready" : "Not configured for live processing", note: "Checkout, invoice, and webhook readiness." },
    { label: "Email", value: env.resendApiKey ? "Connected" : "Missing API key", note: `Outbound mail from ${env.resendFromEmail}.` },
    { label: "Google OAuth", value: env.googleClientId && env.googleClientSecret ? "Configured" : "Not configured", note: "Optional social login." },
    { label: "Trade credentials", value: env.tradingCredentialSecret ? "Protected" : "Missing secret", note: "Encryption for trading passwords and cookies." },
    { label: "Runtime", value: env.nodeEnv, note: `Base URL ${env.appUrl}.` }
  ];

  return (
    <SiteShell>
      <TopNav />
      <main className="dashboard-shell">
        <AdminSidebar
          active="settings"
          title="Platform settings"
          description="Core operational settings, integrations, and environment-facing configuration lanes."
        />

        <section className="dashboard-main admin-page">
          <section className="dashboard-hero">
            <div className="hero-stack">
              <div>
                <p className="eyebrow">Admin settings</p>
                <h1 className="page-title">Platform controls and integrations</h1>
                <p className="page-copy">This settings layer is where auth, payments, email, storage, and Phynic platform controls can be surfaced for operations.</p>
              </div>
              <div className="hero-inline-metrics">
                <article className="inline-metric">
                  <span>Payments</span>
                  <strong>{env.hasRealStripe ? "Live-ready" : "Sandbox"}</strong>
                </article>
                <article className="inline-metric">
                  <span>Email</span>
                  <strong>{env.resendApiKey ? "Connected" : "Missing key"}</strong>
                </article>
                <article className="inline-metric">
                  <span>Platform</span>
                  <strong>Phynic</strong>
                </article>
                <article className="inline-metric">
                  <span>Auth</span>
                  <strong>{env.nextAuthSecret !== "change-me" ? "Configured" : "Review"}</strong>
                </article>
              </div>
            </div>

            <div className="surface-card callout-card spotlight-card">
              <div className="spotlight-head">
                <span className="muted-label">Control direction</span>
                <span className="status-pill">Admin only</span>
              </div>
              <strong className="spotlight-value">Operational readiness board</strong>
              <p className="surface-copy">This page now surfaces the live readiness of auth, billing, email, and credential protection without exposing secret values directly.</p>
              <div className="spotlight-grid">
                <div>
                  <span className="muted-label">Environment</span>
                  <strong>{env.nodeEnv}</strong>
                </div>
                <div>
                  <span className="muted-label">Base URL</span>
                  <strong>{env.appUrl}</strong>
                </div>
              </div>
            </div>
          </section>

          <section className="dashboard-grid trader-summary-grid">
            {serviceStatus.map((item) => (
              <article className="surface-card metric-panel" key={item.label}>
                <span className="muted-label">{item.label}</span>
                <strong className="metric-value">{item.value}</strong>
                <p className="surface-copy">{item.note}</p>
              </article>
            ))}
          </section>

          <section className="dashboard-desk-grid">
            <article className="surface-card desk-card">
              <div className="detail-head">
                <div>
                  <span className="muted-label">Control lanes</span>
                  <strong className="metric-value">What operations can manage today</strong>
                </div>
              </div>
              <div className="session-table">
                <div className="session-row">
                  <span>Billing</span>
                  <strong>Ready</strong>
                  <span>Orders, credentials, and manual provisioning are already routed through admin billing.</span>
                </div>
                <div className="session-row">
                  <span>Risk</span>
                  <strong>Ready</strong>
                  <span>Risk, payout, and sync boards are already showing operational state from internal trading data.</span>
                </div>
                <div className="session-row">
                  <span>Auth</span>
                  <strong>Protected</strong>
                  <span>Admin routes are gated behind authenticated admin session checks.</span>
                </div>
              </div>
            </article>

            <article className="surface-card desk-card">
              <div className="detail-head">
                <div>
                  <span className="muted-label">Next recommended work</span>
                  <strong className="metric-value">Highest-value follow-through</strong>
                </div>
              </div>
              <div className="session-table">
                <div className="session-row">
                  <span>1</span>
                  <strong>Persist editable settings</strong>
                  <span>Move environment-only controls into audited admin configuration records where appropriate.</span>
                </div>
                <div className="session-row">
                  <span>2</span>
                  <strong>Add safe test actions</strong>
                  <span>Trigger email, webhook, and health-check diagnostics directly from admin.</span>
                </div>
                <div className="session-row">
                  <span>3</span>
                  <strong>Expand audit coverage</strong>
                  <span>Log future settings and publishing changes with actor attribution.</span>
                </div>
              </div>
            </article>
          </section>
        </section>
      </main>
      <Footer />
    </SiteShell>
  );
}
