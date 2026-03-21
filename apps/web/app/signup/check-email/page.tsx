import { resendVerificationEmailAction } from "../../../lib/auth";
import { SiteShell } from "@fundedpro/ui";

type CheckEmailPageProps = {
  searchParams: Promise<{ email?: string; resent?: string; error?: string }>;
};

export default async function CheckEmailPage({ searchParams }: CheckEmailPageProps) {
  const { email, resent, error } = await searchParams;

  return (
    <SiteShell>
      <main className="signup-page">
        <section className="signup-shell signup-status-shell">
          <h1 className="signup-title">Check your email</h1>
          {resent ? <p className="signup-success">A fresh verification email is on the way.</p> : null}
          {error ? <p className="signup-error">Enter a valid email address to resend verification.</p> : null}
          <p className="page-copy signup-status-copy">
            We sent you a verification email. Open the link inside it to confirm it was you before signing in.
          </p>
          <form action={resendVerificationEmailAction} className="signup-form">
            <input type="hidden" name="email" value={email ?? ""} />
            <button type="submit" className="signup-submit">Resend verification email</button>
          </form>
          <p className="signup-footer">
            Already verified? <a href="/login">Sign in</a>
          </p>
        </section>
      </main>
    </SiteShell>
  );
}
