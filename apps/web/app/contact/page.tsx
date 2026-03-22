import type { Metadata } from "next";
import { CTASection, FeatureGrid, Footer, MarketingSection, PageHero, SiteShell, TopNav } from "@fundedpro/ui";
import { supportChannels } from "@fundedpro/domain/marketing";

export const metadata: Metadata = {
  title: "Contact FundedPro | Support And Trader Routing",
  description:
    "Reach the right FundedPro support lane for plans, billing, account setup, payout questions, and trader operations."
};

export default function ContactPage() {
  return (
    <SiteShell>
      <TopNav />
      <main>
        <PageHero
          eyebrow="Contact"
          title="Talk to FundedPro support before or after you start"
          description="Use support for plan questions, billing issues, payout status, or operational review concerns. The support flow in the trader portal will connect into this same structure later."
        />
        <MarketingSection
          eyebrow="Support"
          title="Three launch support lanes for the most common requests"
          description="The public site is structured to route traders quickly before they even reach the in-app support center."
        >
          <FeatureGrid items={supportChannels} />
        </MarketingSection>
        <MarketingSection
          eyebrow="Routing"
          title="Choose the fastest path for the issue you have right now"
          description="The public site is geared toward fast self-routing so traders can get to the correct workflow without guessing."
        >
          <div className="feature-grid">
            <article className="surface-card">
              <h3 className="feature-title">Before checkout</h3>
              <p className="surface-copy">Use this path for plan selection, rules, sizing, and payout-structure questions before you buy.</p>
              <div className="button-row">
                <a href="/challenges" className="marketing-inline-link">Compare challenges</a>
                <a href="/trading-rules" className="marketing-inline-link">Review rules</a>
              </div>
            </article>
            <article className="surface-card">
              <h3 className="feature-title">Existing traders</h3>
              <p className="surface-copy">Sign in if you already have credentials and need billing, account setup, Phynic, or payout support.</p>
              <div className="button-row">
                <a href="/login" className="marketing-inline-link">Open trader area</a>
                <a href="/dashboard/support" className="marketing-inline-link">Support workspace</a>
              </div>
            </article>
            <article className="surface-card">
              <h3 className="feature-title">Need an answer now</h3>
              <p className="surface-copy">The floating AI assistant on the site can guide plan, checkout, dashboard, and payout routing questions immediately.</p>
              <div className="button-row">
                <a href="/faq" className="marketing-inline-link">Browse FAQs</a>
                <a href="/why-fundedpro" className="marketing-inline-link">See platform details</a>
              </div>
            </article>
          </div>
        </MarketingSection>
        <CTASection
          title="Need help choosing a plan?"
          description="Start with the pricing page, then reach out if you want a clearer read on risk structure and progression."
          primary={{ href: "/challenges", label: "Compare plans" }}
          secondary={{ href: "/signup", label: "Create account" }}
        />
      </main>
      <Footer />
    </SiteShell>
  );
}
