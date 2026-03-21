import type { Metadata } from "next";
import { CTASection, Footer, MarketingSection, PageHero, SiteShell, TopNav } from "@fundedpro/ui";

export const metadata: Metadata = {
  title: "Terms, Privacy, And Refunds | FundedPro",
  description:
    "Review FundedPro terms, privacy handling, and refund policy before purchasing a challenge or using the trading platform."
};

export default function TermsPage() {
  return (
    <SiteShell>
      <TopNav />
      <main>
        <PageHero
          eyebrow="Legal"
          title="Terms, privacy, and refund expectations in one place"
          description="This page gives traders a clear launch-stage summary of the commercial, privacy, and refund terms surfaced across the FundedPro website and dashboard."
        />
        <MarketingSection
          eyebrow="Terms"
          title="Core commercial expectations"
          description="Use these terms as the plain-language operating summary before checkout."
        >
          <article id="terms" className="surface-card">
            <strong className="metric-value">Challenge purchases and platform access</strong>
            <ul className="bullet-list">
              <li>Each paid challenge purchase provisions a separate trading account and unique platform credentials.</li>
              <li>Website login credentials and trading credentials are distinct and should be stored separately.</li>
              <li>Challenge, passed, funded, payout, and review outcomes are governed by the rules shown in the trader dashboard and account views.</li>
              <li>FundedPro may place accounts, payouts, or credentials into review when billing, risk, or operational checks require it.</li>
            </ul>
          </article>
        </MarketingSection>
        <MarketingSection
          eyebrow="Privacy"
          title="What account data is used for"
          description="FundedPro only needs enough information to deliver accounts, operate support, and maintain trader records."
        >
          <article id="privacy" className="surface-card">
            <strong className="metric-value">Account, billing, and trading records</strong>
            <ul className="bullet-list">
              <li>We store account details, order history, trading state, billing references, and support activity needed to operate the platform.</li>
              <li>Trading credentials are encrypted at rest and handled separately from website authentication.</li>
              <li>Admin actions tied to payouts, credentials, billing changes, and operational overrides are audit logged.</li>
              <li>Launch-stage legal language should still receive formal legal review before any claim of full regulatory or jurisdiction-specific compliance.</li>
            </ul>
          </article>
        </MarketingSection>
        <MarketingSection
          eyebrow="Refunds"
          title="Refund policy at launch"
          description="Refund handling is intentionally conservative because account provisioning and credential issuance happen quickly after payment."
        >
          <article id="refund" className="surface-card">
            <strong className="metric-value">Billing and refund handling</strong>
            <ul className="bullet-list">
              <li>Requests should be raised before credentials are used or an account is actively traded.</li>
              <li>Completed account provisioning, credential delivery, and platform access may reduce or eliminate refund eligibility.</li>
              <li>Charge, fraud, or duplicate-order issues should be routed through support immediately for manual review.</li>
              <li>Any refund decision may depend on billing status, account state, and audit history tied to the order.</li>
            </ul>
          </article>
        </MarketingSection>
        <CTASection
          title="Want the operational details before you buy?"
          description="Review the rulebook and support routing before starting checkout."
          primary={{ href: "/trading-rules", label: "Read trading rules" }}
          secondary={{ href: "/contact", label: "Open support routing" }}
        />
      </main>
      <Footer />
    </SiteShell>
  );
}
