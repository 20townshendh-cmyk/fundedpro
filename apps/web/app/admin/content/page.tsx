import { redirect } from "next/navigation";
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

export default async function AdminContentPage() {
  await requireAdmin();

  const contentLanes = [
    {
      label: "Homepage",
      status: "Priority",
      note: "Hero, trust, CTA, and comparison copy shape conversion before a trader ever reaches checkout."
    },
    {
      label: "Challenge pages",
      status: "Operational",
      note: "Program sizes, pricing, and rule communication need to stay aligned with the actual challenge engine."
    },
    {
      label: "FAQ",
      status: "Support",
      note: "Clean answers reduce support volume and limit confusion around resets, payouts, and platform access."
    },
    {
      label: "Policies",
      status: "Launch-critical",
      note: "Terms, payout policy, risk disclosures, and onboarding language should remain auditable."
    }
  ];

  return (
    <SiteShell>
      <TopNav />
      <main className="dashboard-shell">
        <AdminSidebar
          active="content"
          title="Content and CMS"
          description="Manage public messaging, FAQs, trust content, and trader-facing informational copy."
        />

        <section className="dashboard-main admin-page">
          <section className="dashboard-hero">
            <div className="hero-stack">
              <div>
                <p className="eyebrow">Admin content</p>
                <h1 className="page-title">Public-site and FAQ content controls</h1>
                <p className="page-copy">This content lane is where homepage copy, challenge descriptions, FAQs, and trust sections can be managed inside the app.</p>
              </div>
              <div className="hero-inline-metrics">
                <article className="inline-metric">
                  <span>Homepage</span>
                  <strong>Priority</strong>
                </article>
                <article className="inline-metric">
                  <span>FAQ</span>
                  <strong>Support-ready</strong>
                </article>
                <article className="inline-metric">
                  <span>Policies</span>
                  <strong>Needs final review</strong>
                </article>
                <article className="inline-metric">
                  <span>Publishing</span>
                  <strong>Admin owned</strong>
                </article>
              </div>
            </div>

            <div className="surface-card callout-card spotlight-card">
              <div className="spotlight-head">
                <span className="muted-label">CMS direction</span>
                <span className="status-pill">Publishing layer</span>
              </div>
              <strong className="spotlight-value">Editorial operations board</strong>
              <p className="surface-copy">This page now acts as the content control surface for launch-critical messaging, copy ownership, and the publishing checklist.</p>
              <div className="spotlight-grid">
                <div>
                  <span className="muted-label">Primary owner</span>
                  <strong>Admin team</strong>
                </div>
                <div>
                  <span className="muted-label">Audit expectation</span>
                  <strong>Required</strong>
                </div>
              </div>
            </div>
          </section>

          <section className="dashboard-grid trader-summary-grid">
            {contentLanes.map((lane) => (
              <article className="surface-card metric-panel" key={lane.label}>
                <span className="muted-label">{lane.label}</span>
                <strong className="metric-value">{lane.status}</strong>
                <p className="surface-copy">{lane.note}</p>
              </article>
            ))}
          </section>

          <section className="dashboard-desk-grid">
            <article className="surface-card desk-card">
              <div className="detail-head">
                <div>
                  <span className="muted-label">Publishing checklist</span>
                  <strong className="metric-value">Before copy goes live</strong>
                </div>
              </div>
              <div className="session-table">
                <div className="session-row">
                  <span>Voice</span>
                  <strong>Premium and trader-focused</strong>
                  <span>Copy should match the FundedPro tone and avoid generic dashboard language.</span>
                </div>
                <div className="session-row">
                  <span>Accuracy</span>
                  <strong>Rules aligned</strong>
                  <span>Challenge, payout, and platform wording should reflect the internal Trade Now environment.</span>
                </div>
                <div className="session-row">
                  <span>Risk</span>
                  <strong>Disclosures present</strong>
                  <span>Trader-facing pages should keep evaluation, payout, and simulated-trading disclaimers clear.</span>
                </div>
              </div>
            </article>

            <article className="surface-card desk-card">
              <div className="detail-head">
                <div>
                  <span className="muted-label">Recommended next content modules</span>
                  <strong className="metric-value">Highest-value additions</strong>
                </div>
              </div>
              <div className="session-table">
                <div className="session-row">
                  <span>1</span>
                  <strong>Structured FAQ editor</strong>
                  <span>Store questions, categories, and publish status in an auditable admin flow.</span>
                </div>
                <div className="session-row">
                  <span>2</span>
                  <strong>Homepage section controls</strong>
                  <span>Let operations manage hero proof points, testimonials, and CTA sequencing.</span>
                </div>
                <div className="session-row">
                  <span>3</span>
                  <strong>Policy publish history</strong>
                  <span>Track versioned changes to payout and legal copy with actor visibility.</span>
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
