import { getDb } from "@fundedpro/db";
import { Footer, SiteShell, TopNav } from "@fundedpro/ui";
import { requireAdminSession } from "../../../lib/admin";
import { AdminSidebar } from "../admin-sidebar";

export default async function AdminAuditPage() {
  await requireAdminSession();

  const db = getDb();
  const [logs, summary] = await Promise.all([
    db.query<{
      id: string;
      action: string;
      summary: string;
      targetType: string;
      createdAt: Date;
      actorName: string;
    }>(
      `
        SELECT al."id", al."action", al."summary", al."targetType", al."createdAt", u."fullName" AS "actorName"
        FROM "AuditLog" al
        JOIN "User" u ON u."id" = al."actorUserId"
        ORDER BY al."createdAt" DESC
        LIMIT 40
      `
    ),
    db.query<{
      workerCycles: string;
      payoutAutoHolds: string;
    }>(
      `
        SELECT
          COUNT(*) FILTER (WHERE "action" IN ('MT5_SYNC_WORKER_CYCLE', 'PLATFORM_SYNC_WORKER_CYCLE'))::text AS "workerCycles",
          COUNT(*) FILTER (WHERE "action" = 'PAYOUT_AUTO_HOLD')::text AS "payoutAutoHolds"
        FROM "AuditLog"
      `
    )
  ]);

  return (
    <SiteShell>
      <TopNav />
      <main className="dashboard-shell">
        <AdminSidebar
          active="audit"
          title="Audit log"
          description="Sensitive admin actions should leave an operator trail that can be reviewed later."
        />

        <section className="dashboard-main admin-page">
          <section className="dashboard-hero">
            <div className="hero-stack">
              <div>
                <p className="eyebrow">Admin audit</p>
                <h1 className="page-title">Review operator actions and account overrides</h1>
                <p className="page-copy">Account overrides, payout decisions, billing changes, and future privileged actions should all leave an immutable audit reference.</p>
              </div>
              <div className="hero-inline-metrics">
                <article className="inline-metric">
                  <span>Entries</span>
                  <strong>{logs.rowCount}</strong>
                </article>
                <article className="inline-metric">
                  <span>Latest actor</span>
                  <strong>{logs.rows[0]?.actorName ?? "None"}</strong>
                </article>
                <article className="inline-metric">
                  <span>Latest action</span>
                  <strong>{logs.rows[0]?.action ?? "Idle"}</strong>
                </article>
                <article className="inline-metric">
                  <span>Sync cycles</span>
                  <strong>{summary.rows[0]?.workerCycles ?? "0"}</strong>
                </article>
                <article className="inline-metric">
                  <span>Auto holds</span>
                  <strong>{summary.rows[0]?.payoutAutoHolds ?? "0"}</strong>
                </article>
              </div>
            </div>

            <div className="surface-card callout-card spotlight-card">
              <div className="spotlight-head">
                <span className="muted-label">Latest entry</span>
                <span className="status-pill">{logs.rows[0]?.targetType ?? "None"}</span>
              </div>
              <strong className="spotlight-value">{logs.rows[0]?.action ?? "No audit events yet"}</strong>
              <p className="surface-copy">{logs.rows[0]?.summary ?? "Privileged platform actions will surface here once they occur."}</p>
              <div className="spotlight-grid">
                <div>
                  <span className="muted-label">Actor</span>
                  <strong>{logs.rows[0]?.actorName ?? "-"}</strong>
                </div>
                <div>
                  <span className="muted-label">Date</span>
                  <strong>{logs.rows[0] ? new Date(logs.rows[0].createdAt).toLocaleDateString("en-GB") : "-"}</strong>
                </div>
              </div>
            </div>
          </section>

          <section className="table-card">
            <div className="table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Actor</th>
                    <th>Action</th>
                    <th>Target</th>
                    <th>Summary</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.rows.length ? (
                    logs.rows.map((log) => (
                      <tr key={log.id}>
                        <td>{log.actorName}</td>
                        <td>{log.action}</td>
                        <td>{log.targetType}</td>
                        <td>{log.summary}</td>
                        <td>{new Date(log.createdAt).toLocaleString("en-GB")}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5}>No audit events have been recorded yet.</td>
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
