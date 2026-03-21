import { SiteShell } from "@fundedpro/ui";
import { forgotPasswordAction } from "../../lib/auth";

const forgotPasswordMessages: Record<string, string> = {
  "invalid-email": "Enter a valid email address.",
  "invalid-reset": "That reset link is invalid.",
  "expired-reset": "That reset link has expired. Request a new one."
};

type ForgotPasswordPageProps = {
  searchParams: Promise<{ error?: string; sent?: string }>;
};

export default async function ForgotPasswordPage({ searchParams }: ForgotPasswordPageProps) {
  const { error, sent } = await searchParams;

  return (
    <SiteShell>
      <main className="signup-page">
        <section className="signup-shell signup-status-shell">
          <h1 className="signup-title">Forgot password</h1>
          {sent ? <p className="signup-success">If that email exists, we sent a password reset link.</p> : null}
          {error ? <p className="signup-error">{forgotPasswordMessages[error] ?? "Password reset failed."}</p> : null}
          <form action={forgotPasswordAction} className="signup-form">
            <label className="signup-field">
              <span>Email</span>
              <input name="email" type="email" required />
            </label>
            <button type="submit" className="signup-submit">Send reset email</button>
          </form>
          <p className="signup-footer">
            Remembered it? <a href="/login">Go back to login</a>
          </p>
        </section>
      </main>
    </SiteShell>
  );
}
