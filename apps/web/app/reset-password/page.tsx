import { SiteShell } from "@fundedpro/ui";
import { resetPasswordAction } from "../../lib/auth";

const resetMessages: Record<string, string> = {
  "password-too-short": "Password must be at least 8 characters.",
  "password-mismatch": "Passwords do not match."
};

type ResetPasswordPageProps = {
  searchParams: Promise<{ token?: string; error?: string }>;
};

export default async function ResetPasswordPage({ searchParams }: ResetPasswordPageProps) {
  const { token, error } = await searchParams;

  if (!token) {
    return (
      <SiteShell>
        <main className="signup-page">
          <section className="signup-shell signup-status-shell">
            <h1 className="signup-title">Reset password</h1>
            <p className="signup-error">That reset link is invalid.</p>
          </section>
        </main>
      </SiteShell>
    );
  }

  return (
    <SiteShell>
      <main className="signup-page">
        <section className="signup-shell signup-status-shell">
          <h1 className="signup-title">Choose a new password</h1>
          {error ? <p className="signup-error">{resetMessages[error] ?? "Reset failed."}</p> : null}
          <form action={resetPasswordAction} className="signup-form">
            <input type="hidden" name="token" value={token} />
            <label className="signup-field">
              <span>New password</span>
              <input name="password" type="password" required />
            </label>
            <label className="signup-field">
              <span>Confirm new password</span>
              <input name="confirmPassword" type="password" required />
            </label>
            <button type="submit" className="signup-submit">Reset password</button>
          </form>
        </section>
      </main>
    </SiteShell>
  );
}
