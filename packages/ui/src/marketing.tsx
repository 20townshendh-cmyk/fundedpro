import { MARKETING_SALE_DISCOUNT_PCT, type ChallengePlan, type FAQItem, type SimpleFeature, type TrustMetric } from "@fundedpro/domain/marketing";
import { HeroTreeScene } from "./hero-tree-scene";

const primaryButtonStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "14px 20px",
  borderRadius: "999px",
  textDecoration: "none",
  fontWeight: 700,
  background: "linear-gradient(135deg, #16a34a 0%, #5cf2a8 58%, #b7ff4a 100%)",
  color: "#04110b",
  boxShadow: "0 18px 44px rgba(22, 163, 74, 0.24)"
};

const ghostButtonStyle: React.CSSProperties = {
  ...primaryButtonStyle,
  background: "rgba(14, 32, 24, 0.78)",
  color: "#edf8f1",
  border: "1px solid rgba(126, 164, 145, 0.18)",
  boxShadow: "none"
};

function LogoMark() {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" aria-hidden="true">
      <defs>
        <linearGradient id="fundedpro-mark" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#143628" />
          <stop offset="100%" stopColor="#0b2118" />
        </linearGradient>
        <linearGradient id="fundedpro-leaves" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#d8fff1" />
          <stop offset="55%" stopColor="#7cf3b4" />
          <stop offset="100%" stopColor="#22c55e" />
        </linearGradient>
        <linearGradient id="fundedpro-trunk" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#f4d6b0" />
          <stop offset="100%" stopColor="#9a5b2d" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="38" height="38" rx="12" fill="url(#fundedpro-mark)" />
      <circle cx="15" cy="16" r="5.5" fill="url(#fundedpro-leaves)" />
      <circle cx="22" cy="13.5" r="6.5" fill="url(#fundedpro-leaves)" />
      <circle cx="27" cy="18" r="5" fill="url(#fundedpro-leaves)" />
      <circle cx="20" cy="20" r="7.2" fill="url(#fundedpro-leaves)" />
      <circle cx="13.5" cy="21" r="4.2" fill="url(#fundedpro-leaves)" opacity="0.95" />
      <rect x="17" y="21" width="6" height="10" rx="3" fill="url(#fundedpro-trunk)" />
      <path d="M16 31c1.2-2.8 2.5-4.2 4-4.2s2.8 1.4 4 4.2h-2.7c-.6-1.3-.9-2-1.3-2s-.7.7-1.3 2Z" fill="#6b3f1f" />
    </svg>
  );
}

export function SiteShell({ children }: { children: React.ReactNode }) {
  return <div className="site-shell">{children}</div>;
}

export function TopNav() {
  return (
    <header className="top-nav">
      <a href="/" className="brand-link">
        <LogoMark />
        <span className="brand-text">FundedPro</span>
      </a>
      <nav className="nav-links">
        <a href="/">Home</a>
        <a href="/why-fundedpro">About</a>
        <a href="/how-it-works">How It Works</a>
        <a href="/challenges">Challenges</a>
        <a href="/payouts">Payouts</a>
        <a href="/dashboard">Trader Area</a>
      </nav>
      <div className="nav-actions">
        <a href="/login" style={ghostButtonStyle}>
          Login
        </a>
        <a href="/signup" style={ghostButtonStyle}>
          Sign Up
        </a>
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="footer-panel">
      <div>
        <div className="brand-link" style={{ marginBottom: "12px" }}>
          <LogoMark />
          <span className="brand-text">FundedPro</span>
        </div>
        <p className="footer-copy">
          FundedPro is built for disciplined traders who want premium visibility, transparent rules, and a more professional path through evaluation and funded progression.
        </p>
      </div>
      <div className="footer-links">
        <a href="/challenges">Challenges</a>
        <a href="/faq">FAQ</a>
        <a href="/payouts">Payouts</a>
        <a href="/trading-rules">Rules</a>
        <a href="/terms">Terms</a>
        <a href="/terms#privacy">Privacy</a>
        <a href="/terms#refund">Refunds</a>
        <a href="/contact">Contact</a>
      </div>
    </footer>
  );
}

