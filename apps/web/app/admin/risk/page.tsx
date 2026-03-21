import { redirect } from "next/navigation";
import { getDb } from "@fundedpro/db";
import { getChallengeSnapshot } from "@fundedpro/domain";
import { Footer, SiteShell, TopNav } from "@fundedpro/ui";
import { runLifecycleSweepAction } from "../../../lib/admin";
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

function formatUsd(value: number) {
  return value.toLocaleString("en-GB", { style: "currency", currency: "USD" });
}

export default async function AdminRiskPage() {
  await requireAdmin();

  const db = getDb();
  const accounts = await db.query<{
    login: string;
    accountState: string;
    currentPhase: number;
    provider: string;
    startingBalance: string;
    phaseStartBalance: string;
    currentBalance: string;
    currentEquity: string;
    tradingDays: number;
    profitTarget: string;
    dailyLossLimit: string;
    totalLossLimit: string;
    fullName: string;
    email: string;
    reviewQueuedAt: Date | null;
    fundedAt: Date | null;
    breachedAt: Date | null;
    phaseCount: number;
    minTradingDays: number;
  }>(
    `
      SELECT
        ta."login",
        ta."accountState",
        ta."currentPhase",
        ta."provider",
        ta."startingBalance",
        ta."phaseStartBalance",
        ta."currentBalance",
        ta."currentEquity",
        ta."tradingDays",
        ta."profitTarget",
        ta."dailyLossLimit",
        ta."totalLossLimit",
        ta."reviewQueuedAt",
        ta."fundedAt",
        ta."breachedAt",
        u."fullName",
        u."email",
        cp."phaseCount",
        cp."minTradingDays"
      FROM "TradingAccount" ta
      JOIN "User" u ON u."id" = ta."userId"
      LEFT JOIN "ChallengeOrder" co ON co."userId" = ta."userId"
      LEFT JOIN "ChallengePlan" cp ON cp."id" = co."challengePlanId"
      ORDER BY ta."updatedAt" DESC
      LIMIT 20
    `
  );

  const rows = accounts.rows.map((account) => {
    const snapshot = getChallengeSnapshot({
      startingBalance: Number(account.startingBalance),
      phaseStartBalance: Number(account.phaseStartBalance),
      currentBalance: Number(account.currentBalance),
      currentEquity: Number(account.currentEquity),
      profitTarget: Number(account.profitTarget),
      dailyLossLimit: Number(account.dailyLossLimit),
      totalLossLimit: Number(account.totalLossLimit),
      tradingDays: account.tradingDays,
      minTradingDays: account.minTradingDays,
      accountState: account.accountState,
      currentPhase: account.currentPhase,
      phaseCount: account.phaseCount
    });

    return {
      ...account,
      snapshot
    };
  });

  const warningCount = rows.filter((row) => row.snapshot.ruleStatus === "warning").length;
  const breachedCount = rows.filter((row) => row.snapshot.ruleStatus === "breached").length;
  const reviewCount = rows.filter((row) => row.snapshot.reviewStatus === "review").length;

  return (
    <SiteShell>
      <TopNav />
      <main className="dashboard-shell">
        <AdminSidebar
          active="risk"
          title="Risk queue"
          description="A first real risk lane for accounts approaching drawdown pressure, review, or breach conditions."
        />

        <section className="dashboard-main admin-page">
          <section className="dashboard-hero">
            <div className="hero-stack">
              <div>
                <p className="eyebrow">Admin risk</p>
                <h1 className="page-title">Review accounts approaching risk thresholds</h1>
                <p className="page-copy">This queue prioritizes rule pressure, drawdown compression, and accounts moving into review or breach states.</p>
              </div>
              <div className="hero-inline-metrics">
                <article className="inline-metric">
                  <span>Warnings</span>
                  <strong>{warningCount}</strong>
                </article>
                <article className="inline-metric">
                  <span>Breach risk</span>
                  <strong>{breachedCount}</strong>
                </article>
                <article className="inline-metric">
                  <span>Review ready</span>
                  <strong>{reviewCount}</strong>
                </article>
              </div>
            </div>

            <div className="surface-card callout-card spotlight-card">
              <div className="spotlight-head">
                <span className="muted-label">Risk posture</span>
                <span className="status-pill">{breachedCount ? "Escalated" : warningCount ? "Watch" : "Controlled"}</span>
              </div>
              <strong className="spotlight-value">{rows[0]?.fullName ?? "No accounts"}</strong>
              <p className="surface-copy">{rows[0] ? `${rows[0].login} | ${rows[0].snapshot.phaseLabel} | ${rows[0].snapshot.ruleStatus}` : "Risk-monitored accounts will appear here."}</p>
              <div className="spotlight-grid">
                <div>
                  <span className="muted-label">Total room</span>
                  <strong>{rows[0] ? formatUsd(rows[0].snapshot.totalLossRemaining) : formatUsd(0)}</strong>
                </div>
                <div>
                  <span className="muted-label">Daily room</span>
                  <strong>{rows[0] ? formatUsd(rows[0].snapshot.dailyLossRemaining) : formatUsd(0)}</strong>
                </div>
              </div>
              <div className="action-row">
                <form action={runLifecycleSweepAction}>
                  <button type="submit" className="ghost-button">Run lifecycle sweep</button>
                </form>
              </div>
            </div>
          </section>

          <section className="phase-strip admin-strip">
            <article className="phase-card active">
              <span>Warning lane</span>
              <strong>{warningCount}</strong>
              <p>Accounts inside warning thresholds but not yet breached.</p>
            </article>
            <article className="phase-card active">
              <span>Breach lane</span>
              <strong>{breachedCount}</strong>
              <p>Accounts with zero remaining room or explicit breach status.</p>
            </article>
            <article className="phase-card active">
              <span>Review candidates</span>
              <strong>{reviewCount}</strong>
              <p>Accounts that have met targets and trading-day minimums.</p>
            </article>
            <article className="phase-card active">
              <span>Coverage</span>
              <strong>{rows.length}</strong>
              <p>Accounts currently being evaluated by the rule engine.</p>
            </article>
          </section>

          <section className="table-card">
            <div className="table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Trader</th>
                    <th>Login</th>
                    <th>State</th>
                    <th>Phase</th>
                    <th>Rule posture</th>
                    <th>Total room</th>
                    <th>Daily room</th>
                    <th>Progress</th>
                    <th>Flag</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.login}>
                      <td>
                        {row.fullName}
                        <br />
                        <span className="table-subtext">{row.email}</span>
                      </td>
                      <td>{row.login}</td>
                      <td>{row.accountState}</td>
                      <td>{`P${row.snapshot.phaseNumber}/${row.snapshot.phaseCount}`}</td>
                      <td>{row.snapshot.ruleStatus}</td>
                      <td>{formatUsd(row.snapshot.totalLossRemaining)}</td>
                      <td>{formatUsd(row.snapshot.dailyLossRemaining)}</td>
                      <td>{row.snapshot.targetProgressPct.toFixed(0)}%</td>
                      <td>{row.snapshot.riskFlags[0] ?? (row.reviewQueuedAt ? `Review queued ${new Date(row.reviewQueuedAt).toLocaleDateString("en-GB")}` : row.fundedAt ? "Funded account" : row.breachedAt ? "Breached account" : "No active flags")}</td>
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
