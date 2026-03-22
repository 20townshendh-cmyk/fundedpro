import type { Metadata } from "next";
import { CTASection, FAQList, Footer, MarketingSection, PageHero, SiteShell, TopNav } from "@fundedpro/ui";
import { faqItems } from "@fundedpro/domain/marketing";

export const metadata: Metadata = {
  title: "FAQ | FundedPro Futures Prop Firm Questions",
  description:
    "Get straight answers on FundedPro challenges, payouts, Phynic access, account setup, and trader expectations before checkout."
};

export default function FAQPage() {
  return (
    <SiteShell>
      <TopNav />
      <main>
        <PageHero
          eyebrow="FAQ"
          title="Straight answers for traders evaluating the platform"
          description="FundedPro aims to keep the rulebook, payout logic, and product structure understandable before a trader spends money."
        />
        <MarketingSection
          eyebrow="Common questions"
          title="Clarity matters when traders are deciding where to commit"
          description="These are the launch FAQs for product structure, payouts, Phynic access, and compliance posture."
        >
          <FAQList items={faqItems} />
        </MarketingSection>
        <CTASection
          title="Need a direct answer before checkout?"
          description="Reach support if your question affects plan selection, billing, or account expectations."
          primary={{ href: "/contact", label: "Contact support" }}
        />
      </main>
      <Footer />
    </SiteShell>
  );
}
