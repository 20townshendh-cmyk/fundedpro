import { AuthCard, Footer, SiteShell, TopNav } from "@fundedpro/ui";
import { loginAction } from "../../lib/auth";

const loginErrorMessages: Record<string, string> = {
  "invalid-credentials": "Email or password is incorrect.",
  "verify-email": "Verify your email before logging in.",
  "invalid-verification": "That verification link is invalid or expired."
};

type LoginPageProps = {
  searchParams: Promise<{ error?: string; reset?: string; next?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { error, reset, next } = await searchParams;
  const errorMessage = error ? loginErrorMessages[error] ?? "Login failed." : null;

  return (
    <SiteShell>
      <TopNav />
      <main>
        {errorMessage ? (
          <div style={{ width: "min(100%, 580px)", margin: "0 auto 18px", padding: "12px 14px", border: "1px solid rgba(244, 63, 94, 0.28)", borderRadius: "12px", background: "rgba(127, 29, 29, 0.18)", color: "#ffd5dd", textAlign: "center" }}>
            {errorMessage}
          </div>
        ) : null}
        {reset ? (
          <div style={{ width: "min(100%, 580px)", margin: "0 auto 18px", padding: "12px 14px", border: "1px solid rgba(34, 197, 94, 0.28)", borderRadius: "12px", background: "rgba(20, 83, 45, 0.18)", color: "#d7ffe4", textAlign: "center" }}>
            Password reset successfully. You can log in now.
          </div>
        ) : null}
        <AuthCard
          title="Log in to your FundedPro workspace"
          description="Access your trader dashboard, account progress, billing history, and payout workflow from one place."
          action={loginAction}
          {...(next ? { hiddenFields: [{ name: "next", value: next }] } : {})}
          submitLabel="Log in"
          footer={
            <p>
              <a href="/forgot-password">Forgot password?</a><br />
              <a href="/signup/check-email">Resend verification email</a><br />
              <a href="/signup">Create an account</a><br />
              <a href="/api/auth/google">Sign in with Google</a>
            </p>
          }
        />
      </main>
      <Footer />
    </SiteShell>
  );
}
