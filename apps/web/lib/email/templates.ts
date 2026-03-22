import type { EmailMessage } from "./types";

function buildEmailShell(input: {
  eyebrow: string;
  title: string;
  intro: string;
  body: string;
  ctaLabel?: string;
  ctaHref?: string;
  footer: string;
}) {
  return `
    <div style="margin:0;padding:32px 16px;background:#071711;font-family:Segoe UI,Arial,sans-serif;color:#e7f5ed;">
      <div style="max-width:640px;margin:0 auto;">
        <div style="margin-bottom:18px;text-align:center;color:#d8fff1;font-size:24px;font-weight:700;letter-spacing:.02em;">
          FundedPro
        </div>
        <div style="border:1px solid rgba(126,164,145,0.18);border-radius:28px;overflow:hidden;background:linear-gradient(180deg,#143126 0%,#091711 100%);box-shadow:0 24px 60px rgba(0,0,0,0.28);">
          <div style="padding:40px 36px 20px;background:radial-gradient(circle at top, rgba(216,255,232,0.12), transparent 46%);">
            <div style="display:inline-block;padding:8px 12px;border-radius:999px;border:1px solid rgba(92,242,168,0.24);background:rgba(216,255,232,0.08);color:#bff9d8;font-size:11px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;">
              ${input.eyebrow}
            </div>
            <h1 style="margin:18px 0 14px;font-size:36px;line-height:1.02;color:#f5fff9;">
              ${input.title}
            </h1>
            <p style="margin:0 0 14px;color:#b8d0c1;font-size:16px;line-height:1.75;">
              ${input.intro}
            </p>
            <p style="margin:0;color:#9db7a8;font-size:15px;line-height:1.75;">
              ${input.body}
            </p>
          </div>
          ${
            input.ctaLabel && input.ctaHref
              ? `
          <div style="padding:8px 36px 12px;">
            <a href="${input.ctaHref}" style="display:inline-block;padding:15px 22px;border-radius:999px;text-decoration:none;font-weight:700;background:linear-gradient(135deg,#16a34a 0%,#5cf2a8 58%,#b7ff4a 100%);color:#04110b;">
              ${input.ctaLabel}
            </a>
          </div>
          <div style="padding:0 36px 12px;color:#8ea596;font-size:13px;line-height:1.7;">
            If the button does not work, open this link:<br />
            <a href="${input.ctaHref}" style="color:#bff9d8;word-break:break-all;text-decoration:none;">${input.ctaHref}</a>
          </div>
          `
              : ""
          }
          <div style="padding:18px 36px 32px;border-top:1px solid rgba(126,164,145,0.12);color:#7f998a;font-size:13px;line-height:1.7;">
            ${input.footer}
          </div>
        </div>
      </div>
    </div>
  `;
}

export function buildWelcomeEmail(input: { to: string; fullName: string }): EmailMessage {
  return {
    to: input.to,
    subject: "Welcome to FundedPro",
    text: `Welcome to FundedPro, ${input.fullName}. Your workspace is ready and you can now move into challenge selection, billing, and account tracking.`,
    html: buildEmailShell({
      eyebrow: "FundedPro Access",
      title: `Welcome, ${input.fullName}.`,
      intro: "Your FundedPro workspace is ready.",
      body: "You can now review challenge products, complete billing, and track account progression from one place.",
      footer: "As FundedPro expands, this channel will also handle challenge confirmations, account provisioning, payout updates, and support replies."
    })
  };
}

export function buildVerificationEmail(input: { to: string; fullName: string; verificationUrl: string }): EmailMessage {
  return {
    to: input.to,
    subject: "Verify your FundedPro account",
    text: `Hi ${input.fullName}, please verify that this was you by opening this link: ${input.verificationUrl}`,
    html: buildEmailShell({
      eyebrow: "FundedPro Verification",
      title: "Confirm it was you.",
      intro: `Hi ${input.fullName}, before you access FundedPro, please verify your email address.`,
      body: "This helps protect your account and confirms that this signup request came from you.",
      ctaLabel: "Verify Email",
      ctaHref: input.verificationUrl,
      footer: "If you did not create this account, you can safely ignore this email."
    })
  };
}

export function buildPasswordResetEmail(input: { to: string; fullName: string; resetUrl: string }): EmailMessage {
  return {
    to: input.to,
    subject: "Reset your FundedPro password",
    text: `Hi ${input.fullName}, reset your FundedPro password here: ${input.resetUrl}`,
    html: buildEmailShell({
      eyebrow: "FundedPro Security",
      title: "Reset your password.",
      intro: `Hi ${input.fullName}, we received a request to reset your password.`,
      body: "Use the button below to choose a new password. This reset link expires after 10 minutes.",
      ctaLabel: "Reset Password",
      ctaHref: input.resetUrl,
      footer: "If you did not request a password reset, you can ignore this email."
    })
  };
}

