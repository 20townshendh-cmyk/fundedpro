import type { Metadata } from "next";
import {
  CTASection,
  FeatureGrid,
  Footer,
  HomeHero,
  MarketingSection,
  MetricCard,
  PriceCard,
  SiteShell
} from "@fundedpro/ui";
import { HomePlanComparison } from "./home-plan-comparison";
import { HomeVideoProof } from "./home-video-proof";
import {
  challengePlans,
  howItWorksSteps,
  trustMetrics,
  whyFundedProFeatures
} from "@fundedpro/domain/marketing";
import { HomeCertificateMarquee } from "./home-certificate-marquee";

export const metadata: Metadata = {
  title: "FundedPro | Premium Futures Prop Firm Challenges",
  description:
    "FundedPro gives futures traders a premium path from evaluation to funded progression with transparent rules, clear payouts, and a polished trading workspace."
};

export default function HomePage() {
  return (
    <SiteShell>
      <main>
        <HomeHero />

        <section className="section-stack hero-promo-section">
          <a href="#plans-600k" className="hero-promo-panel">
            <p className="eyebrow">Industry first</p>
            <h2 className="hero-promo-title">
              First Ever
              {" "}
              <span className="accent-text">$600K Account</span>
            </h2>
          </a>
        </section>

        <section className="section-stack">
          <div className="evaluation-comparison">
            <div className="evaluation-copy">
              <p className="eyebrow">One-step view</p>
              <h2 className="section-title">
                Pass the evaluation with a cleaner
                {" "}
                <span className="accent-text">green-light rulebook</span>
              </h2>
              <p className="section-copy">
                FundedPro is structured to keep the progression path visible. Pick the plan tier, compare the framework, and see what changes between evaluation and funded trading conditions.
              </p>
            </div>

            <HomePlanComparison />
          </div>
        </section>

        <HomeCertificateMarquee />

        <MarketingSection
          eyebrow="Programs"
          title="Choose the progression path that fits your process"
          description="Every plan is structured around transparent thresholds, fast onboarding, and trader progression from first evaluation to long-term funded consistency."
        >
          <div className="pricing-grid">
            {challengePlans.map((plan) => (
              <PriceCard key={plan.name} {...plan} />
            ))}
          </div>
        </MarketingSection>

        <HomeVideoProof />

        <MarketingSection
          eyebrow="Built for serious traders"
          title="A premium evaluation platform with clear rules and a sharper operational backbone"
          description="FundedPro combines polished trader UX with the systems a real prop operation needs: challenge tracking, payout workflows, risk monitoring, Phynic account state, and admin control."
        >
          <div className="metric-grid">
            {trustMetrics.map((metric) => (
              <MetricCard key={metric.label} {...metric} />
            ))}
          </div>
        </MarketingSection>

        <MarketingSection
          eyebrow="How it works"
          title="A clean path from purchase to funded progression"
          description="Every step is designed to remove operational guesswork while keeping the standards high."
        >
          <FeatureGrid items={howItWorksSteps} />
        </MarketingSection>

        <MarketingSection
          eyebrow="Why FundedPro"
          title="Premium trader experience with firm-grade operational visibility"
          description="The public site, trader dashboard, and admin workflows operate as one connected prop-firm system instead of disconnected tools."
        >
          <FeatureGrid items={whyFundedProFeatures} />
        </MarketingSection>

        <CTASection
          title="Built to convert evaluation buyers and support them after checkout"
          description="FundedPro is a full prop-firm product, not just a landing page with a payment button."
          primary={{ href: "/signup", label: "Create your account" }}
          secondary={{ href: "/challenges", label: "Compare challenges" }}
        />
      </main>
      <Footer />
    </SiteShell>
  );
}
