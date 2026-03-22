import { redirect } from "next/navigation";
import { Footer, SiteShell, TopNav } from "@fundedpro/ui";
import { getWebEnv } from "../../../lib/env";
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

const transactionalFlows = [
  {
    label: "Verification",
    status: "Live flow",
    trigger: "New email signup and resend verification",
    cta: "Verify Email",
    note: "Confirms the trader email before first login and protects auth quality."
  },
  {
    label: "Welcome",
    status: "Live flow",
    trigger: "After successful email verification or first Google signup",
    cta: "Start Your Challenge",
    note: "Sets the tone, welcomes the trader, and pushes them toward challenge selection."
  },
  {
    label: "Password reset",
    status: "Live flow",
    trigger: "Forgot password request",
    cta: "Reset Password",
    note: "Keeps recovery fast while still using an expiring secure reset link."
  },
  {
    label: "Challenge order",
    status: "Live flow",
    trigger: "Order marked paid",
    cta: "Open Billing",
    note: "Confirms purchase, anchors the invoice reference, and reduces support friction."
  },
  {
    label: "Trading credentials",
    status: "Live flow",
    trigger: "Account provisioned or credentials reissued",
    cta: "Open Billing",
    note: "Delivers platform, login, connection, and password in one operational email."
  },
  {
    label: "Challenge certificate",
    status: "Live flow",
    trigger: "Passed or funded milestone",
    cta: "Open Certificate",
    note: "Turns progression into proof and reinforces momentum toward the next stage."
  },
  {
    label: "Payout certificate",
    status: "Live flow",
    trigger: "Approved or paid reward milestone",
    cta: "Open Certificate",
    note: "Makes payouts feel real and shareable for trust and social proof."
  },
  {
    label: "Breach alert",
    status: "Live flow",
    trigger: "Account enters breached state",
    cta: "Open Account",
    note: "Flags rule failure clearly and pushes the trader toward account review and support."
  }
] as const;

const campaignBlueprints = [
  {
    label: "Welcome Email",
    subject: "Welcome to FundedPro",
    headline: "Your journey to getting funded starts now.",
    cta: "Start Your Challenge",
    goal: "Get first-session activation fast.",
    note: "Clean first impression, strong brand trust, and one clear CTA."
  },
  {
    label: "Sales / Offer Email",
    subject: "Get funded. Keep more profits.",
    headline: "Funded trading with a cleaner prop-firm path.",
    cta: "Buy Challenge",
    goal: "Convert quickly from cold or warm traffic.",
    note: "Short benefit-led copy, visible offer, minimal friction."
  },
  {
    label: "Urgency Email",
    subject: "Ends tonight",
    headline: "Final hours to secure your challenge offer.",
    cta: "Do Not Miss Out",
    goal: "Use time pressure to drive clicks and purchases.",
    note: "Best paired with discounts, limited windows, or expiring campaign launches."
  },
  {
    label: "Education Email",
    subject: "Why most traders fail",
    headline: "Learn the rules that separate funded traders from the rest.",
    cta: "Start Your Challenge",
    goal: "Build trust and warm hesitant traders.",
    note: "Simple teaching, visible expertise, and a soft conversion CTA."
  },
  {
    label: "Payout / Proof Email",
    subject: "Another trader payout is in",
    headline: "Real traders. Real profits. Real payouts.",
    cta: "Join Them",
    goal: "Make the brand feel credible and attainable.",
    note: "Best used with payout proof, certificate proof, and social validation."
  },
  {
    label: "Reminder Email",
    subject: "Still thinking about it?",
    headline: "Your challenge setup is still waiting.",
    cta: "Finish Your Purchase",
    goal: "Recover interested users who did not complete checkout.",
    note: "Works for browse abandon, click abandon, and incomplete purchase states."
  },
  {
    label: "Discount Email",
    subject: "20% off today only",
    headline: "Claim your challenge discount before it expires.",
    cta: "Use Code Now",
    goal: "Push fence-sitters over the line.",
    note: "Keep the offer visible immediately above the CTA."
  },
  {
    label: "Comeback Email",
    subject: "We miss you",
    headline: "Come back and restart your funded path.",
    cta: "Come Back & Get Funded",
    goal: "Reactivate inactive or dormant leads.",
    note: "Best when paired with a fresh offer, product update, or proof event."
  }
] as const;

const emailStandards = [
  "Domain email and verified sender",
  "Resend platform connected",
  "SPF, DKIM, and DMARC configured",
  "Clean branded dark FundedPro template",
  "Strong CTA in every revenue or lifecycle email",
  "Automated flows for auth, billing, credentials, and certificates",
  "Persuasive copy that feels premium and trader-focused"
] as const;

