import { redirect } from "next/navigation";
import { getDb } from "@fundedpro/db";
import { Footer, SiteShell, TopNav } from "@fundedpro/ui";
import { FlashToast, type ToastItem } from "../../components/flash-toast";
import { getSession } from "../../../lib/auth";
import { importManualAccountSnapshotAction, resendChallengeCertificateAction } from "../../../lib/admin";
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

function formatUsd(value: string) {
  return Number(value).toLocaleString("en-GB", { style: "currency", currency: "USD" });
}

const accountMessages = {
  success: {
    imported: "Snapshot imported and lifecycle evaluation rerun.",
    updated: "Account state updated.",
    resent: "Certificate email resent."
  },
  error: {
    "invalid-override": "Account state update was invalid.",
    "account-missing": "That trading account could not be found.",
    "invalid-import": "Enter valid balance, equity, and trading days before importing."
  }
} as const;

type AdminAccountsPageProps = {
  searchParams: Promise<{ imported?: string; updated?: string; certificate?: string; error?: string }>;
};

export default async function AdminAccountsPage({ searchParams }: AdminAccountsPageProps) {
  await requireAdmin();
  const { imported, updated, certificate, error } = await searchParams;
  const successMessage = imported
    ? accountMessages.success.imported
    : updated
      ? accountMessages.success.updated
      : certificate === "resent"
        ? accountMessages.success.resent
        : null;
  const errorMessage = error ? accountMessages.error[error as keyof typeof accountMessages.error] ?? "Account action failed." : null;
  const toastItems: ToastItem[] = [];
  if (successMessage) toastItems.push({ id: "accounts-success", tone: "success", message: successMessage });
  if (errorMessage) toastItems.push({ id: "accounts-error", tone: "error", message: errorMessage });

  const db = getDb();
  const [accounts, summary] = await Promise.all([
    db.query<{
      id: string;
      login: string;
      accountState: string;
      currentPhase: number;
      provider: string;
      phaseStartedAt: Date;
      reviewQueuedAt: Date | null;
      passedAt: Date | null;
      fundedAt: Date | null;
      breachedAt: Date | null;
      currentBalance: string;
      currentEquity: string;
      tradingDays: number;
      dailyLossLimit: string;
      totalLossLimit: string;
      fullName: string;
      email: string;
    }>(
      `
        SELECT ta."id", ta."login", ta."accountState", ta."currentPhase", ta."provider", ta."phaseStartedAt", ta."reviewQueuedAt", ta."passedAt", ta."fundedAt", ta."breachedAt", ta."currentBalance", ta."currentEquity", ta."tradingDays", ta."dailyLossLimit", ta."totalLossLimit", u."fullName", u."email"
        FROM "TradingAccount" ta
        JOIN "User" u ON u."id" = ta."userId"
        ORDER BY ta."updatedAt" DESC
        LIMIT 20
      `
    ),
    db.query<{
      totalAccounts: string;
      evaluationAccounts: string;
      reviewAccounts: string;
      breachedAccounts: string;
      fundedAccounts: string;
    }>(
      `
        SELECT
          COUNT(*)::text AS "totalAccounts",
          COUNT(*) FILTER (WHERE "accountState" = 'EVALUATION')::text AS "evaluationAccounts",
          COUNT(*) FILTER (WHERE "accountState" IN ('REVIEW', 'PASSED'))::text AS "reviewAccounts",
          COUNT(*) FILTER (WHERE "accountState" = 'BREACHED')::text AS "breachedAccounts",
          COUNT(*) FILTER (WHERE "accountState" = 'FUNDED')::text AS "fundedAccounts"
        FROM "TradingAccount"
      `
    )
  ]);

  return (
    <SiteShell>
      <TopNav />
      <FlashToast items={toastItems} />
      <main className="dashboard-shell">
        <AdminSidebar
          active="accounts"
          title="Account monitoring"
          description="Balances, equity, state transitions, and risk posture for linked trading accounts."
        />

        <section className="dashboard-main admin-page">
          <section className="dashboard-hero">
            <div className="hero-stack">
              <div>
                <p className="eyebrow">Admin accounts</p>
                <h1 className="page-title">Monitor linked trading accounts</h1>
                <p className="page-copy">A cleaner account-monitoring view for owner, state, provider, balance, equity, and trading-day progress.</p>
              </div>
              <div className="hero-inline-metrics">
                <article className="inline-metric">
                  <span>Total</span>
                  <strong>{summary.rows[0]?.totalAccounts ?? "0"}</strong>
                </article>
                <article className="inline-metric">
                  <span>Evaluation</span>
                  <strong>{summary.rows[0]?.evaluationAccounts ?? "0"}</strong>
                </article>
                <article className="inline-metric">
                  <span>Funded</span>
                  <strong>{summary.rows[0]?.fundedAccounts ?? "0"}</strong>
                </article>
                <article className="inline-metric">
                  <span>Review</span>
                  <strong>{summary.rows[0]?.reviewAccounts ?? "0"}</strong>
                </article>
              </div>
            </div>

            <div className="surface-card callout-card spotlight-card">
              <div className="spotlight-head">
                <span className="muted-label">Newest account</span>
                <span className="status-pill">{accounts.rows[0]?.accountState ?? "Pending"}</span>
              </div>
              <strong className="spotlight-value">{accounts.rows[0]?.login ?? "No accounts yet"}</strong>
              <p className="surface-copy">
                {accounts.rows[0] ? `${accounts.rows[0].fullName} | ${accounts.rows[0].provider}` : "Linked accounts will surface here."}
              </p>
              <div className="spotlight-grid">
                <div>
                  <span className="muted-label">Balance</span>
                  <strong>{accounts.rows[0] ? formatUsd(accounts.rows[0].currentBalance) : formatUsd("0")}</strong>
                </div>
                <div>
                  <span className="muted-label">Equity</span>
                  <strong>{accounts.rows[0] ? formatUsd(accounts.rows[0].currentEquity) : formatUsd("0")}</strong>
                </div>
              </div>
            </div>
          </section>

          <section className="dashboard-desk-grid">
            <article className="surface-card desk-card">
              <div className="detail-head">
                <div>
                  <span className="muted-label">Manual broker import</span>
                  <strong className="metric-value">Paste latest account figures</strong>
                </div>
              </div>
              <div className="session-table">
                {accounts.rows.length ? (
                  accounts.rows.slice(0, 4).map((account) => (
                    <div className="session-row session-row-form" key={`${account.id}-import`}>
                      <div className="account-override-meta">
                        <span className="muted-label">Account</span>
                        <strong>{account.login}</strong>
                        <span>{account.provider}</span>
                      </div>
                      <form action={importManualAccountSnapshotAction} className="inline-admin-form import-admin-form">
                        <input type="hidden" name="tradingAccountId" value={account.id} />
                        <input name="currentBalance" className="surface-input compact-input" placeholder="Balance" aria-label={`Balance for ${account.login}`} />
                        <input name="currentEquity" className="surface-input compact-input" placeholder="Equity" aria-label={`Equity for ${account.login}`} />
                        <input name="tradingDays" className="surface-input compact-input" placeholder="Trading days" aria-label={`Trading days for ${account.login}`} />
                        <input name="note" className="surface-input compact-input" placeholder={`Import note for ${account.login}`} aria-label={`Import note for ${account.login}`} />
                        <button type="submit" className="ghost-button compact-button">Import snapshot</button>
                      </form>
                    </div>
                  ))
                ) : (
                  <div className="session-row">
                    <span>Import lane</span>
                    <strong>No accounts</strong>
                    <span>Provision accounts first, then import fresh figures here.</span>
                  </div>
                )}
              </div>
            </article>
            <article className="surface-card desk-card">
              <div className="detail-head">
                <div>
                  <span className="muted-label">State mix</span>
                  <strong className="metric-value">Lifecycle distribution</strong>
                </div>
              </div>
              <div className="session-table">
                <div className="session-row">
                  <span>Evaluation</span>
                  <strong>{summary.rows[0]?.evaluationAccounts ?? "0"}</strong>
                  <span>Accounts currently trading through active evaluation phases.</span>
                </div>
                <div className="session-row">
                  <span>Review</span>
                  <strong>{summary.rows[0]?.reviewAccounts ?? "0"}</strong>
                  <span>Accounts waiting on review, pass confirmation, or funded promotion.</span>
                </div>
                <div className="session-row">
                  <span>Breached</span>
                  <strong>{summary.rows[0]?.breachedAccounts ?? "0"}</strong>
                  <span>Accounts that need operator handling after losing rule tolerance.</span>
                </div>
              </div>
            </article>
          </section>

          <section className="table-card admin-table-panel">
            <div className="detail-head">
              <div>
                <span className="muted-label">Account registry</span>
                <strong className="metric-value">Lifecycle, balance, and risk posture</strong>
              </div>
            </div>
            <div className="table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Login</th>
                    <th>Trader</th>
                    <th>State</th>
                    <th>Phase</th>
                    <th>Provider</th>
                    <th>Lifecycle</th>
                    <th>Balance</th>
                    <th>Equity</th>
                    <th>Limits</th>
                    <th>Days</th>
                    <th>Risk posture</th>
                    <th>Certificate</th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.rows.map((account) => {
                    const drawdownUsed = Math.max(0, 50000 - Number(account.currentEquity));
                    const totalLimit = Number(account.totalLossLimit);
                    const riskPosture = drawdownUsed >= totalLimit * 0.8 ? "Elevated" : "Controlled";

                    return (
                      <tr key={account.login}>
                        <td>{account.login}</td>
                        <td>
                          {account.fullName}
                          <br />
                          <span className="table-subtext">{account.email}</span>
                        </td>
                        <td>{account.accountState}</td>
                        <td>{account.currentPhase}</td>
                        <td>{account.provider}</td>
                        <td>
                          <span className="table-subtext">
                            {account.fundedAt
                              ? `Funded ${new Date(account.fundedAt).toLocaleDateString("en-GB")}`
                              : account.passedAt
                                ? `Passed ${new Date(account.passedAt).toLocaleDateString("en-GB")}`
                                : account.reviewQueuedAt
                                  ? `Review ${new Date(account.reviewQueuedAt).toLocaleDateString("en-GB")}`
                                  : account.breachedAt
                                    ? `Breached ${new Date(account.breachedAt).toLocaleDateString("en-GB")}`
                                    : `Phase start ${new Date(account.phaseStartedAt).toLocaleDateString("en-GB")}`}
                          </span>
                        </td>
                        <td>{formatUsd(account.currentBalance)}</td>
                        <td>{formatUsd(account.currentEquity)}</td>
                        <td>
                          <span className="table-subtext">Daily {formatUsd(account.dailyLossLimit)}</span>
                          <br />
                          <span className="table-subtext">Total {formatUsd(account.totalLossLimit)}</span>
                        </td>
                        <td>{account.tradingDays}</td>
                        <td>{riskPosture}</td>
                        <td>
                          {["PASSED", "FUNDED"].includes(account.accountState) ? (
                            <form action={resendChallengeCertificateAction}>
                              <input type="hidden" name="tradingAccountId" value={account.id} />
                              <button type="submit" className="ghost-button compact-button">Resend</button>
                            </form>
                          ) : (
                            <span className="table-subtext">-</span>
                          )}
                        </td>
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
