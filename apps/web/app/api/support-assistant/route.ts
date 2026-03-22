import OpenAI from "openai";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "../../../lib/auth";
import { getWebEnv } from "../../../lib/env";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const supportMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(1000)
});

const supportRequestSchema = z.object({
  path: z.string().trim().min(1).max(200),
  messages: z.array(supportMessageSchema).min(1).max(20),
  previousResponseId: z.string().trim().min(1).max(200).optional()
});

function getPageContext(path: string) {
  if (path.startsWith("/challenges")) {
    return "The user is on the challenge comparison area and is likely choosing between plans, sizing, rules, or account fit.";
  }

  if (path.startsWith("/payouts")) {
    return "The user is on the payouts area and is likely asking about reward eligibility, holds, funded status, or request flow.";
  }

  if (path.startsWith("/how-it-works")) {
    return "The user is on the process page and is likely asking how checkout, provisioning, credentials, and Phynic fit together.";
  }

  if (path.startsWith("/dashboard/trades")) {
    return "The user is in the trading terminal and may need help with login, orders, positions, market status, or account selection.";
  }

  if (path.startsWith("/dashboard/account")) {
    return "The user is in account detail and may need help understanding balances, phases, trading objectives, or performance metrics.";
  }

  if (path.startsWith("/dashboard/billing")) {
    return "The user is in billing and may need help understanding order state, provisioning, invoices, or credentials.";
  }

  if (path.startsWith("/dashboard/payouts")) {
    return "The user is in dashboard payouts and may need help understanding eligibility, review reasons, or request readiness.";
  }

  if (path.startsWith("/dashboard")) {
    return "The user is in the trader dashboard and likely needs navigation help or explanation of account, billing, payouts, or trading actions.";
  }

  return "The user is on the public site and may need guidance about plans, process, product positioning, or signup.";
}

function buildFallbackReply(path: string, lastUserMessage: string) {
  const normalized = lastUserMessage.toLowerCase();

  if (normalized.includes("credential") || normalized.includes("login") || normalized.includes("password")) {
    return {
      message: "Trading credentials are issued per purchased challenge account. Open Account detail to view the account login, then use the credential email for the trading password.",
      ctaLabel: "Open account detail",
      ctaHref: "/dashboard/account"
    };
  }

  if (normalized.includes("payout") || normalized.includes("reward")) {
    return {
      message: "Reward requests only open for funded accounts with eligible profit and no active hold. The payouts page shows the first blocking reason if the request button is unavailable.",
      ctaLabel: "Open payouts",
      ctaHref: "/dashboard/payouts"
    };
  }

  if (normalized.includes("bill") || normalized.includes("invoice") || normalized.includes("checkout") || normalized.includes("payment")) {
    return {
      message: "Billing issues are usually tied to payment state, invoice visibility, or post-checkout provisioning. The billing page is the fastest place to verify order and provisioning status.",
      ctaLabel: "Open billing",
      ctaHref: "/dashboard/billing"
    };
  }

  if (normalized.includes("trade") || normalized.includes("order") || normalized.includes("position")) {
    return {
      message: "Use your trading account credentials, not your website password, to access Phynic. Orders can be blocked if the market is closed, buying power is insufficient, or the selected account is still locked.",
      ctaLabel: "Open Phynic",
      ctaHref: "/dashboard/trades"
    };
  }

  return {
    message: path.startsWith("/dashboard")
      ? "I can help with billing, payouts, account access, Phynic, and general dashboard guidance. Tell me what you are trying to do and I will help you work through it."
      : "I can help explain plans, checkout, platform access, and support routing. Tell me what you are trying to do and I will guide you from there.",
    ctaLabel: path.startsWith("/dashboard") ? "Open support" : "Contact support",
    ctaHref: path.startsWith("/dashboard") ? "/dashboard/support" : "/contact"
  };
}

