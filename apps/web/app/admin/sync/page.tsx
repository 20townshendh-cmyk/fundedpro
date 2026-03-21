import { redirect } from "next/navigation";
import { getDb } from "@fundedpro/db";
import { Footer, SiteShell, TopNav } from "@fundedpro/ui";
import { getSession } from "../../../lib/auth";
import { runPlatformResyncAction, runPlatformWorkerCycleAction, simulatePlatformSyncFailureAction } from "../../../lib/admin";
import { getLatestPersistedPlatformSnapshot, getPlatformSnapshotHistory, getPlatformSyncHealth, syncPlatformAccountByLogin } from "../../../lib/mt5/service";
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

export default async function AdminSyncPage() {
  await requireAdmin();

  const db = getDb();
  const [accountResult, fleetResult] = await Promise.all([
    db.query<{ login: string }>(
      'SELECT "login" FROM "TradingAccount" ORDER BY "updatedAt" DESC LIMIT 1'
    ),
    db.query<{ accounts: string; success: string; failed: string }>(`
      SELECT
        COUNT(*)::text AS "accounts",
        COUNT(*) FILTER (WHERE "status" = 'SUCCESS')::text AS "success",
        COUNT(*) FILTER (WHERE "status" = 'FAILED')::text AS "failed"
      FROM (
        SELECT DISTINCT ON ("tradingAccountId") "tradingAccountId", "status"
        FROM "Mt5SyncRun"
        ORDER BY "tradingAccountId", "syncedAt" DESC
      ) latest
    `)
  ]);

  const login = accountResult.rows[0]?.login;
  let snapshot = login ? await getLatestPersistedPlatformSnapshot(login) : null;

  if (!snapshot && login) {
    await syncPlatformAccountByLogin(login);
    snapshot = await getLatestPersistedPlatformSnapshot(login);
  }

  const [history, health, workerAudit] = await Promise.all([
    login ? getPlatformSnapshotHistory(login) : Promise.resolve([]),
    login
      ? getPlatformSyncHealth(login)
      : Promise.resolve({
          latestStatus: "IDLE",
          lastSyncedAt: null,
          lastSuccessAt: null,
          lastFailureAt: null,
          lastFailureMessage: null,
          warnings: ["No linked trading account is available."]
        }),
    db.query<{ id: string; summary: string; createdAt: Date; actorName: string }>(
      `
        SELECT al."id", al."summary", al."createdAt", u."fullName" AS "actorName"
        FROM "AuditLog" al
        JOIN "User" u ON u."id" = al."actorUserId"
        WHERE al."action" IN ('MT5_SYNC_WORKER_CYCLE', 'PLATFORM_SYNC_WORKER_CYCLE')
        ORDER BY al."createdAt" DESC
        LIMIT 4
      `
    )
  ]);

  return (
    <SiteShell>
      <TopNav />
      <main className="dashboard-shell">
        <AdminSidebar
          active="sync"
          title="Platform sync"
          description="Persisted sync runs, retry visibility, failure tracking, and reconciliation warnings for the internal trading state."
        />

        <section className="dashboard-main admin-page">
          <section className="dashboard-hero">
            <div className="hero-stack">
              <div>
                <p className="eyebrow">Admin sync</p>
                <h1 className="page-title">Persisted platform sync, retry state, and reconciliation</h1>
                <p className="page-copy">The sync layer records failures, keeps successful runs, and surfaces the operational warnings an actual prop-firm ops team would need.</p>
              </div>
              <div className="hero-inline-metrics">
                <article className="inline-metric">
                  <span>Latest status</span>
                  <strong>{health.latestStatus}</strong>
                </article>
                <article className="inline-metric">
                  <span>Warnings</span>
                  <strong>{health.warnings.length}</strong>
                </article>
                <article className="inline-metric">
                  <span>Sync runs</span>
                  <strong>{history.length}</strong>
                </article>
                <article className="inline-metric">
                  <span>Closed trades</span>
                  <strong>{snapshot?.closedTrades.length ?? 0}</strong>
                </article>
                <article className="inline-metric">
                  <span>Fleet sync</span>
                  <strong>{`${fleetResult.rows[0]?.success ?? "0"}/${fleetResult.rows[0]?.accounts ?? "0"}`}</strong>
                </article>
              </div>
            </div>

            <div className="surface-card callout-card spotlight-card">
              <div className="spotlight-head">
                <span className="muted-label">Latest sync</span>
                <span className="status-pill">{health.latestStatus}</span>
              </div>
              <strong className="spotlight-value">{snapshot?.login ?? login ?? "No linked account"}</strong>
              <p className="surface-copy">
                {snapshot ? `Balance ${formatUsd(snapshot.balance)} | Equity ${formatUsd(snapshot.equity)}` : "Run or retry sync to populate the persisted platform state."}
              </p>
              <div className="spotlight-grid">
                <div>
                  <span className="muted-label">Last success</span>
                  <strong>{health.lastSuccessAt ? new Date(health.lastSuccessAt).toLocaleString("en-GB") : "-"}</strong>
                </div>
                <div>
                  <span className="muted-label">Last failure</span>
                  <strong>{health.lastFailureAt ? new Date(health.lastFailureAt).toLocaleString("en-GB") : "-"}</strong>
                </div>
              </div>
              {login ? (
                <div className="action-row">
                  <form action={runPlatformWorkerCycleAction} className="resync-form">
                    <button type="submit" className="ghost-button">Run worker cycle</button>
                  </form>
                  <form action={runPlatformResyncAction} className="resync-form">
                    <input type="hidden" name="login" value={login} />
                    <button type="submit" className="ghost-button">Run manual resync</button>
                  </form>
                  <form action={simulatePlatformSyncFailureAction} className="resync-form">
                    <input type="hidden" name="login" value={login} />
                    <button type="submit" className="ghost-button warning-button">Simulate failed sync</button>
                  </form>
                </div>
              ) : null}
            </div>
          </section>

          <section className="phase-strip admin-strip">
            <article className="phase-card active">
              <span>Fleet coverage</span>
              <strong>{fleetResult.rows[0]?.accounts ?? "0"}</strong>
              <p>Accounts with a latest persisted sync result.</p>
            </article>
            <article className="phase-card active">
              <span>Latest status</span>
              <strong>{health.latestStatus}</strong>
              <p>Whether the newest sync run succeeded or failed.</p>
            </article>
            <article className="phase-card active">
              <span>Last success</span>
              <strong>{health.lastSuccessAt ? "Recorded" : "Missing"}</strong>
              <p>Successful sync runs anchor the persisted trading view.</p>
            </article>
            <article className="phase-card active">
              <span>Warnings</span>
              <strong>{health.warnings.length}</strong>
              <p>Reconciliation or retry issues currently active for this account.</p>
            </article>
          </section>

          <section className="dashboard-desk-grid admin-sync-top-grid">
            <article className="surface-card desk-card">
              <div className="detail-head">
                <div>
                  <span className="muted-label">Reconciliation warnings</span>
                  <strong className="metric-value">System health view</strong>
                </div>
              </div>
              <div className="session-table">
                {health.warnings.length ? (
                  health.warnings.map((warning) => (
                    <div className="session-row" key={warning}>
                      <span>Alert</span>
                      <strong>Needs review</strong>
                      <span>{warning}</span>
                    </div>
                  ))
                ) : (
                  <div className="session-row">
                    <span>Health</span>
                    <strong>Stable</strong>
                    <span>No active reconciliation or retry warnings.</span>
                  </div>
                )}
                {health.lastFailureMessage ? (
                  <div className="session-row">
                    <span>Last error</span>
                    <strong>Bridge failure</strong>
                    <span>{health.lastFailureMessage}</span>
                  </div>
                ) : null}
              </div>
            </article>
            <article className="surface-card desk-card">
              <div className="detail-head">
                <div>
                  <span className="muted-label">Worker cycles</span>
                  <strong className="metric-value">Batch sync activity</strong>
                </div>
              </div>
              <div className="session-table">
                {workerAudit.rows.length ? (
                  workerAudit.rows.map((entry) => (
                    <div className="session-row" key={entry.id}>
                      <span>{entry.actorName}</span>
                      <strong>{new Date(entry.createdAt).toLocaleString("en-GB")}</strong>
                      <span>{entry.summary}</span>
                    </div>
                  ))
                ) : (
                  <div className="session-row">
                    <span>Worker</span>
                    <strong>No cycles logged</strong>
                    <span>Batch sync runs triggered from admin will surface here.</span>
                  </div>
                )}
              </div>
            </article>
          </section>

          <section className="surface-card desk-card admin-payload-card">
            <div className="detail-head">
              <div>
                <span className="muted-label">Raw payload</span>
                <strong className="metric-value">Provider inspection</strong>
              </div>
            </div>
            <pre className="payload-block">{JSON.stringify(snapshot?.rawPayload ?? { state: "idle" }, null, 2)}</pre>
          </section>

          <section className="dashboard-desk-grid admin-sync-table-grid">
            <article className="table-card admin-table-panel">
              <div className="detail-head">
                <div>
                  <span className="muted-label">Run history</span>
                  <strong className="metric-value">Recent platform sync attempts</strong>
                </div>
              </div>
              <div className="table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Synced at</th>
                      <th>Status</th>
                      <th>Error</th>
                      <th>Balance</th>
                      <th>Equity</th>
                      <th>Realized</th>
                      <th>Unrealized</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.length ? history.map((run) => (
                      <tr key={run.id}>
                        <td>{new Date(run.syncedAt).toLocaleString("en-GB")}</td>
                        <td>{run.status}</td>
                        <td>{run.errorMessage ?? "-"}</td>
                        <td>{formatUsd(run.balance)}</td>
                        <td>{formatUsd(run.equity)}</td>
                        <td>{formatUsd(run.realizedPnl)}</td>
                        <td>{formatUsd(run.unrealizedPnl)}</td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={7}>No sync runs recorded yet.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </article>

            <article className="table-card admin-table-panel">
              <div className="detail-head">
                <div>
                  <span className="muted-label">Open exposure</span>
                  <strong className="metric-value">Position snapshot</strong>
                </div>
              </div>
              <div className="table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Ticket</th>
                      <th>Symbol</th>
                      <th>Side</th>
                      <th>Lots</th>
                      <th>Open</th>
                      <th>Mark</th>
                      <th>Unrealized</th>
                    </tr>
                  </thead>
                  <tbody>
                    {snapshot?.positions.length ? snapshot.positions.map((position) => (
                      <tr key={position.ticket}>
                        <td>{position.ticket}</td>
                        <td>{position.symbol}</td>
                        <td>{position.side}</td>
                        <td>{position.lots}</td>
                        <td>{position.openPrice}</td>
                        <td>{position.markPrice}</td>
                        <td>{formatUsd(position.unrealizedPnl)}</td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={7}>No open positions.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </article>

            <article className="table-card admin-table-panel">
              <div className="detail-head">
                <div>
                  <span className="muted-label">Closed activity</span>
                  <strong className="metric-value">Trade history snapshot</strong>
                </div>
              </div>
              <div className="table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Ticket</th>
                      <th>Symbol</th>
                      <th>Side</th>
                      <th>Lots</th>
                      <th>Open</th>
                      <th>Close</th>
                      <th>Realized</th>
                    </tr>
                  </thead>
                  <tbody>
                    {snapshot?.closedTrades.length ? snapshot.closedTrades.map((trade) => (
                      <tr key={trade.ticket}>
                        <td>{trade.ticket}</td>
                        <td>{trade.symbol}</td>
                        <td>{trade.side}</td>
                        <td>{trade.lots}</td>
                        <td>{trade.openPrice}</td>
                        <td>{trade.closePrice}</td>
                        <td>{formatUsd(trade.realizedPnl)}</td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={7}>No closed trades.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </article>
          </section>
        </section>
      </main>
      <Footer />
    </SiteShell>
  );
}
