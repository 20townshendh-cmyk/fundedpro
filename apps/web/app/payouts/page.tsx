import type { Metadata } from "next";
import { CTASection, FeatureGrid, Footer, MarketingSection, PageHero, SiteShell, TopNav } from "@fundedpro/ui";
import { payoutFeatures } from "@fundedpro/domain/marketing";

export const metadata: Metadata = {
  title: "Payouts | FundedPro Reward Workflow",
  description:
    "Understand FundedPro payout readiness, funded-account eligibility, review states, and the reward workflow before you request a payout."
};

export default function PayoutsPage() {
  return (
    <SiteShell>
      <TopNav />
      <main>
        <PageHero
          eyebrow="Payouts"
          title="A payout workflow built around clarity"
          description="See when a reward request is available, what blocks it, and what review comes next."
          primaryCta={{ href: "/signup", label: "Create your account" }}
          secondaryCta={{ href: "/faq", label: "Read payout FAQs" }}
        />
        <section className="section-stack marketing-highlight-grid">
          <a className="marketing-highlight-card marketing-highlight-card-blue marketing-highlight-link" href="/payouts?assistant=Explain%20reward%20eligibility%20in%20detail%20and%20what%20usually%20blocks%20a%20request">
            <span className="marketing-highlight-kicker">Eligibility</span>
            <strong>Visible before submission</strong>
            <p>Funded status, profit, and review blockers are shown before a request is sent.</p>
          </a>
          <a className="marketing-highlight-card marketing-highlight-link" href="/payouts?assistant=Explain%20how%20reward%20review%20works%20after%20a%20request%20is%20submitted">
            <span className="marketing-highlight-kicker">Review</span>
            <strong>Operational checks stay explicit</strong>
            <p>Reward handling stays structured so traders understand what happens after they submit.</p>
          </a>
        </section>
        <MarketingSection
          eyebrow="Workflow"
          title="Designed to remove ambiguity"
          description="The goal is simple: let traders see readiness, request state, and holds in one place."
        >
          <FeatureGrid items={payoutFeatures} />
        </MarketingSection>
      </main>
      <Footer />
    </SiteShell>
  );
}
