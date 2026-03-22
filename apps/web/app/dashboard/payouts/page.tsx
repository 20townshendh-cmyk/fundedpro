import { redirect } from "next/navigation";
import { getDb } from "@fundedpro/db";
import { getChallengeSnapshot, getPayoutHoldAssessment } from "@fundedpro/domain";
import { Footer, SiteShell, TopNav } from "@fundedpro/ui";
import { getSession } from "../../../lib/auth";
import { syncUserTradingAccountsFromDemo } from "../../../lib/internal-trading-sync";
import { ensureOwnerShowcaseWorkspace } from "../../../lib/owner-showcase";
import { RequestRewardDialog } from "./request-reward-dialog";
import { showcaseWorkspace } from "../../../lib/showcase-workspace";
import { DashboardSidebar } from "../dashboard-sidebar";

function formatUsd(cents: number) {
  return (cents / 100).toLocaleString("en-GB", { style: "currency", currency: "USD" });
}

function renderShowcasePayouts(session: Awaited<ReturnType<typeof getSession>>) {
  const latestPayout = showcaseWorkspace.payouts[0];

  return (
    <SiteShell>
      <TopNav />
      <main className="dashboard-shell">
        <DashboardSidebar
          active="payouts"
          isAdmin={session?.role === "ADMIN"}
          description="Monitor payout readiness without blurring the line between evaluation tracking and real-money eligibility."
        />

        <section className="dashboard-main account-page">
          <section className="payouts-simple-header">
            <div>
              <p className="eyebrow">Rewards</p>
              <h1 className="page-title payouts-simple-title">Rewards</h1>
            </div>
          </section>

          <section className="payouts-simple-grid">
            <article className="surface-card payouts-simple-card payouts-certificate-card">
              <div className="payouts-empty-badge" aria-hidden="true">FP</div>
              <strong>Reward Certificate Ready</strong>
              <p className="surface-copy">The designed workspace includes a premium certificate presentation once reward review is approved.</p>
              <p className="surface-copy">Your live account will replace this showcase row after the first eligible payout request.</p>
              <a className="ghost-button" href="/checkout">Unlock live rewards</a>
            </article>

            <article className="surface-card payouts-simple-card payouts-request-card">
              <strong>Ready to request your reward?</strong>
              <p className="surface-copy">Showcase mode keeps the full payout design visible, but real requests unlock only after your first funded account reaches eligibility.</p>
              <a className="ghost-button" href="/checkout">Buy challenge</a>
            </article>
          </section>

          <section className="payouts-table-shell">
            <div className="payouts-table-head">
              <span>Reference ID</span>
              <span>Reward Type</span>
              <span>Requested On</span>
              <span>Method</span>
              <span>Status</span>
              <span>Amount</span>
              <span>Certificate</span>
              <span>Invoice</span>
            </div>
            <div className="payouts-table-body">
              <article className="payouts-table-row">
                <span>{latestPayout.reference}</span>
                <span>{latestPayout.type}</span>
                <span>{latestPayout.requestedOn}</span>
                <span>{latestPayout.method}</span>
                <span>{latestPayout.status}</span>
                <span>{latestPayout.amount}</span>
                <span>{latestPayout.certificate}</span>
                <span>{latestPayout.invoice}</span>
              </article>
            </div>
          </section>
        </section>
      </main>
      <Footer />
    </SiteShell>
  );
}

