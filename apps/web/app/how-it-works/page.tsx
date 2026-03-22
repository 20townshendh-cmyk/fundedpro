import type { Metadata } from "next";
import { CTASection, FeatureGrid, Footer, MarketingSection, PageHero, SiteShell, TopNav } from "@fundedpro/ui";
import { howItWorksSteps } from "@fundedpro/domain/marketing";

export const metadata: Metadata = {
  title: "How FundedPro Works | From Checkout To Phynic",
  description:
    "See how FundedPro moves traders from checkout to credentials, internal trading access, dashboard tracking, and funded progression."
};

export default function HowItWorksPage() {
  return (
    <SiteShell>
      <TopNav />
      <main>
        <PageHero
          eyebrow="How it works"
          title="A simple path from checkout to live account tracking"
          description="Buy a challenge, receive credentials, trade in Phynic, and track progress inside a cleaner dashboard."
          primaryCta={{ href: "/challenges", label: "Compare challenges" }}
        />
        <section className="section-stack marketing-highlight-grid">
          <a className="marketing-highlight-card marketing-highlight-card-blue marketing-highlight-link" href="/how-it-works?assistant=Walk%20me%20through%20how%20buying%20a%20challenge%20works%20step%20by%20step">
            <span className="marketing-highlight-kicker">Step 1</span>
            <strong>Choose and buy</strong>
            <p>Pick the challenge that fits your risk appetite and complete checkout in minutes.</p>
          </a>
          <a className="marketing-highlight-card marketing-highlight-card-green marketing-highlight-link" href="/how-it-works?assistant=Explain%20how%20credentials%20and%20account%20provisioning%20work%20after%20checkout">
            <span className="marketing-highlight-kicker">Step 2</span>
            <strong>Receive credentials</strong>
            <p>Your purchased account is provisioned and linked directly into the internal trading environment.</p>
          </a>
          <a className="marketing-highlight-card marketing-highlight-link" href="/how-it-works?assistant=Explain%20how%20trading%2C%20phase%20tracking%2C%20and%20reward%20readiness%20work%20after%20I%20start">
            <span className="marketing-highlight-kicker">Step 3</span>
            <strong>Trade and progress</strong>
            <p>Monitor phases, rules, positions, and reward readiness without jumping between disconnected tools.</p>
          </a>
        </section>
        <MarketingSection
          eyebrow="Process"
          title="Structured like an operating workflow"
          description="Every stage has a clear next action and visible status."
        >
          <FeatureGrid items={howItWorksSteps} />
        </MarketingSection>
        <CTASection
          title="See the structure before you buy"
          description="FundedPro is built for traders who want premium presentation without hidden ambiguity."
          primary={{ href: "/trading-rules", label: "Read the rules" }}
          secondary={{ href: "/signup", label: "Create account" }}
        />
      </main>
      <Footer />
    </SiteShell>
  );
}
