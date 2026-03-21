"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type AssistantMessage = {
  id: string;
  role: "assistant" | "user";
  content: string;
};

type AssistantAction = {
  label: string;
  href: string;
} | null;

function getQuickPrompts(pathname: string) {
  if (pathname.startsWith("/challenges")) {
    return [
      "Which challenge fits me best?",
      "Explain the plan differences",
      "What rules matter most before buying?"
    ];
  }

  if (pathname.startsWith("/payouts")) {
    return [
      "How does payout eligibility work?",
      "What usually blocks a payout?",
      "What happens after I submit a request?"
    ];
  }

  if (pathname.startsWith("/dashboard")) {
    return [
      "What should I do next here?",
      "Help me find the right page",
      "Explain this dashboard area"
    ];
  }

  return [
    "Explain the challenge models",
    "How does checkout work?",
    "How do I start trading?"
  ];
}

export function SupportAssistant() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [previousResponseId, setPreviousResponseId] = useState<string | null>(null);
  const [action, setAction] = useState<AssistantAction>({
    label: "Open support",
    href: "/dashboard/support"
  });
  const [messages, setMessages] = useState<AssistantMessage[]>([
    {
      id: "assistant-welcome",
      role: "assistant",
      content: "Hi. I can help with plans, checkout, credentials, trading, payouts, and account questions. What do you want help with?"
    }
  ]);
  const hasAutoOpenedRef = useRef(false);
  const threadRef = useRef<HTMLDivElement | null>(null);
  const pathname = typeof window === "undefined" ? "/" : window.location.pathname;
  const quickPrompts = useMemo(() => getQuickPrompts(pathname), [pathname]);

  async function submitPrompt(prompt: string) {
    const content = prompt.trim();

    if (!content || isPending) {
      return;
    }

    const nextUserMessage: AssistantMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content
    };
    const nextMessages = [...messages, nextUserMessage];

    setMessages(nextMessages);
    setQuery("");
    setIsPending(true);

    try {
      const response = await fetch("/api/support-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: `${window.location.pathname}${window.location.search}`,
          previousResponseId,
          messages: nextMessages.map((message) => ({
            role: message.role,
            content: message.content
          }))
        })
      });
      const payload = (await response.json()) as {
        message?: string;
        ctaLabel?: string;
        ctaHref?: string;
        responseId?: string;
      };

      setMessages((current) => [
        ...current,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: payload.message?.trim() || "I can help with this. Ask a more specific question and I’ll walk you through it."
        }
      ]);
      setPreviousResponseId(payload.responseId ?? null);
      setAction(payload.ctaLabel && payload.ctaHref ? { label: payload.ctaLabel, href: payload.ctaHref } : null);
    } catch {
      setMessages((current) => [
        ...current,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: "I couldn't reach the assistant just now. Try again in a moment, or open support for a manual review path."
        }
      ]);
      setPreviousResponseId(null);
      setAction({ label: "Open support", href: "/dashboard/support" });
    } finally {
      setIsPending(false);
    }
  }

  function resetConversation() {
    setMessages([
      {
        id: "assistant-reset",
        role: "assistant",
        content: "New chat started. Ask me anything about FundedPro."
      }
    ]);
    setPreviousResponseId(null);
    setAction({ label: "Open support", href: "/dashboard/support" });
    setQuery("");
  }

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isPending]);

  useEffect(() => {
    if (hasAutoOpenedRef.current || typeof window === "undefined") {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const assistantPrompt = params.get("assistant");

    if (!assistantPrompt) {
      return;
    }

    hasAutoOpenedRef.current = true;
    setOpen(true);
    void submitPrompt(assistantPrompt);
    params.delete("assistant");
    const nextSearch = params.toString();
    const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ""}${window.location.hash}`;
    window.history.replaceState({}, "", nextUrl);
  }, []);

  return (
    <div className={`support-assistant${open ? " open" : ""}`}>
      {open ? (
        <section className="support-assistant-panel" aria-label="AI assistance">
          <div className="support-assistant-head">
            <div className="support-assistant-head-copy">
              <span className="support-assistant-kicker">AI assistance</span>
              <strong>FundedPro Assistant</strong>
            </div>
            <div className="support-assistant-head-actions">
              <button type="button" className="support-assistant-reset" onClick={resetConversation}>New</button>
              <button type="button" className="support-assistant-close" onClick={() => setOpen(false)} aria-label="Close support assistant">×</button>
            </div>
          </div>

          {!messages.some((message) => message.role === "user") ? (
            <div className="support-assistant-quick">
              {quickPrompts.map((prompt) => (
                <button key={prompt} type="button" className="support-assistant-chip" onClick={() => void submitPrompt(prompt)}>
                  {prompt}
                </button>
              ))}
            </div>
          ) : null}

          <div ref={threadRef} className="support-assistant-thread">
            {messages.map((message) => (
              <div key={message.id} className={`support-assistant-message ${message.role}`}>
                <div className="support-assistant-bubble">{message.content}</div>
              </div>
            ))}
            {isPending ? (
              <div className="support-assistant-message assistant">
                <div className="support-assistant-bubble support-assistant-bubble-pending">Thinking...</div>
              </div>
            ) : null}
          </div>

          <form
            className="support-assistant-form"
            onSubmit={(event) => {
              event.preventDefault();
              void submitPrompt(query);
            }}
          >
            <textarea
              className="support-assistant-input"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Message FundedPro Assistant"
              aria-label="Ask the support assistant"
              rows={1}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void submitPrompt(query);
                }
              }}
            />
            <button type="submit" className="support-assistant-submit" disabled={isPending}>Send</button>
          </form>

          {action ? (
            <div className="support-assistant-foot">
              <a href={action.href} className="support-assistant-link">{action.label}</a>
            </div>
          ) : null}
        </section>
      ) : null}

      <button
        type="button"
        className="support-assistant-trigger"
        onClick={() => setOpen((current) => !current)}
        aria-label="Open AI support assistant"
      >
        <span className="support-assistant-trigger-icon" aria-hidden="true">
          <span />
          <span />
        </span>
      </button>
    </div>
  );
}