function extractOutputText(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const data = payload as {
    output_text?: unknown;
    output?: Array<{
      content?: Array<{ type?: string; text?: string }>;
    }>;
  };

  if (typeof data.output_text === "string" && data.output_text.trim()) {
    return data.output_text.trim();
  }

  for (const item of data.output ?? []) {
    for (const content of item.content ?? []) {
      if (content.type === "output_text" && typeof content.text === "string" && content.text.trim()) {
        return content.text.trim();
      }
    }
  }

  return null;
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = supportRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "invalid-request" }, { status: 400 });
  }

  const env = getWebEnv();
  const session = await getSession();
  const lastUserMessage = [...parsed.data.messages].reverse().find((message) => message.role === "user")?.content ?? "support";
  const fallback = buildFallbackReply(parsed.data.path, lastUserMessage);
  const pageContext = getPageContext(parsed.data.path);

  if (!env.openAiApiKey) {
    return NextResponse.json({
      message: `${fallback.message} AI support is not configured yet, so this response is coming from the built-in support guide.`,
      ctaLabel: fallback.ctaLabel,
      ctaHref: fallback.ctaHref
    });
  }

  const systemPrompt = [
    "You are FundedPro Assistant, a polished in-app AI assistant for a proprietary trading firm platform.",
    "Your job is to hold a real conversation, answer follow-up questions naturally, and help users get things done across the site.",
    "Respond with the same kind of clarity, confidence, and natural flow a strong ChatGPT answer would have.",
    "Be warm, polished, intelligent, and genuinely helpful.",
    "Sound like a capable assistant, not a branded support script.",
    "You can help with product understanding, plans, checkout, billing, account access, platform login, Phynic usage, payout readiness, dashboard navigation, and support routing.",
    "You may explain what pages do, what steps users should take next, and what common blockers mean.",
    "Never invent balances, internal status, legal guarantees, or account-specific outcomes you cannot verify.",
    "Do not give financial advice or claim live broker execution.",
    "Prefer direct answers over generic routing.",
    "When the user asks a broad question, give the best practical answer you can instead of deflecting.",
    "Explain things clearly and intelligently, not with filler.",
    "Avoid marketing tone, hype, repetition, and generic reassurance.",
    "When useful, include step-by-step guidance or a short bullet list.",
    "Use bullets only when they improve clarity.",
    "Default to compact paragraphs for normal questions.",
    "For broad or exploratory questions, provide a fuller explanation with useful detail, but avoid waffle.",
    "If the user seems unsure, calmly explain the concept before suggesting next steps.",
    "If there is a likely next action, end with one concrete next step.",
    "Important product facts:",
    "- FundedPro sells challenge accounts.",
    "- Phynic is the internal-only simulated futures platform.",
    "- Trading credentials are separate from the website password.",
    "- Dashboard metrics come from internal demo-trading state.",
    "- Reward requests only apply to funded accounts after eligibility checks.",
    "When helpful, end with a concrete next step.",
    pageContext,
    `Current page: ${parsed.data.path}`,
    `Authenticated: ${session ? "yes" : "no"}`,
    `Role: ${session?.role ?? "guest"}`
  ].join("\n");

  try {
    const client = new OpenAI({ apiKey: env.openAiApiKey });
    const response = await client.responses.create({
      model: "gpt-5",
      reasoning: { effort: "medium" },
      instructions: systemPrompt,
      previous_response_id: parsed.data.previousResponseId ?? null,
      input: parsed.data.previousResponseId
        ? lastUserMessage
        : parsed.data.messages.map((message) => ({
            role: message.role,
            content: [{ type: "input_text", text: message.content }]
          }))
    });
    const reply = extractOutputText(response);

    return NextResponse.json({
      message: reply ?? fallback.message,
      ctaLabel: fallback.ctaLabel,
      ctaHref: fallback.ctaHref,
      responseId: response.id
    });
  } catch {
    return NextResponse.json({
      message: `${fallback.message} The live AI service is temporarily unavailable, so I switched to the built-in support guide.`,
      ctaLabel: fallback.ctaLabel,
      ctaHref: fallback.ctaHref
    });
  }
}