export default async function PayoutsPage() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  await ensureOwnerShowcaseWorkspace(session.userId, session.email);

  const db = getDb();
  await syncUserTradingAccountsFromDemo(session.userId);
  const [accountResult, payouts] = await Promise.all([
    db.query<{
      id: string;
      login: string;
      accountState: string;
      tradingDays: number;
      currentBalance: string;
      startingBalance: string;
      currentEquity: string;
      dailyLossLimit: string;
      totalLossLimit: string;
      profitTarget: string;
    }>(
      `
        SELECT "id", "login", "accountState", "tradingDays", "currentBalance", "startingBalance", "currentEquity", "dailyLossLimit", "totalLossLimit", "profitTarget"
        FROM "TradingAccount"
        WHERE "userId" = $1
        ORDER BY "createdAt" DESC
      `,
      [session.userId]
    ),
    db.query<{
      id: string;
      amountCents: number;
      status: string;
      note: string | null;
      createdAt: Date;
    }>(
      `
        SELECT "id", "amountCents", "status", "note", "createdAt"
        FROM "PayoutRequest"
        WHERE "userId" = $1
        ORDER BY "createdAt" DESC
      `,
      [session.userId]
    )
  ]);

  if (!accountResult.rows.length) {
    return renderShowcasePayouts(session);
  }

  const account = accountResult.rows[0];
  const fundedEligible = account?.accountState === "FUNDED";
  const profitCents = Math.max(
    0,
    Math.floor((Number(account?.currentBalance ?? 0) - Number(account?.startingBalance ?? 0)) * 100)
  );
  const hasOpenRequest = payouts.rows.some((payout) => ["PENDING", "REVIEW", "APPROVED"].includes(payout.status));
  const snapshot = account
    ? getChallengeSnapshot({
        startingBalance: Number(account.startingBalance),
        currentBalance: Number(account.currentBalance),
        currentEquity: Number(account.currentEquity),
        profitTarget: Number(account.profitTarget),
        dailyLossLimit: Number(account.dailyLossLimit),
        totalLossLimit: Number(account.totalLossLimit),
        tradingDays: account.tradingDays,
        minTradingDays: 3,
        accountState: account.accountState
      })
    : null;
  const holdAssessment = snapshot
    ? getPayoutHoldAssessment({
        accountState: account?.accountState,
        currentProfit: snapshot.currentProfit,
        dailyLossRemaining: snapshot.dailyLossRemaining,
        dailyLossLimit: Number(account?.dailyLossLimit ?? 0),
        totalLossRemaining: snapshot.totalLossRemaining,
        totalLossLimit: Number(account?.totalLossLimit ?? 0),
        tradingDaysRemaining: snapshot.tradingDaysRemaining,
        ruleStatus: snapshot.ruleStatus
      })
    : { eligible: false, reasons: ["No funded account is linked yet."] };
  const canSubmit = fundedEligible && profitCents > 0 && !hasOpenRequest && holdAssessment.eligible;
  const masterAccounts = accountResult.rows
    .filter((item) => item.accountState === "FUNDED")
    .map((item) => {
      const itemSnapshot = getChallengeSnapshot({
        startingBalance: Number(item.startingBalance),
        currentBalance: Number(item.currentBalance),
        currentEquity: Number(item.currentEquity),
        profitTarget: Number(item.profitTarget),
        dailyLossLimit: Number(item.dailyLossLimit),
        totalLossLimit: Number(item.totalLossLimit),
        tradingDays: item.tradingDays,
        minTradingDays: 3,
        accountState: item.accountState
      });
      const itemHold = getPayoutHoldAssessment({
        accountState: item.accountState,
        currentProfit: itemSnapshot.currentProfit,
        dailyLossRemaining: itemSnapshot.dailyLossRemaining,
        dailyLossLimit: Number(item.dailyLossLimit),
        totalLossRemaining: itemSnapshot.totalLossRemaining,
        totalLossLimit: Number(item.totalLossLimit),
        tradingDaysRemaining: itemSnapshot.tradingDaysRemaining,
        ruleStatus: itemSnapshot.ruleStatus
      });
      const availableProfitDollars = Math.max(0, Math.floor(Number(item.currentBalance) - Number(item.startingBalance)));

      return {
        id: item.id,
        login: item.login,
        state: item.accountState,
        availableProfitDollars,
        canRequest: item.accountState === "FUNDED" && availableProfitDollars > 0 && itemHold.eligible
      };
    });
  const latestCertifiedPayout = payouts.rows.find((payout) => ["APPROVED", "PAID"].includes(payout.status)) ?? null;

  return (
    <SiteShell>
      <TopNav />
      <main className="dashboard-shell">
        <DashboardSidebar
          active="payouts"
          isAdmin={session.role === "ADMIN"}
          description="Monitor payout readiness without blurring the line between evaluation tracking and real-money eligibility."
        />

        <section className="dashboard-main account-page">
          <section className="payouts-simple-header">
            <div>
              <p className="eyebrow">Rewards</p>
              <h1 className="page-title payouts-simple-title">Rewards</h1>
            </div>
          </section>

          <section className="payouts-simple-grid">
            <article className="surface-card payouts-simple-card payouts-certificate-card">
              <div className="payouts-empty-badge" aria-hidden="true">{latestCertifiedPayout ? "FP" : "◫"}</div>
              <strong>{latestCertifiedPayout ? "Reward Certificate Ready" : "No Certificate Available"}</strong>
              <p className="surface-copy">
                {latestCertifiedPayout
                  ? "Your latest approved reward now has a polished FundedPro certificate ready to view."
                  : "You'll earn your reward certificate once you start receiving rewards."}
              </p>
              <p className="surface-copy">
                {latestCertifiedPayout
                  ? "Open the certificate view for a presentation-ready payout record."
                  : "Keep trading to unlock your achievements."}
              </p>
              {latestCertifiedPayout ? <a className="ghost-button" href={`/dashboard/payouts/certificate?payoutId=${latestCertifiedPayout.id}`}>Open certificate</a> : null}
            </article>

            <article className="surface-card payouts-simple-card payouts-request-card">
              <strong>Ready to request your reward?</strong>
              <p className="surface-copy">
                {canSubmit
                  ? "Please click on the request button then proceed to fill out the required information."
                  : fundedEligible
                    ? holdAssessment.reasons[0] ?? "Your account still needs to clear payout checks."
                    : "Only funded accounts with positive profit can request a reward."}
              </p>
              <RequestRewardDialog accounts={masterAccounts} />
            </article>
          </section>

          <section className="payouts-table-shell">
            <div className="payouts-table-head">
              <span>Reference ID</span>
              <span>Reward Type</span>
              <span>Requested On</span>
              <span>Method</span>
              <span>Status</span>
              <span>Amount</span>
              <span>Certificate</span>
              <span>Invoice</span>
            </div>

            {payouts.rows.length ? (
              <div className="payouts-table-body">
                {payouts.rows.map((payout, index) => (
                  <article className="payouts-table-row" key={payout.id}>
                    <span>RW-{String(index + 1).padStart(4, "0")}</span>
                    <span>Reward</span>
                    <span>{new Date(payout.createdAt).toLocaleDateString("en-GB")}</span>
                    <span>Manual</span>
                    <span>{payout.status}</span>
                    <span>{formatUsd(payout.amountCents)}</span>
                    <span>{["APPROVED", "PAID"].includes(payout.status) ? <a href={`/dashboard/payouts/certificate?payoutId=${payout.id}`}>View</a> : "-"}</span>
                    <span>{["APPROVED", "PAID"].includes(payout.status) ? "Available" : "-"}</span>
                  </article>
                ))}
              </div>
            ) : (
              <div className="payouts-table-empty" />
            )}
          </section>
        </section>
      </main>
      <Footer />
    </SiteShell>
  );
}
