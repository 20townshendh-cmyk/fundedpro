import type { Metadata } from "next";
import { Footer, MarketingSection, PageHero, SiteShell, TopNav } from "@fundedpro/ui";

export const metadata: Metadata = {
  title: "About FundedPro | Prop Firm Platform Overview",
  description:
    "Learn how FundedPro combines challenge sales, trading access, analytics, and operations into one clearer futures prop trading platform."
};

export default function AboutPage() {
  return (
    <SiteShell>
      <TopNav />
      <main>
        <PageHero
          eyebrow="About"
          title="A cleaner prop-firm platform for serious futures traders"
          description="FundedPro combines challenge sales, trader analytics, Phynic, payouts, and operations in one sharper system."
        />
        <section className="section-stack marketing-highlight-grid">
          <a className="marketing-highlight-card marketing-highlight-card-blue marketing-highlight-link" href="/about?assistant=Explain%20how%20FundedPro%20is%20different%20from%20a%20typical%20prop%20firm%20in%20more%20detail">
            <span className="marketing-highlight-kicker">Built for clarity</span>
            <strong>Less noise. More signal.</strong>
            <p>Cleaner flows, visible rules, and a more professional operating feel from first click to funded review.</p>
          </a>
          <a className="marketing-highlight-card marketing-highlight-link" href="/about?assistant=Explain%20how%20FundedPro%20connects%20the%20public%20site%2C%20trader%20desk%2C%20and%20operations%20team">
            <span className="marketing-highlight-kicker">One platform</span>
            <strong>Public site to trader desk</strong>
            <p>Checkout, account delivery, trading state, and admin operations live in the same product instead of disconnected tools.</p>
          </a>
        </section>
        <MarketingSection
          eyebrow="Positioning"
          title="Clarity, speed, discipline, progression"
          description="Designed for traders who want a tighter experience without the usual prop-firm clutter."
        >
          <div className="feature-grid">
            <article className="surface-card">
              <h3 className="feature-title">Original brand system</h3>
              <p className="surface-copy">Dark premium styling, sharp gradients, and a clean wordmark built specifically for FundedPro.</p>
            </article>
            <article className="surface-card">
              <h3 className="feature-title">Operational core</h3>
              <p className="surface-copy">Trader portal, admin workflows, challenge logic, and Phynic account infrastructure operate inside the same product system.</p>
            </article>
          </div>
        </MarketingSection>
      </main>
      <Footer />
    </SiteShell>
  );
}
