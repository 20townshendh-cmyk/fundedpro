import { redirect } from "next/navigation";
import { getDb } from "@fundedpro/db";
import { Footer, SiteShell, TopNav } from "@fundedpro/ui";
import { ProfessionalCertificate } from "../../../components/professional-certificate";
import { getSession } from "../../../../lib/auth";

export const dynamic = "force-dynamic";

type PayoutCertificatePageProps = {
  searchParams: Promise<{ payoutId?: string }>;
};

function formatUsd(cents: number) {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export default async function PayoutCertificatePage({ searchParams }: PayoutCertificatePageProps) {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  const { payoutId } = await searchParams;

  if (!payoutId) {
    redirect("/dashboard/payouts");
  }

  const db = getDb();
  const result = await db.query<{
    fullName: string;
    login: string;
    amountCents: number;
    status: string;
    createdAt: Date;
  }>(
    `
      SELECT u."fullName", ta."login", pr."amountCents", pr."status", pr."createdAt"
      FROM "PayoutRequest" pr
      JOIN "User" u ON u."id" = pr."userId"
      JOIN "TradingAccount" ta ON ta."id" = pr."tradingAccountId"
      WHERE pr."id" = $1 AND pr."userId" = $2
      LIMIT 1
    `,
    [payoutId, session.userId]
  );

  const payout = result.rows[0];

  if (!payout || !["APPROVED", "PAID"].includes(payout.status)) {
    redirect("/dashboard/payouts");
  }

  return (
    <SiteShell>
      <TopNav />
      <main className="certificate-page">
        <ProfessionalCertificate
          eyebrow="Reward Certificate"
          title="Payout Achievement Certificate"
          recipientName={payout.fullName}
          detailLine={`In recognition of an approved ${formatUsd(payout.amountCents)} reward request linked to account #${payout.login}.`}
          issuedOn={payout.createdAt.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
          reference={`PAY-${payout.login}-${String(payout.amountCents)}`}
          accent={payout.status === "PAID" ? "Paid" : "Approved"}
          summary="has achieved a FundedPro reward milestone and completed the internal review standard required for payout recognition."
          amountHighlight={formatUsd(payout.amountCents)}
          approvalSignature="Approved by FundedPro"
        />
      </main>
      <Footer />
    </SiteShell>
  );
}
