import type { EmailMessage, EmailProvider } from "./types";

export class MockEmailProvider implements EmailProvider {
  async send(message: EmailMessage): Promise<void> {
    console.info("[fundedpro-email:mock]", JSON.stringify(message, null, 2));
  }
}
