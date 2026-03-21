import { redirect } from "next/navigation";
import { getDb } from "@fundedpro/db";
import { Footer, SiteShell, TopNav } from "@fundedpro/ui";
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

export default async function AdminChallengesPage() {
  await requireAdmin();

  const db = getDb();
  const [plans, planCount, lifecycleSummary] = await Promise.all([
    db.query<{
      id: string;
      slug: string;
      name: string;
      challengeType: string;
      accountSize: number;
      priceCents: number;
      phaseCount: number;
      profitTargetPct: string;
      dailyDrawdownPct: string;
      maxDrawdownPct: string;
      minTradingDays: number;
      payoutSplitPct: string;
      resetEnabled: boolean;
    }>(
      `
        SELECT
          "id",
          "slug",
          "name",
          "challengeType",
          "accountSize",
          "priceCents",
          "phaseCount",
          "profitTargetPct"::text,
          "dailyDrawdownPct"::text,
          "maxDrawdownPct"::text,
          "minTradingDays",
          "payoutSplitPct"::text,
          "resetEnabled"
        FROM "ChallengePlan"
        ORDER BY "accountSize" ASC
      `
    ),
    db.query<{ count: string }>('SELECT COUNT(*)::text AS "count" FROM "ChallengePlan"'),
    db.query<{
      challengePlanId: string;
      inEvaluation: string;
      inReview: string;
      funded: string;
      breached: string;
    }>(
      `
        SELECT
          co."challengePlanId",
          COUNT(*) FILTER (WHERE ta."accountState" IN ('PENDING', 'EVALUATION', 'RESET'))::text AS "inEvaluation",
          COUNT(*) FILTER (WHERE ta."accountState" IN ('REVIEW', 'PASSED'))::text AS "inReview",
          COUNT(*) FILTER (WHERE ta."accountState" = 'FUNDED')::text AS "funded",
          COUNT(*) FILTER (WHERE ta."accountState" = 'BREACHED')::text AS "breached"
        FROM "ChallengeOrder" co
        JOIN "TradingAccount" ta ON ta."userId" = co."userId"
        GROUP BY co."challengePlanId"
      `
    )
  ]);
  const lifecycleByPlan = new Map(lifecycleSummary.rows.map((row) => [row.challengePlanId, row]));

  return (
    <SiteShell>
      <TopNav />
      <main className="dashboard-shell">
        <AdminSidebar
          active="challenges"
          title="Challenge products"
          description="Product rules, pricing, and progression thresholds for the programs traders can buy."
        />

        <section className="dashboard-main admin-page">
          <section className="dashboard-hero">
            <div className="hero-stack">
              <div>
                <p className="eyebrow">Admin challenges</p>
                <h1 className="page-title">Monitor challenge products and rule thresholds</h1>
                <p className="page-copy">This view now ties product configuration to the lifecycle states traders are actually moving through.</p>
              </div>
              <div className="hero-inline-metrics">
                <article className="inline-metric">
                  <span>Plans</span>
                  <strong>{planCount.rows[0]?.count ?? "0"}</strong>
                </article>
                <article className="inline-metric">
                  <span>Highest tier</span>
                  <strong>{plans.rows.at(-1)?.name ?? "None"}</strong>
                </article>
                <article className="inline-metric">
                  <span>Reset enabled</span>
                  <strong>{plans.rows.filter((plan) => plan.resetEnabled).length}</strong>
                </article>
              </div>
            </div>

            <div className="surface-card callout-card spotlight-card">
              <div className="spotlight-head">
                <span className="muted-label">Primary program</span>
                <span className="status-pill">{plans.rows[0]?.challengeType ?? "Pending"}</span>
              </div>
              <strong className="spotlight-value">{plans.rows[0]?.name ?? "No plans"}</strong>
              <p className="surface-copy">{plans.rows[0] ? `${formatUsd(plans.rows[0].priceCents)} | ${plans.rows[0].accountSize.toLocaleString("en-GB", { style: "currency", currency: "USD", maximumFractionDigits: 0 })}` : "Challenge products will appear here."}</p>
              <div className="spotlight-grid">
                <div>
                  <span className="muted-label">Profit target</span>
                  <strong>{plans.rows[0] ? `${plans.rows[0].profitTargetPct}%` : "-"}</strong>
                </div>
                <div>
                  <span className="muted-label">Max drawdown</span>
                  <strong>{plans.rows[0] ? `${plans.rows[0].maxDrawdownPct}%` : "-"}</strong>
                </div>
              </div>
            </div>
          </section>

          <section className="phase-strip admin-strip">
            <article className="phase-card active">
              <span>Plan count</span>
              <strong>{planCount.rows[0]?.count ?? "0"}</strong>
              <p>Challenge products currently available inside the system.</p>
            </article>
            <article className="phase-card active">
              <span>One-step</span>
              <strong>{plans.rows.filter((plan) => plan.challengeType === "ONE_STEP").length}</strong>
              <p>Simpler evaluation products with one phase to completion.</p>
            </article>
            <article className="phase-card active">
              <span>Two-step</span>
              <strong>{plans.rows.filter((plan) => plan.challengeType === "TWO_STEP").length}</strong>
              <p>Multi-phase products with more structured progression.</p>
            </article>
            <article className="phase-card active">
              <span>Instant style</span>
              <strong>{plans.rows.filter((plan) => plan.challengeType === "INSTANT").length}</strong>
              <p>Programs oriented around immediate funded-style entry conditions.</p>
            </article>
          </section>

          <section className="table-card">
            <div className="table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Plan</th>
                    <th>Type</th>
                    <th>Price</th>
                    <th>Account</th>
                    <th>Lifecycle</th>
                    <th>Rules</th>
                    <th>Trading days</th>
                    <th>Payout split</th>
                    <th>Reset</th>
                  </tr>
                </thead>
                <tbody>
                  {plans.rows.map((plan) => {
                    const lifecycle = lifecycleByPlan.get(plan.id);

                    return (
                      <tr key={plan.slug}>
                        <td>{plan.name}</td>
                        <td>{plan.challengeType}</td>
                        <td>{formatUsd(plan.priceCents)}</td>
                        <td>{plan.accountSize.toLocaleString("en-GB", { style: "currency", currency: "USD", maximumFractionDigits: 0 })}</td>
                        <td>
                          <span className="table-subtext">{`Eval ${lifecycle?.inEvaluation ?? "0"} | Review ${lifecycle?.inReview ?? "0"}`}</span>
                          <br />
                          <span className="table-subtext">{`Funded ${lifecycle?.funded ?? "0"} | Breached ${lifecycle?.breached ?? "0"}`}</span>
                        </td>
                        <td>
                          <span className="table-subtext">Target {plan.profitTargetPct}%</span>
                          <br />
                          <span className="table-subtext">Daily {plan.dailyDrawdownPct}% | Max {plan.maxDrawdownPct}%</span>
                        </td>
                        <td>{`${plan.minTradingDays} days | ${plan.phaseCount} phase${plan.phaseCount === 1 ? "" : "s"}`}</td>
                        <td>{plan.payoutSplitPct}%</td>
                        <td>{plan.resetEnabled ? "Enabled" : "Disabled"}</td>
                      </tr>
                    );
                  })}
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
