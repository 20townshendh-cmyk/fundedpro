import type { Metadata } from "next";
import { CTASection, FeatureGrid, Footer, MarketingSection, PageHero, SiteShell, TopNav } from "@fundedpro/ui";
import { ruleHighlights } from "@fundedpro/domain/marketing";

export const metadata: Metadata = {
  title: "Trading Rules | FundedPro Evaluation Standards",
  description:
    "Review FundedPro trading rules, drawdown controls, phase expectations, and funded-account standards before starting a challenge."
};

export default function TradingRulesPage() {
  return (
    <SiteShell>
      <TopNav />
      <main>
        <PageHero
          eyebrow="Trading rules"
          title="A cleaner rulebook for evaluations, funded accounts, and review states"
          description="FundedPro rules are designed to be configurable in admin while staying understandable to traders on the front end."
          primaryCta={{ href: "/challenges", label: "View plans" }}
        />
        <MarketingSection
          eyebrow="Rule design"
          title="Risk controls stay visible across the entire trader lifecycle"
          description="This launch slice documents the main rule categories that the challenge engine will enforce end to end."
        >
          <FeatureGrid items={ruleHighlights} />
        </MarketingSection>
        <CTASection
          title="Trade with a framework you can actually follow"
          description="Premium experience is only useful if the standards are clear enough to operate inside confidently."
          primary={{ href: "/signup", label: "Start now" }}
          secondary={{ href: "/contact", label: "Ask a question" }}
        />
      </main>
      <Footer />
    </SiteShell>
  );
}