export function buildOrderReceivedEmail(input: {
  to: string;
  fullName: string;
  invoiceReference: string;
  amountCents: number;
  planName: string;
  billingUrl: string;
}): EmailMessage {
  const amount = (input.amountCents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });

  return {
    to: input.to,
    subject: "FundedPro order received",
    text: `Hi ${input.fullName}, your order has been received. Thank you for ordering with FundedPro. Invoice ${input.invoiceReference} for ${amount} is now available in billing: ${input.billingUrl}`,
    html: buildEmailShell({
      eyebrow: "FundedPro Billing",
      title: "Your order has been received.",
      intro: `Hi ${input.fullName}, thank you for ordering with FundedPro.`,
      body: `We've received your ${input.planName} order. Your invoice reference is ${input.invoiceReference} and the amount is ${amount}.`,
      ctaLabel: "Open Billing",
      ctaHref: input.billingUrl,
      footer: "Keep this email for your records. If you need help with your order, reply through the support area in your FundedPro workspace."
    })
  };
}

export function buildTradingCredentialsEmail(input: {
  to: string;
  fullName: string;
  login: string;
  password: string;
  platform: string;
  connection: string;
  billingUrl: string;
}): EmailMessage {
  return {
    to: input.to,
    subject: "Your FundedPro trading account is ready",
    text: `Hi ${input.fullName}, your trading account is ready. Platform: ${input.platform}. Login: ${input.login}. Connection: ${input.connection}. Password: ${input.password}. Billing: ${input.billingUrl}`,
    html: buildEmailShell({
      eyebrow: "FundedPro Provisioning",
      title: "Your trading account is ready.",
      intro: `Hi ${input.fullName}, your challenge account has been provisioned.`,
      body: `Platform: ${input.platform}<br />Login: ${input.login}<br />Connection: ${input.connection}<br />Password: ${input.password}`,
      ctaLabel: "Open Billing",
      ctaHref: input.billingUrl,
      footer: "Store these credentials securely. If you need help accessing the account, contact FundedPro support."
    })
  };
}

export function buildChallengeCertificateEmail(input: {
  to: string;
  fullName: string;
  login: string;
  accountState: "PASSED" | "FUNDED";
  certificateUrl: string;
}) {
  const milestone = input.accountState === "FUNDED" ? "funded account certificate" : "challenge completion certificate";

  return {
    to: input.to,
    subject: input.accountState === "FUNDED" ? "Your FundedPro funded certificate is ready" : "Your FundedPro pass certificate is ready",
    text: `Hi ${input.fullName}, your ${milestone} for account ${input.login} is now ready. Open it here: ${input.certificateUrl}`,
    html: buildEmailShell({
      eyebrow: input.accountState === "FUNDED" ? "Funded Achievement" : "Challenge Pass",
      title: input.accountState === "FUNDED" ? "Your funded certificate is ready." : "Your pass certificate is ready.",
      intro: `Hi ${input.fullName}, your FundedPro certificate for account ${input.login} is now available.`,
      body:
        input.accountState === "FUNDED"
          ? "You have reached funded status and your official certificate is ready to view and share."
          : "You have successfully completed your challenge and your official certificate is ready to view and share.",
      ctaLabel: "Open Certificate",
      ctaHref: input.certificateUrl,
      footer: "Keep this certificate for your records. You can always reopen it from your FundedPro account area."
    })
  };
}

export function buildPayoutCertificateEmail(input: {
  to: string;
  fullName: string;
  login: string;
  amountCents: number;
  payoutStatus: "APPROVED" | "PAID";
  certificateUrl: string;
}) {
  const amount = (input.amountCents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });

  return {
    to: input.to,
    subject: input.payoutStatus === "PAID" ? "Your FundedPro payout certificate is ready" : "Your approved reward certificate is ready",
    text: `Hi ${input.fullName}, your payout certificate for ${amount} on account ${input.login} is now ready. Open it here: ${input.certificateUrl}`,
    html: buildEmailShell({
      eyebrow: "Reward Certificate",
      title: input.payoutStatus === "PAID" ? "Your payout certificate is ready." : "Your reward certificate is ready.",
      intro: `Hi ${input.fullName}, your ${amount} reward certificate for account ${input.login} is now available.`,
      body:
        input.payoutStatus === "PAID"
          ? "Your payout has been marked as paid and your official FundedPro reward certificate is ready to view and share."
          : "Your reward has been approved and your official FundedPro certificate is ready to view and share.",
      ctaLabel: "Open Certificate",
      ctaHref: input.certificateUrl,
      footer: "Keep this certificate for your records. You can reopen it from your FundedPro payouts area at any time."
    })
  };
}

export function buildAccountBreachedEmail(input: {
  to: string;
  fullName: string;
  login: string;
  accountUrl: string;
}) {
  return {
    to: input.to,
    subject: "Your FundedPro account has been breached",
    text: `Hi ${input.fullName}, your FundedPro account ${input.login} has moved to BREACHED status after exceeding its rule limits. Open your account here: ${input.accountUrl}`,
    html: buildEmailShell({
      eyebrow: "Risk Alert",
      title: "Your account has been breached.",
      intro: `Hi ${input.fullName}, account ${input.login} has triggered a breach state.`,
      body: "Trade entry has been locked in Phynic because one or more challenge rule limits were exceeded. Open your account area to review the status and next steps.",
      ctaLabel: "Open Account",
      ctaHref: input.accountUrl,
      footer: "This alert was sent automatically when your account moved into a breached state."
    })
  };
}
