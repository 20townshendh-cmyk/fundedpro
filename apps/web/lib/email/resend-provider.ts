import type { EmailMessage, EmailProvider } from "./types";

export class ResendEmailProvider implements EmailProvider {
  constructor(
    private readonly apiKey: string,
    private readonly fromEmail: string
  ) {}

  async send(message: EmailMessage): Promise<void> {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: this.fromEmail,
        to: [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text
      }),
      cache: "no-store"
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      throw new Error(`Resend request failed with status ${response.status}${errorText ? `: ${errorText}` : ""}`);
    }
  }
}
