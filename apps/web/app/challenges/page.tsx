import type { Metadata } from "next";
import { CTASection, Footer, MarketingSection, PageHero, PriceCard, SiteShell, TopNav } from "@fundedpro/ui";
import { challengePlans } from "@fundedpro/domain/marketing";

export const metadata: Metadata = {
  title: "Challenges | FundedPro Futures Evaluations",
  description:
    "Compare FundedPro challenge tiers, account sizes, payouts, and rule structure before starting your futures evaluation."
};

export default function ChallengesPage() {
  return (
    <SiteShell>
      <TopNav />
      <main>
        <PageHero
          eyebrow="Challenges"
          title="Pick the challenge that fits how you trade"
          description="Clear sizing, clear rules, and a premium evaluation flow built for futures traders."
          primaryCta={{ href: "/checkout", label: "Start checkout" }}
          secondaryCta={{ href: "/trading-rules", label: "Review rules" }}
        />
        <section className="section-stack marketing-highlight-grid">
          <a className="marketing-highlight-card marketing-highlight-card-green marketing-highlight-link" href="/challenges?assistant=Explain%20who%20the%20Starter%20challenge%20is%20best%20for%20and%20what%20the%20tradeoffs%20are">
            <span className="marketing-highlight-kicker">Starter</span>
            <strong>Tighter risk, faster start</strong>
            <p>For traders who want a lower-friction entry point with controlled exposure.</p>
          </a>
          <a className="marketing-highlight-card marketing-highlight-card-blue marketing-highlight-link" href="/challenges?assistant=Explain%20the%20Pro%20challenge%20in%20detail%20and%20how%20it%20compares%20to%20the%20other%20models">
            <span className="marketing-highlight-kicker">Pro</span>
            <strong>Balanced progression</strong>
            <p>A more rounded path for traders who want structure, room, and cleaner phase tracking.</p>
          </a>
          <a className="marketing-highlight-card marketing-highlight-link" href="/challenges?assistant=Explain%20the%20Elite%20challenge%20and%20who%20it%20is%20best%20suited%20for">
            <span className="marketing-highlight-kicker">Elite</span>
            <strong>Bigger buying power</strong>
            <p>Higher simulated capital for traders who want premium scale inside the same operating model.</p>
          </a>
        </section>
        <MarketingSection
          eyebrow="Pricing"
          title="Three launch tiers"
          description="Choose the structure that matches your approach."
        >
          <div className="pricing-grid">
            {challengePlans.map((plan) => (
              <PriceCard key={plan.name} {...plan} />
            ))}
          </div>
        </MarketingSection>
        <CTASection
          title="Ready to trade inside a more professional structure?"
          description="Create your account, complete checkout, and move into a challenge workflow designed for clarity and speed."
          primary={{ href: "/checkout", label: "Open checkout" }}
        />
      </main>
      <Footer />
    </SiteShell>
  );
}
