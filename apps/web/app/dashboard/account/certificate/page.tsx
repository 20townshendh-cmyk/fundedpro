import { redirect } from "next/navigation";
import { getDb } from "@fundedpro/db";
import { Footer, SiteShell, TopNav } from "@fundedpro/ui";
import { ProfessionalCertificate } from "../../../components/professional-certificate";
import { getSession } from "../../../../lib/auth";

export const dynamic = "force-dynamic";

type AccountCertificatePageProps = {
  searchParams: Promise<{ accountId?: string }>;
};

export default async function AccountCertificatePage({ searchParams }: AccountCertificatePageProps) {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  const { accountId } = await searchParams;

  if (!accountId) {
    redirect("/dashboard/account");
  }

  const db = getDb();
  const result = await db.query<{
    fullName: string;
    login: string;
    accountState: string;
    fundedAt: Date | null;
    passedAt: Date | null;
    startingBalance: string;
  }>(
    `
      SELECT u."fullName", ta."login", ta."accountState", ta."fundedAt", ta."passedAt", ta."startingBalance"
      FROM "TradingAccount" ta
      JOIN "User" u ON u."id" = ta."userId"
      WHERE ta."id" = $1 AND ta."userId" = $2
      LIMIT 1
    `,
    [accountId, session.userId]
  );

  const account = result.rows[0];

  if (!account || !["PASSED", "FUNDED"].includes(account.accountState)) {
    redirect("/dashboard/account");
  }

  const issuedAt = account.fundedAt ?? account.passedAt ?? new Date();

  return (
    <SiteShell>
      <TopNav />
      <main className="certificate-page">
        <ProfessionalCertificate
          eyebrow={account.accountState === "FUNDED" ? "Funded Achievement" : "Challenge Pass"}
          title={account.accountState === "FUNDED" ? "Funded Account Certificate" : "Challenge Completion Certificate"}
          recipientName={account.fullName}
          detailLine={`For successfully advancing account #${account.login} at ${Number(account.startingBalance).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })} in simulated capital.`}
          issuedOn={issuedAt.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
          reference={`ACC-${account.login}`}
          accent={account.accountState === "FUNDED" ? "Funded" : "Passed"}
          summary={account.accountState === "FUNDED"
            ? "has met the required performance and review standards to reach funded status within the FundedPro challenge structure."
            : "has met the required performance standards to successfully complete the FundedPro challenge process."}
        />
      </main>
      <Footer />
    </SiteShell>
  );
}