export default async function AdminEmailPage() {
  await requireAdmin();
  const env = getWebEnv();
  const emailStatus = env.hasRealResend ? "Live-ready" : env.resendApiKey ? "Needs sender review" : "Missing API key";

  return (
    <SiteShell>
      <TopNav />
      <main className="dashboard-shell">
        <AdminSidebar
          active="email"
          title="Email control"
          description="Run the transactional and campaign email layer for verification, conversions, credentials, and payout trust."
        />

        <section className="dashboard-main admin-page">
          <section className="dashboard-hero">
            <div className="hero-stack">
              <div>
                <p className="eyebrow">Admin email</p>
                <h1 className="page-title">Email command center for FundedPro</h1>
                <p className="page-copy">This lane now groups the full prop-firm email stack: auth, challenge purchase, credentials, trust, proof, urgency, and lifecycle conversion.</p>
              </div>
              <div className="hero-inline-metrics">
                <article className="inline-metric">
                  <span>Sender</span>
                  <strong>{emailStatus}</strong>
                </article>
                <article className="inline-metric">
                  <span>Transactional</span>
                  <strong>{transactionalFlows.length}</strong>
                </article>
                <article className="inline-metric">
                  <span>Campaign lanes</span>
                  <strong>{campaignBlueprints.length}</strong>
                </article>
                <article className="inline-metric">
                  <span>From</span>
                  <strong>{env.resendFromEmail}</strong>
                </article>
              </div>
            </div>

            <div className="surface-card callout-card spotlight-card">
              <div className="spotlight-head">
                <span className="muted-label">Email posture</span>
                <span className="status-pill">{emailStatus}</span>
              </div>
              <strong className="spotlight-value">Own the full prop-firm lifecycle in email</strong>
              <p className="surface-copy">Verification, password reset, challenge received, trading credentials, and certificate emails are wired into the live app. This admin lane also defines the revenue campaign structure you asked for: welcome, sales, urgency, education, payout proof, reminder, discount, and comeback.</p>
              <div className="spotlight-grid">
                <div>
                  <span className="muted-label">Primary sender</span>
                  <strong>{env.resendFromEmail}</strong>
                </div>
                <div>
                  <span className="muted-label">Email provider</span>
                  <strong>{env.resendApiKey ? "Resend" : "Missing"}</strong>
                </div>
              </div>
            </div>
          </section>

          <section className="dashboard-grid trader-summary-grid">
            {emailStandards.map((item) => (
              <article className="surface-card metric-panel" key={item}>
                <span className="muted-label">Email standard</span>
                <strong className="metric-value">{item}</strong>
                <p className="surface-copy">Keep this present before relying on email for auth, trust, or revenue conversion.</p>
              </article>
            ))}
          </section>

          <section className="dashboard-desk-grid">
            <article className="surface-card desk-card">
              <div className="detail-head">
                <div>
                  <span className="muted-label">Transactional flows</span>
                  <strong className="metric-value">Automated emails that should always feel reliable</strong>
                </div>
              </div>
              <div className="session-table">
                {transactionalFlows.map((flow) => (
                  <div className="session-row" key={flow.label}>
                    <span>{flow.label}</span>
                    <strong>{flow.cta}</strong>
                    <span>{flow.trigger} | {flow.note}</span>
                  </div>
                ))}
              </div>
            </article>

            <article className="surface-card desk-card">
              <div className="detail-head">
                <div>
                  <span className="muted-label">Campaign library</span>
                  <strong className="metric-value">Revenue and retention structures to run from admin</strong>
                </div>
              </div>
              <div className="session-table">
                {campaignBlueprints.map((campaign) => (
                  <div className="session-row" key={campaign.label}>
                    <span>{campaign.label}</span>
                    <strong>{campaign.cta}</strong>
                    <span>{campaign.subject} | {campaign.goal}</span>
                  </div>
                ))}
              </div>
            </article>
          </section>

          <section className="table-card admin-table-panel">
            <div className="detail-head">
              <div>
                <span className="muted-label">Template control board</span>
                <strong className="metric-value">Subjects, headlines, CTA structure, and conversion intent</strong>
              </div>
            </div>
            <div className="table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Lane</th>
                    <th>Subject</th>
                    <th>Headline</th>
                    <th>CTA</th>
                    <th>Goal</th>
                  </tr>
                </thead>
                <tbody>
                  {campaignBlueprints.map((campaign) => (
                    <tr key={campaign.label}>
                      <td>{campaign.label}</td>
                      <td>{campaign.subject}</td>
                      <td>{campaign.headline}</td>
                      <td>{campaign.cta}</td>
                      <td>{campaign.goal}</td>
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
