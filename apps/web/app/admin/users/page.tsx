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

export default async function AdminUsersPage() {
  await requireAdmin();

  const db = getDb();
  const [users, summary] = await Promise.all([
    db.query<{
      fullName: string;
      email: string;
      role: string;
      createdAt: Date;
    }>(
      `
        SELECT "fullName", "email", "role", "createdAt"
        FROM "User"
        ORDER BY "createdAt" DESC
        LIMIT 20
      `
    ),
    db.query<{
      totalUsers: string;
      traderUsers: string;
      adminUsers: string;
    }>(
      `
        SELECT
          COUNT(*)::text AS "totalUsers",
          COUNT(*) FILTER (WHERE "role" = 'TRADER')::text AS "traderUsers",
          COUNT(*) FILTER (WHERE "role" = 'ADMIN')::text AS "adminUsers"
        FROM "User"
      `
    )
  ]);

  return (
    <SiteShell>
      <TopNav />
      <main className="dashboard-shell">
        <AdminSidebar
          active="users"
          title="User operations"
          description="Review recent signups, operator roles, and access distribution from one list view."
        />

        <section className="dashboard-main admin-page">
          <section className="dashboard-hero">
            <div className="hero-stack">
              <div>
                <p className="eyebrow">Admin users</p>
                <h1 className="page-title">Recent users and access levels</h1>
                <p className="page-copy">A cleaner admin list view for user review before richer detail screens and manual controls are added.</p>
              </div>
              <div className="hero-inline-metrics">
                <article className="inline-metric">
                  <span>Total users</span>
                  <strong>{summary.rows[0]?.totalUsers ?? "0"}</strong>
                </article>
                <article className="inline-metric">
                  <span>Traders</span>
                  <strong>{summary.rows[0]?.traderUsers ?? "0"}</strong>
                </article>
                <article className="inline-metric">
                  <span>Admins</span>
                  <strong>{summary.rows[0]?.adminUsers ?? "0"}</strong>
                </article>
              </div>
            </div>

            <div className="surface-card callout-card spotlight-card">
              <div className="spotlight-head">
                <span className="muted-label">Newest account</span>
                <span className="status-pill">{users.rows[0]?.role ?? "Pending"}</span>
              </div>
              <strong className="spotlight-value">{users.rows[0]?.fullName ?? "No users yet"}</strong>
              <p className="surface-copy">{users.rows[0]?.email ?? "New signups will appear here."}</p>
              <div className="spotlight-grid">
                <div>
                  <span className="muted-label">Created</span>
                  <strong>{users.rows[0] ? new Date(users.rows[0].createdAt).toLocaleDateString("en-GB") : "-"}</strong>
                </div>
                <div>
                  <span className="muted-label">Role</span>
                  <strong>{users.rows[0]?.role ?? "-"}</strong>
                </div>
              </div>
            </div>
          </section>

          <section className="phase-strip admin-strip">
            <article className="phase-card active">
              <span>Total users</span>
              <strong>{summary.rows[0]?.totalUsers ?? "0"}</strong>
              <p>Current registered user base inside the platform.</p>
            </article>
            <article className="phase-card active">
              <span>Trader seats</span>
              <strong>{summary.rows[0]?.traderUsers ?? "0"}</strong>
              <p>Primary prop-firm customer accounts with trader access.</p>
            </article>
            <article className="phase-card active">
              <span>Admin seats</span>
              <strong>{summary.rows[0]?.adminUsers ?? "0"}</strong>
              <p>Operational users with elevated platform controls.</p>
            </article>
            <article className="phase-card active">
              <span>Review mode</span>
              <strong>Live</strong>
              <p>User roles and account access levels are visible below.</p>
            </article>
          </section>

          <section className="table-card">
            <div className="table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {users.rows.map((user) => (
                    <tr key={user.email}>
                      <td>{user.fullName}</td>
                      <td>{user.email}</td>
                      <td>{user.role}</td>
                      <td>{new Date(user.createdAt).toLocaleDateString("en-GB")}</td>
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
