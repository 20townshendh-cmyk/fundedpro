import type { Metadata } from "next";
import { CTASection, FeatureGrid, Footer, MarketingSection, PageHero, SiteShell, TopNav } from "@fundedpro/ui";
import { whyFundedProFeatures } from "@fundedpro/domain/marketing";

export const metadata: Metadata = {
  title: "Why FundedPro | Premium Futures Prop Firm Experience",
  description:
    "See what makes FundedPro different: transparent operations, cleaner trader workflows, premium design, and connected support."
};

export default function WhyFundedProPage() {
  return (
    <SiteShell>
      <TopNav />
      <main>
        <PageHero
          eyebrow="Why FundedPro"
          title="Built to feel credible, controlled, and worth trusting"
          description="FundedPro combines premium front-end presentation with the system design needed for payouts, risk review, account monitoring, and operational accountability."
          primaryCta={{ href: "/signup", label: "Join FundedPro" }}
        />
        <MarketingSection
          eyebrow="Platform strengths"
          title="A serious trader product starts with visibility and control"
          description="The experience is designed to support confidence before purchase and clarity after purchase."
        >
          <FeatureGrid items={whyFundedProFeatures} />
        </MarketingSection>
      </main>
      <Footer />
    </SiteShell>
  );
}