export function HomeHero() {
  return (
    <section className="hero-stage">
      <TopNav />
      <div className="hero-orb hero-orb-left" />
      <div className="hero-orb hero-orb-right" />
      <div className="hero-visual-panel">
        <HeroTreeScene />
      </div>
      <div className="hero-grid hero-grid-reimagined">
        <div className="hero-copy-stack">
          <span className="hero-kicker">Brought to you by FundedPro</span>
          <h1 className="hero-title hero-title-wide">
            Trade Like a Professional
            {" "}
            <span className="accent-text">
              <span className="hero-inline-rotator">
                <span>Futures</span>
                {" "}
                <span className="hero-word-rotator" aria-label="Analyst, Pro, Expert, Professional">
                  <span className="hero-word-rotator-track">
                    <span>Analyst</span>
                    <span>Pro</span>
                    <span>Expert</span>
                    <span>Professional</span>
                  </span>
                </span>
              </span>
            </span>
          </h1>
          <p className="hero-copy hero-copy-wide">
            Prove your skills in our one step evaluation, and receive up to $2M in simulated funds from the firm.
          </p>

          <div className="hero-trust-strip">
            <strong>Excellent</strong>
            <span className="hero-stars">★★★★★</span>
            <span>3,094 reviews</span>
            <span>on Trustpilot</span>
          </div>

          <div className="button-row hero-button-row">
            <a href="/signup" style={primaryButtonStyle}>
              Start FundedPro Evaluation
            </a>
          </div>

          <div className="hero-metrics-band">
            <article className="hero-metric-tile">
              <strong>75,000+</strong>
              <span>Simulated traders onboarded</span>
            </article>
            <article className="hero-metric-tile">
              <strong>500,000+</strong>
              <span>Tracked evaluation sessions</span>
            </article>
            <article className="hero-metric-tile">
              <strong>$25M+</strong>
              <span>Funding ambition modelled</span>
            </article>
            <article className="hero-metric-tile">
              <strong>5hr Avg</strong>
              <span>Withdrawal time</span>
            </article>
          </div>
        </div>

      </div>
    </section>
  );
}

export function PageHero({
  eyebrow,
  title,
  description,
  primaryCta,
  secondaryCta
}: {
  eyebrow: string;
  title: string;
  description: string;
  primaryCta?: { href: string; label: string };
  secondaryCta?: { href: string; label: string };
}) {
  return (
    <section className="page-hero">
      <div className="page-hero-inner">
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="page-title">{title}</h1>
        <p className="page-copy">{description}</p>
        {(primaryCta || secondaryCta) && (
          <div className="button-row">
            {primaryCta ? (
              <a href={primaryCta.href} style={primaryButtonStyle}>
                {primaryCta.label}
              </a>
            ) : null}
            {secondaryCta ? (
              <a href={secondaryCta.href} style={ghostButtonStyle}>
                {secondaryCta.label}
              </a>
            ) : null}
          </div>
        )}
      </div>
    </section>
  );
}

export function MarketingSection({
  eyebrow,
  title,
  description,
  children
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="section-stack">
      <div className="section-heading">
        <p className="eyebrow">{eyebrow}</p>
        <h2 className="section-title">{title}</h2>
        <p className="section-copy">{description}</p>
      </div>
      {children}
    </section>
  );
}

export function MetricCard({ label, value, detail }: TrustMetric) {
  return (
    <article className="surface-card">
      <span className="muted-label">{label}</span>
      <strong className="metric-value">{value}</strong>
      <p className="surface-copy">{detail}</p>
    </article>
  );
}

function parsePriceLabel(label: string) {
  return Number(label.replace(/[^0-9.]/g, ""));
}

