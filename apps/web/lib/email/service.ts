import { MockEmailProvider } from "./mock-provider";
import { ResendEmailProvider } from "./resend-provider";
import {
  buildAccountBreachedEmail,
  buildChallengeCertificateEmail,
  buildOrderReceivedEmail,
  buildPasswordResetEmail,
  buildPayoutCertificateEmail,
  buildTradingCredentialsEmail,
  buildVerificationEmail,
  buildWelcomeEmail
} from "./templates";
import type { EmailProvider } from "./types";
import { getWebEnv } from "../env";

function getProvider(): EmailProvider {
  const env = getWebEnv();
  const { resendApiKey: apiKey, resendFromEmail, hasRealResend, nodeEnv } = env;

  if (hasRealResend) {
    return new ResendEmailProvider(apiKey as string, resendFromEmail);
  }

  if (nodeEnv === "production") {
    throw new Error(
      `Email sending is not fully configured for production. Check RESEND_API_KEY and RESEND_FROM_EMAIL (current sender: ${resendFromEmail}).`
    );
  }

  return new MockEmailProvider();
}

export async function sendWelcomeEmail(input: { to: string; fullName: string }) {
  const provider = getProvider();
  await provider.send(buildWelcomeEmail(input));
}

export async function sendVerificationEmail(input: { to: string; fullName: string; verificationUrl: string }) {
  const provider = getProvider();
  await provider.send(buildVerificationEmail(input));
}

export async function sendPasswordResetEmail(input: { to: string; fullName: string; resetUrl: string }) {
  const provider = getProvider();
  await provider.send(buildPasswordResetEmail(input));
}

export async function sendOrderReceivedEmail(input: {
  to: string;
  fullName: string;
  invoiceReference: string;
  amountCents: number;
  planName: string;
  billingUrl: string;
}) {
  const provider = getProvider();
  await provider.send(buildOrderReceivedEmail(input));
}

export async function sendTradingCredentialsEmail(input: {
  to: string;
  fullName: string;
  login: string;
  password: string;
  platform: string;
  connection: string;
  billingUrl: string;
}) {
  const provider = getProvider();
  await provider.send(buildTradingCredentialsEmail(input));
}

export async function sendChallengeCertificateEmail(input: {
  to: string;
  fullName: string;
  login: string;
  accountState: "PASSED" | "FUNDED";
  certificateUrl: string;
}) {
  const provider = getProvider();
  await provider.send(buildChallengeCertificateEmail(input));
}

export async function sendPayoutCertificateEmail(input: {
  to: string;
  fullName: string;
  login: string;
  amountCents: number;
  payoutStatus: "APPROVED" | "PAID";
  certificateUrl: string;
}) {
  const provider = getProvider();
  await provider.send(buildPayoutCertificateEmail(input));
}

export async function sendAccountBreachedEmail(input: {
  to: string;
  fullName: string;
  login: string;
  accountUrl: string;
}) {
  const provider = getProvider();
  await provider.send(buildAccountBreachedEmail(input));
}
