export type TrustMetric = {
  label: string;
  value: string;
  detail: string;
};

export type ChallengePlan = {
  name: string;
  shortLabel: string;
  price: string;
  originalPrice?: string;
  accountSize: string;
  summary: string;
  featured?: boolean;
  highlights: string[];
  phaseLabel: string;
  payoutSplit: string;
};

export const MARKETING_SALE_DISCOUNT_PCT = 30;
export const CHALLENGE_PLAN_BASE_PRICES_CENTS = {
  "starter-50k": 20000,
  "pro-100k": 30000,
  "elite-150k": 40000,
  "apex-600k": 90000
} as const;

export function getChallengePlanBasePriceCents(slug: string, fallbackPriceCents: number) {
  return CHALLENGE_PLAN_BASE_PRICES_CENTS[slug as keyof typeof CHALLENGE_PLAN_BASE_PRICES_CENTS] ?? fallbackPriceCents;
}

export type SimpleFeature = {
  title: string;
  description: string;
};

export type FAQItem = {
  question: string;
  answer: string;
};

export const trustMetrics: TrustMetric[] = [
  {
    label: "Trader progression",
    value: "Rule clarity at every step",
    detail: "FundedPro surfaces target progress, drawdown pressure, and eligibility status in a way traders can act on quickly."
  },
  {
    label: "Operations",
    value: "Fast internal review paths",
    detail: "Purchases, account setup, payout review, and manual exceptions are designed for speed without losing control."
  },
  {
    label: "Risk posture",
    value: "Discipline before hype",
    detail: "The platform is built around repeatable execution, transparent thresholds, and professional accountability."
  }
];

export const challengePlans: ChallengePlan[] = [
  {
    name: "Starter",
    shortLabel: "Starter",
    price: "$140",
    originalPrice: "$200",
    accountSize: "$50K",
    summary: "A tighter risk envelope for traders who want a clean first step into structured evaluation.",
    phaseLabel: "1-step evaluation",
    payoutSplit: "Up to 85%",
    highlights: [
      "$50,000 simulated balance",
      "6% profit target",
      "2% daily drawdown",
      "Minimum 3 trading days",
      "5% max drawdown"
    ]
  },
  {
    name: "Pro",
    shortLabel: "Pro",
    price: "$210",
    originalPrice: "$300",
    accountSize: "$100K",
    summary: "Balanced sizing and sharper progression for active traders ready to scale with consistency.",
    featured: true,
    phaseLabel: "1-step evaluation",
    payoutSplit: "Up to 85%",
    highlights: [
      "$100,000 simulated balance",
      "6% profit target",
      "2% daily drawdown",
      "Minimum 3 trading days",
      "5% max drawdown"
    ]
  },
  {
    name: "Elite",
    shortLabel: "Elite",
    price: "$280",
    originalPrice: "$400",
    accountSize: "$150K",
    summary: "Larger buying power with premium support for experienced traders targeting higher output.",
    phaseLabel: "1-step evaluation",
    payoutSplit: "Up to 85%",
    highlights: [
      "$150,000 simulated balance",
      "6% profit target",
      "2% daily drawdown",
      "Minimum 3 trading days",
      "5% max drawdown"
    ]
  },
  {
    name: "Apex",
    shortLabel: "Apex",
    price: "$630",
    originalPrice: "$900",
    accountSize: "$600K",
    summary: "Maximum simulated buying power for traders who want the biggest evaluation tier on the board.",
    phaseLabel: "1-step evaluation",
    payoutSplit: "Up to 85%",
    highlights: [
      "$600,000 simulated balance",
      "6% profit target",
      "2% daily drawdown",
      "Minimum 3 trading days",
      "5% max drawdown"
    ]
  }
];

export const howItWorksSteps: SimpleFeature[] = [
  {
    title: "Choose a program",
    description: "Start with the account size and rule structure that matches your pace, risk appetite, and trading style."
  },
  {
    title: "Trade inside the framework",
    description: "Hit your targets while respecting daily loss, total drawdown, and behavioral restrictions designed to protect account integrity."
  },
  {
    title: "Pass review and activate",
    description: "Once you complete the required milestones, FundedPro can move you into the next phase or funded progression path."
  },
  {
    title: "Request payouts and scale",
    description: "Eligible traders can request payouts, maintain good standing, and progress into larger opportunities over time."
  }
];

export const whyFundedProFeatures: SimpleFeature[] = [
  {
    title: "Premium visibility",
    description: "The dashboard is designed to make risk and progress obvious, not buried behind clutter."
  },
  {
    title: "Clean rulebook",
    description: "Thresholds are defined clearly so traders know exactly what is required and what will trigger review."
  },
  {
    title: "Operational confidence",
    description: "Admin tools, sync monitoring, and payout workflows are part of the product from the start."
  },
  {
    title: "Trader-first pacing",
    description: "Fast onboarding and premium support are paired with disciplined guardrails instead of vague promises."
  }
];

export const payoutFeatures: SimpleFeature[] = [
  {
    title: "Eligibility checkpoints",
    description: "Payouts depend on active trading days, rule compliance, and account review status."
  },
  {
    title: "Review controls",
    description: "Risk holds and suspicious behavior flags can pause approval until manual review is complete."
  },
  {
    title: "Transparent workflow",
    description: "Traders can see request status, history, and the conditions that affect release timing."
  }
];

export const ruleHighlights: SimpleFeature[] = [
  {
    title: "Profit targets",
    description: "Targets are defined by plan and phase so progression stays measurable and consistent."
  },
  {
    title: "Daily loss limits",
    description: "Each account has a daily loss guardrail to help contain damage from one bad session."
  },
  {
    title: "Max drawdown",
    description: "Overall account protection stays visible throughout the challenge and funded lifecycle."
  },
  {
    title: "Behavior flags",
    description: "News trading, copy trading, EA usage, and weekend holding can be controlled by plan configuration."
  }
];

export const faqItems: FAQItem[] = [
  {
    question: "What kind of products does FundedPro offer?",
    answer: "FundedPro supports one-step, two-step, and instant funding style products. Each plan has its own targets, drawdown limits, and progression rules."
  },
  {
    question: "How quickly are accounts provisioned after purchase?",
    answer: "The platform is designed for fast operational turnaround. Provisioning speed depends on payment confirmation, internal review triggers, and internal account setup status."
  },
  {
    question: "When can a trader request a payout?",
    answer: "Payout timing depends on the product rules, minimum trading day thresholds, account standing, and whether the request passes risk review."
  },
  {
    question: "What platform does FundedPro use for trading?",
    answer: "FundedPro uses its internal Phynic platform for challenge access, terminal login, position tracking, and customer-facing trading metrics."
  },
  {
    question: "Are legal and compliance workflows complete?",
    answer: "The product includes consent logging, audit trails, and placeholders for KYC and AML integrations, but final legal and compliance review is still required before launch."
  }
];

export const supportChannels: SimpleFeature[] = [
  {
    title: "Trader support",
    description: "Questions about plans, account states, rules, or payouts."
  },
  {
    title: "Billing help",
    description: "Assistance with checkout, invoices, refunds, and payment review."
  },
  {
    title: "Operational review",
    description: "Escalations related to risk flags, platform sync issues, or account access."
  }
];
