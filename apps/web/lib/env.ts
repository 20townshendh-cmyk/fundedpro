type WebEnv = {
  nodeEnv: string;
  appUrl: string;
  nextAuthSecret: string;
  openAiApiKey: string | null;
  resendApiKey: string | null;
  resendFromEmail: string;
  hasRealResend: boolean;
  googleClientId: string | null;
  googleClientSecret: string | null;
  stripeSecretKey: string | null;
  stripePublishableKey: string | null;
  stripeWebhookSecret: string | null;
  tradingCredentialSecret: string;
  ninjaTraderIngestToken: string | null;
  hasRealStripe: boolean;
};

let cachedEnv: WebEnv | null = null;

function isValidResendFromEmail(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return false;
  }

  const namedAddressPattern = /^[^<>]+<[^<>\s@]+@[^<>\s@]+\.[^<>\s@]+>$/;
  const plainAddressPattern = /^[^<>\s@]+@[^<>\s@]+\.[^<>\s@]+$/;

  return namedAddressPattern.test(trimmed) || plainAddressPattern.test(trimmed);
}

function normalizeAppUrl(value: string | undefined) {
  const trimmed = value?.trim();

  if (!trimmed) {
    return "http://localhost:3000";
  }

  return trimmed.endsWith("/") ? trimmed.slice(0, -1) : trimmed;
}

export function getWebEnv(): WebEnv {
  if (cachedEnv) {
    return cachedEnv;
  }

  const nodeEnv = process.env.NODE_ENV || "development";
  const appUrl = normalizeAppUrl(process.env.NEXTAUTH_URL);
  const nextAuthSecret = process.env.NEXTAUTH_SECRET || "change-me";
  const openAiApiKey = process.env.OPENAI_API_KEY || null;
  const resendApiKey = process.env.RESEND_API_KEY || null;
  const resendFromEmail = process.env.RESEND_FROM_EMAIL || "FundedPro <onboarding@resend.dev>";
  const normalizedFromEmail = resendFromEmail.toLowerCase();
  const hasRealResend =
    !!resendApiKey &&
    !resendApiKey.startsWith("re_placeholder") &&
    !normalizedFromEmail.includes("@resend.dev") &&
    isValidResendFromEmail(resendFromEmail);
  const googleClientId = process.env.GOOGLE_CLIENT_ID || null;
  const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET || null;
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY || null;
  const stripePublishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || null;
  const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET || null;
  const tradingCredentialSecret = process.env.TRADING_CREDENTIAL_SECRET || nextAuthSecret;
  const ninjaTraderIngestToken = process.env.NINJATRADER_INGEST_TOKEN || null;

  if (nodeEnv === "production" && (!nextAuthSecret || nextAuthSecret === "change-me")) {
    throw new Error("NEXTAUTH_SECRET must be configured in production.");
  }

  cachedEnv = {
    nodeEnv,
    appUrl,
    nextAuthSecret,
    openAiApiKey,
    resendApiKey,
    resendFromEmail,
    hasRealResend,
    googleClientId,
    googleClientSecret,
    stripeSecretKey,
    stripePublishableKey,
    stripeWebhookSecret,
    tradingCredentialSecret,
    ninjaTraderIngestToken,
    hasRealStripe:
      !!stripeSecretKey &&
      !!stripePublishableKey &&
      !!stripeWebhookSecret &&
      !stripeSecretKey.startsWith("sk_test_placeholder") &&
      !stripePublishableKey.startsWith("pk_test_placeholder") &&
      !stripeWebhookSecret.startsWith("whsec_placeholder")
  };

  return cachedEnv;
}

export function resetWebEnvForTests() {
  cachedEnv = null;
}
