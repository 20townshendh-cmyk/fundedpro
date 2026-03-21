import { redirect } from "next/navigation";
import { getDb } from "@fundedpro/db";
import { getChallengeSnapshot, getPayoutHoldAssessment } from "@fundedpro/domain";
import { Footer, SiteShell, TopNav } from "@fundedpro/ui";
import { FlashToast, type ToastItem } from "../../components/flash-toast";
import { getSession } from "../../../lib/auth";
import { resendPayoutCertificateAction, reviewPayoutRequestAction, runPayoutHoldSweepAction } from "../../../lib/admin";
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

type AdminPayoutsPageProps = {
  searchParams: Promise<{ certificate?: string; error?: string }>;
};

export default async function AdminPayoutsPage({ searchParams }: AdminPayoutsPageProps) {
  await requireAdmin();
  const { certificate, error } = await searchParams;
  const toastItems: ToastItem[] = [];
  if (certificate === "resent") toastItems.push({ id: "payout-certificate-resent", tone: "success", message: "Payout certificate email resent." });
  if (error === "missing-request") toastItems.push({ id: "payout-certificate-error", tone: "error", message: "That payout certificate could not be resent." });

  const db = getDb();
  const [payouts, summary] = await Promise.all([
    db.query<{
      id: string;
      amountCents: number;
      status: string;
      note: string | null;
      fullName: string;
      email: string;
      login: string;
      accountState: string;
      startingBalance: string;
      currentBalance: string;
      currentEquity: string;
      dailyLossLimit: string;
      totalLossLimit: string;
      profitTarget: string;
      tradingDays: number;
      createdAt: Date;
    }>(
      `
        SELECT
          pr."id",
          pr."amountCents",
          pr."status",
          pr."note",
          pr."createdAt",
          u."fullName",
          u."email",
          ta."login",
          ta."accountState",
          ta."startingBalance",
          ta."currentBalance",
          ta."currentEquity",
          ta."dailyLossLimit",
          ta."totalLossLimit",
          ta."profitTarget",
          ta."tradingDays"
        FROM "PayoutRequest" pr
        JOIN "User" u ON u."id" = pr."userId"
        JOIN "TradingAccount" ta ON ta."id" = pr."tradingAccountId"
        WHERE ta."accountState" = 'FUNDED'
        ORDER BY pr."createdAt" DESC
      `
    ),
    db.query<{
      requestCount: string;
      requestedAmountCents: string;
      pendingCount: string;
      approvedCount: string;
    }>(
      `
        SELECT
          COUNT(*)::text AS "requestCount",
          COALESCE(SUM(pr."amountCents"), 0)::text AS "requestedAmountCents",
          COUNT(*) FILTER (WHERE pr."status" IN ('PENDING', 'REVIEW'))::text AS "pendingCount",
          COUNT(*) FILTER (WHERE pr."status" = 'APPROVED')::text AS "approvedCount"
        FROM "PayoutRequest" pr
        JOIN "TradingAccount" ta ON ta."id" = pr."tradingAccountId"
        WHERE ta."accountState" = 'FUNDED'
      `
    )
  ]);

  const payoutRows = payouts.rows.map((payout) => {
    const snapshot = getChallengeSnapshot({
      startingBalance: Number(payout.startingBalance),
      currentBalance: Number(payout.currentBalance),
      currentEquity: Number(payout.currentEquity),
      profitTarget: Number(payout.profitTarget),
      dailyLossLimit: Number(payout.dailyLossLimit),
      totalLossLimit: Number(payout.totalLossLimit),
      tradingDays: payout.tradingDays,
      minTradingDays: 3,
      accountState: payout.accountState
    });
    const holdAssessment = getPayoutHoldAssessment({
      accountState: payout.accountState,
      currentProfit: snapshot.currentProfit,
      dailyLossRemaining: snapshot.dailyLossRemaining,
      dailyLossLimit: Number(payout.dailyLossLimit),
      totalLossRemaining: snapshot.totalLossRemaining,
      totalLossLimit: Number(payout.totalLossLimit),
      tradingDaysRemaining: snapshot.tradingDaysRemaining,
      ruleStatus: snapshot.ruleStatus
    });

    return {
      ...payout,
      snapshot,
      holdAssessment
    };
  });

  const heldCount = payoutRows.filter((payout) => !payout.holdAssessment.eligible).length;
  const escalatedCount = payoutRows.filter((payout) => !payout.holdAssessment.eligible && payout.holdAssessment.severity === "critical").length;

  return (
    <SiteShell>
      <TopNav />
      <FlashToast items={toastItems} />
      <main className="dashboard-shell">
        <AdminSidebar
          active="payouts"
          title="Payout queue"
          description="Review funded-account payout requests without letting evaluation or demo activity leak into real-money operations."
        />

        <section className="dashboard-main admin-page admin-payouts-page">
          <section className="dashboard-hero">
            <div className="hero-stack">
              <div>
                <p className="eyebrow">Admin payouts</p>
                <h1 className="page-title">Review payout queue and release decisions</h1>
                <p className="page-copy">This queue is reserved for funded accounts only. Requests with live risk pressure should stay on hold until the account clears review guardrails.</p>
              </div>
              <div className="hero-inline-metrics">
                <article className="inline-metric">
                  <span>Requests</span>
                  <strong>{summary.rows[0]?.requestCount ?? "0"}</strong>
                </article>
                <article className="inline-metric">
                  <span>Pending</span>
                  <strong>{summary.rows[0]?.pendingCount ?? "0"}</strong>
                </article>
                <article className="inline-metric">
                  <span>Approved</span>
                  <strong>{summary.rows[0]?.approvedCount ?? "0"}</strong>
                </article>
                <article className="inline-metric">
                  <span>Holds</span>
                  <strong>{heldCount}</strong>
                </article>
                <article className="inline-metric">
                  <span>Escalated</span>
                  <strong>{escalatedCount}</strong>
                </article>
              </div>
            </div>

            <div className="surface-card callout-card spotlight-card">
              <div className="spotlight-head">
                <span className="muted-label">Latest request</span>
                <span className="status-pill">{payoutRows[0]?.holdAssessment.eligible ? payoutRows[0]?.status ?? "No queue" : "HOLD"}</span>
              </div>
              <strong className="spotlight-value">{payoutRows[0] ? formatUsd(payoutRows[0].amountCents) : formatUsd(0)}</strong>
              <p className="surface-copy">
                {payoutRows[0] ? `${payoutRows[0].fullName} | ${payoutRows[0].email}` : "No funded payout requests are currently in queue."}
              </p>
              <div className="spotlight-grid">
                <div>
                  <span className="muted-label">Login</span>
                  <strong>{payoutRows[0]?.login ?? "-"}</strong>
                </div>
                <div>
                  <span className="muted-label">Hold state</span>
                  <strong>{payoutRows[0]?.holdAssessment.eligible ? "Clear" : "Active"}</strong>
                </div>
              </div>
              <div className="action-row">
                <form action={runPayoutHoldSweepAction} className="resync-form">
                  <button type="submit" className="ghost-button">Run payout hold sweep</button>
                </form>
              </div>
            </div>
          </section>

          <section className="phase-strip admin-strip">
            <article className="phase-card active">
              <span>Funded-only queue</span>
              <strong>Enforced</strong>
              <p>Only funded accounts should enter real payout review.</p>
            </article>
            <article className="phase-card active">
              <span>Requests</span>
              <strong>{summary.rows[0]?.requestCount ?? "0"}</strong>
              <p>Funded payout requests currently visible in the queue.</p>
            </article>
            <article className="phase-card active">
              <span>Requested amount</span>
              <strong>{formatUsd(Number(summary.rows[0]?.requestedAmountCents ?? 0))}</strong>
              <p>Total amount across the current funded payout queue.</p>
            </article>
            <article className="phase-card active">
              <span>Holds</span>
              <strong>{heldCount}</strong>
              <p>Requests currently blocked by payout-risk guardrails.</p>
            </article>
          </section>

          <section className="dashboard-desk-grid">
            <article className="surface-card desk-card">
              <div className="detail-head">
                <div>
                  <span className="muted-label">Decision lane</span>
                  <strong className="metric-value">Review and payout controls</strong>
                </div>
              </div>
              <div className="session-table">
                {payoutRows.length ? (
                  payoutRows.slice(0, 4).map((payout) => (
                    <div className="session-row session-row-form" key={payout.id}>
                      <div className="account-override-meta">
                        <span className="muted-label">Login</span>
                        <strong>{payout.login}</strong>
                        <span>{formatUsd(payout.amountCents)} | {payout.holdAssessment.eligible ? payout.status : payout.holdAssessment.severity === "critical" ? "ESCALATED HOLD" : "HOLD"}</span>
                      </div>
                      <form action={reviewPayoutRequestAction} className="inline-admin-form payout-inline-form">
                        <input type="hidden" name="payoutRequestId" value={payout.id} />
                        <select name="nextStatus" defaultValue={payout.status} className="surface-select" aria-label={`Update payout for ${payout.login}`}>
                          <option value="REVIEW">Review</option>
                          <option value="APPROVED">Approve</option>
                          <option value="REJECTED">Reject</option>
                          <option value="PAID">Paid</option>
                        </select>
                        <input name="note" className="surface-input compact-input" placeholder={`Decision note for ${payout.login}`} aria-label={`Decision note for ${payout.login}`} />
                        <button type="submit" className="ghost-button compact-button">Apply</button>
                      </form>
                      {["APPROVED", "PAID"].includes(payout.status) ? (
                        <form action={resendPayoutCertificateAction} className="inline-admin-form">
                          <input type="hidden" name="payoutRequestId" value={payout.id} />
                          <button type="submit" className="ghost-button compact-button">Resend certificate</button>
                        </form>
                      ) : null}
                      {!payout.holdAssessment.eligible ? (
                        <div className="inline-hold-note payout-hold-note">
                          <span className="muted-label">Hold</span>
                          <strong>{payout.holdAssessment.reasons[0]}</strong>
                        </div>
                      ) : null}
                    </div>
                  ))
                ) : (
                  <div className="session-row">
                    <span>Queue</span>
                    <strong>No funded requests</strong>
                    <span>Trader payout submissions will appear here once a funded account enters review.</span>
                  </div>
                )}
              </div>
            </article>

            <article className="surface-card desk-card">
              <div className="detail-head">
                <div>
                  <span className="muted-label">Ops guidance</span>
                  <strong className="metric-value">Review discipline</strong>
                </div>
              </div>
              <div className="session-table">
                <div className="session-row">
                  <span>Queue rule</span>
                  <strong>Funded only</strong>
                  <span>Evaluation and demo accounts should never enter the real payout queue.</span>
                </div>
                <div className="session-row">
                  <span>Decision path</span>
                  <strong>Review to paid</strong>
                  <span>Use REVIEW for manual checks before approval or rejection.</span>
                </div>
                <div className="session-row">
                  <span>Hold rule</span>
                  <strong>Approval blocked</strong>
                  <span>Requests with active drawdown or review holds cannot move to APPROVED or PAID.</span>
                </div>
              </div>
            </article>
          </section>

          <section className="table-card admin-table-panel">
            <div className="detail-head">
              <div>
                <span className="muted-label">Funded queue</span>
                <strong className="metric-value">Payout requests and hold posture</strong>
              </div>
            </div>
            <div className="table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Trader</th>
                    <th>Login</th>
                    <th>Status</th>
                    <th>Amount</th>
                    <th>Hold / Note</th>
                    <th>Date</th>
                    <th>Certificate</th>
                  </tr>
                </thead>
                <tbody>
                  {payoutRows.length ? (
                    payoutRows.map((payout) => (
                      <tr key={payout.id}>
                        <td>
                          {payout.fullName}
                          <br />
                          <span className="table-subtext">{payout.email}</span>
                        </td>
                        <td>{payout.login}</td>
                        <td>{payout.holdAssessment.eligible ? payout.status : `${payout.holdAssessment.severity === "critical" ? "ESCALATED HOLD" : "HOLD"} | ${payout.status}`}</td>
                        <td>{formatUsd(payout.amountCents)}</td>
                        <td>{payout.holdAssessment.reasons[0] ?? payout.note ?? "No note"}</td>
                        <td>{new Date(payout.createdAt).toLocaleDateString("en-GB")}</td>
                        <td>
                          {["APPROVED", "PAID"].includes(payout.status) ? (
                            <form action={resendPayoutCertificateAction}>
                              <input type="hidden" name="payoutRequestId" value={payout.id} />
                              <button type="submit" className="ghost-button compact-button">Resend</button>
                            </form>
                          ) : (
                            <span className="table-subtext">-</span>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7}>No funded payout requests are currently in queue.</td>
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