export function PriceCard(plan: ChallengePlan) {
  const savings =
    plan.originalPrice ? parsePriceLabel(plan.originalPrice) - parsePriceLabel(plan.price) : 0;

  return (
    <article className="surface-card pricing-card">
      <div className="pricing-promo-badge">{MARKETING_SALE_DISCOUNT_PCT}% off</div>
      <div className="pricing-topline">
        <span className="muted-label">{plan.name}</span>
        <span className="pricing-price-stack">
          {plan.originalPrice ? <span className="pricing-original-price">{plan.originalPrice}</span> : null}
          <strong>{plan.price}</strong>
        </span>
      </div>
      <h3 className="price-value">{plan.accountSize}</h3>
      {savings > 0 ? <div className="pricing-savings-label">Save ${savings}</div> : null}
      <div className="pricing-meta">
        <span>{plan.phaseLabel}</span>
        <span>{plan.payoutSplit}</span>
      </div>
      <ul className="bullet-list">
        {plan.highlights.map((highlight) => (
          <li key={highlight}>{highlight}</li>
        ))}
      </ul>
      <a href="/checkout" style={ghostButtonStyle} className="pricing-card-cta">
        Choose Plan
      </a>
    </article>
  );
}

export function FeatureGrid({ items }: { items: SimpleFeature[] }) {
  return (
    <div className="feature-grid">
      {items.map((item) => (
        <article key={item.title} className="surface-card">
          <h3 className="feature-title">{item.title}</h3>
          <p className="surface-copy">{item.description}</p>
        </article>
      ))}
    </div>
  );
}

export function FAQList({ items }: { items: FAQItem[] }) {
  return (
    <div className="faq-list">
      {items.map((item) => (
        <article key={item.question} className="surface-card">
          <h3 className="feature-title">{item.question}</h3>
          <p className="surface-copy">{item.answer}</p>
        </article>
      ))}
    </div>
  );
}

export function CTASection({
  title,
  description,
  primary,
  secondary
}: {
  title: string;
  description: string;
  primary: { href: string; label: string };
  secondary?: { href: string; label: string };
}) {
  return (
    <section className="cta-panel">
      <div>
        <h2 className="section-title">{title}</h2>
        <p className="section-copy">{description}</p>
      </div>
      <div className="button-row">
        <a href={primary.href} style={primaryButtonStyle}>
          {primary.label}
        </a>
        {secondary ? (
          <a href={secondary.href} style={ghostButtonStyle}>
            {secondary.label}
          </a>
        ) : null}
      </div>
    </section>
  );
}

export function AuthCard({
  title,
  description,
  footer,
  action,
  submitLabel = "Continue",
  mode = "login",
  hiddenFields
}: {
  title: string;
  description: string;
  footer: React.ReactNode;
  action: (formData: FormData) => void | Promise<void>;
  submitLabel?: string;
  mode?: "login" | "signup";
  hiddenFields?: Array<{ name: string; value: string }>;
}) {
  return (
    <section className="auth-wrap">
      <div className="auth-card">
        <p className="eyebrow">FundedPro access</p>
        <h1 className="page-title" style={{ fontSize: "clamp(2rem, 4vw, 3rem)" }}>
          {title}
        </h1>
        <p className="page-copy">{description}</p>
        <form action={action} className="form-grid">
          {hiddenFields?.map((field) => (
            <input key={field.name} type="hidden" name={field.name} value={field.value} />
          ))}
          {mode === "signup" ? (
            <label className="field">
              <span>Full name</span>
              <input name="fullName" type="text" placeholder="Alex Carter" />
            </label>
          ) : null}
          <label className="field">
            <span>Email</span>
            <input name="email" type="email" placeholder="trader@fundedpro.com" />
          </label>
          <label className="field">
            <span>Password</span>
            <input name="password" type="password" placeholder="Enter your password" />
          </label>
          {mode === "login" ? (
            <label className="field-check">
              <input name="rememberMe" type="checkbox" />
              <span>Remember me</span>
            </label>
          ) : null}
          <button type="submit" style={primaryButtonStyle}>
            {submitLabel}
          </button>
        </form>
        <div className="auth-footer">{footer}</div>
      </div>
    </section>
  );
}
