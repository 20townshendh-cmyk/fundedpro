import { redirect } from "next/navigation";
import { SiteShell } from "@fundedpro/ui";
import { getDb } from "@fundedpro/db";

const EMAIL_VERIFICATION_WINDOW_MINUTES = 10;

type VerifyEmailPageProps = {
  searchParams: Promise<{ token?: string }>;
};

export default async function VerifyEmailPage({ searchParams }: VerifyEmailPageProps) {
  const { token } = await searchParams;

  if (!token) {
    redirect("/login?error=invalid-verification");
  }

  const db = getDb();
  const tokenResult = await db.query<{ id: string; emailVerificationSentAt: string | null }>(
    `
      SELECT "id", "emailVerificationSentAt"
      FROM "User"
      WHERE "emailVerificationToken" = $1
      LIMIT 1;
    `,
    [token]
  );

  const tokenRow = tokenResult.rows[0];

  if (!tokenRow || !tokenRow.emailVerificationSentAt) {
    redirect("/login?error=invalid-verification");
  }

  const expired =
    Date.now() - new Date(tokenRow.emailVerificationSentAt).getTime() >
    EMAIL_VERIFICATION_WINDOW_MINUTES * 60 * 1000;

  if (expired) {
    await db.query('DELETE FROM "User" WHERE "id" = $1', [tokenRow.id]);
    redirect("/signup?error=verification-expired");
  }

  const result = await db.query<{ id: string; email: string; role: "TRADER" | "ADMIN" }>(
    `
      UPDATE "User"
      SET "emailVerifiedAt" = NOW(),
          "emailVerificationToken" = NULL,
          "updatedAt" = NOW()
      WHERE "emailVerificationToken" = $1
      RETURNING "id", "email", "role";
    `,
    [token]
  );

  if (!result.rowCount) {
    redirect("/login?error=invalid-verification");
  }

  return (
    <SiteShell>
      <main className="signup-page">
        <section className="signup-shell signup-status-shell">
          <h1 className="signup-title">Email verified</h1>
          <p className="page-copy signup-status-copy">
            Your email is confirmed. You can now sign in to your FundedPro account.
          </p>
          <a href="/login" className="ghost-button signup-status-button">Go to sign in</a>
        </section>
      </main>
    </SiteShell>
  );
}
