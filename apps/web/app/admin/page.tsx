import { redirect } from "next/navigation";
import { getDb } from "@fundedpro/db";
import { Footer, SiteShell, TopNav } from "@fundedpro/ui";
import { getSession } from "../../lib/auth";
import { AdminSidebar } from "./admin-sidebar";

async function requireAdmin() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  if (session.role !== "ADMIN") {
    redirect("/dashboard");
  }
}

export default async function AdminDashboardPage() {
  await requireAdmin();

  const db = getDb();
  const [users, accounts, evaluations, review, funded, breached, payouts, riskFlags, audit, workerCycles] = await Promise.all([
    db.query<{ count: string }>('SELECT COUNT(*)::text AS "count" FROM "User"'),
    db.query<{ count: string }>('SELECT COUNT(*)::text AS "count" FROM "TradingAccount"'),
    db.query<{ count: string }>('SELECT COUNT(*)::text AS "count" FROM "TradingAccount" WHERE "accountState" = $1', ["EVALUATION"]),
    db.query<{ count: string }>('SELECT COUNT(*)::text AS "count" FROM "TradingAccount" WHERE "accountState" IN ($1, $2)', ["REVIEW", "PASSED"]),
    db.query<{ count: string }>('SELECT COUNT(*)::text AS "count" FROM "TradingAccount" WHERE "accountState" = $1', ["FUNDED"]),
    db.query<{ count: string }>('SELECT COUNT(*)::text AS "count" FROM "TradingAccount" WHERE "accountState" = $1', ["BREACHED"]),
    db.query<{ count: string }>('SELECT COUNT(*)::text AS "count" FROM "PayoutRequest"'),
    db.query<{ count: string }>(
      `
        SELECT COUNT(*)::text AS "count"
        FROM "TradingAccount"
        WHERE "currentEquity" <= ("startingBalance" - ("totalLossLimit" * 0.8))
           OR "currentBalance" - "currentEquity" >= ("dailyLossLimit" * 0.8)
      `
    ),
    db.query<{ count: string }>('SELECT COUNT(*)::text AS "count" FROM "AuditLog"'),
    db.query<{ count: string }>('SELECT COUNT(*)::text AS "count" FROM "AuditLog" WHERE "action" IN ($1, $2)', ["MT5_SYNC_WORKER_CYCLE", "PLATFORM_SYNC_WORKER_CYCLE"])
  ]);

  return (
    <SiteShell>
      <TopNav />
      <main className="dashboard-shell">
        <AdminSidebar
          active="overview"
          title="Operations control"
          description="A premium command view across users, accounts, payout readiness, risk posture, sync, and audit visibility."
        />

        <section className="dashboard-main admin-page">
          <section className="dashboard-hero">
            <div className="hero-stack">
              <div>
                <p className="eyebrow">Admin overview</p>
                <h1 className="page-title">Run FundedPro with visible controls</h1>
                <p className="page-copy">This operations layer ties together account states, risk pressure, payout exposure, sync visibility, and audit-trail coverage.</p>
              </div>
              <div className="hero-inline-metrics">
                <article className="inline-metric">
                  <span>Users</span>
                  <strong>{users.rows[0]?.count ?? "0"}</strong>
                </article>
                <article className="inline-metric">
                  <span>Accounts</span>
                  <strong>{accounts.rows[0]?.count ?? "0"}</strong>
                </article>
                <article className="inline-metric">
                  <span>Audit events</span>
                  <strong>{audit.rows[0]?.count ?? "0"}</strong>
                </article>
                <article className="inline-metric">
                  <span>Worker cycles</span>
                  <strong>{workerCycles.rows[0]?.count ?? "0"}</strong>
                </article>
              </div>
            </div>

            <div className="surface-card callout-card spotlight-card">
              <div className="spotlight-head">
                <span className="muted-label">Operations posture</span>
                <span className="status-pill">{Number(riskFlags.rows[0]?.count ?? 0) > 0 ? "Attention" : "Stable"}</span>
              </div>
              <strong className="spotlight-value">{funded.rows[0]?.count ?? "0"} funded accounts</strong>
              <p className="surface-copy">Only funded accounts should move into real payout review. Evaluation and demo states stay visible, but they should not leak into the payout queue.</p>
              <div className="spotlight-grid">
                <div>
                  <span className="muted-label">Evaluations</span>
                  <strong>{evaluations.rows[0]?.count ?? "0"}</strong>
                </div>
                <div>
                  <span className="muted-label">Payout requests</span>
                  <strong>{payouts.rows[0]?.count ?? "0"}</strong>
                </div>
              </div>
            </div>
          </section>

          <section className="phase-strip admin-strip">
            <article className="phase-card active">
              <span>Users</span>
              <strong>{users.rows[0]?.count ?? "0"}</strong>
              <p>Registered traders and operators active in the current environment.</p>
            </article>
            <article className="phase-card active">
              <span>Risk queue</span>
              <strong>{riskFlags.rows[0]?.count ?? "0"}</strong>
              <p>Accounts currently inside the final 20% of loss-room tolerance.</p>
            </article>
            <article className="phase-card active">
              <span>Review states</span>
              <strong>{review.rows[0]?.count ?? "0"}</strong>
              <p>Accounts waiting in review or already passed pending funded promotion.</p>
            </article>
            <article className="phase-card active">
              <span>Breached</span>
              <strong>{breached.rows[0]?.count ?? "0"}</strong>
              <p>Accounts that have moved beyond risk tolerance and need operations handling.</p>
            </article>
          </section>

          <section className="dashboard-grid trader-summary-grid">
            <article className="surface-card metric-panel">
              <span className="muted-label">User operations</span>
              <strong className="metric-value">{users.rows[0]?.count ?? "0"}</strong>
              <p className="surface-copy">Review signups, role assignments, and operator access.</p>
            </article>
            <article className="surface-card metric-panel">
              <span className="muted-label">Account operations</span>
              <strong className="metric-value">{accounts.rows[0]?.count ?? "0"}</strong>
              <p className="surface-copy">State overrides, balances, drawdown posture, and linked traders.</p>
            </article>
            <article className="surface-card metric-panel">
              <span className="muted-label">Payout queue</span>
              <strong className="metric-value">{payouts.rows[0]?.count ?? "0"}</strong>
              <p className="surface-copy">Funded-account requests only. Evaluation accounts stay excluded.</p>
            </article>
            <article className="surface-card metric-panel">
              <span className="muted-label">Sync automation</span>
              <strong className="metric-value">{workerCycles.rows[0]?.count ?? "0"}</strong>
              <p className="surface-copy">Worker-driven sync cycles now leave visible operational traces.</p>
            </article>
          </section>
        </section>
      </main>
      <Footer />
    </SiteShell>
  );
}
