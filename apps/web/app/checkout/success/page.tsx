import { redirect } from "next/navigation";
import { Footer, SiteShell, TopNav } from "@fundedpro/ui";
import { getDb } from "@fundedpro/db";
import { getSession } from "../../../lib/auth";
import { getStripeClient } from "../../../lib/stripe";
import { finalizePaidOrder } from "../../../lib/trader";

export default async function CheckoutSuccessPage({
  searchParams
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  const { session_id: sessionId } = await searchParams;
  const stripe = getStripeClient();

  if (sessionId && stripe) {
    const stripeSession = await stripe.checkout.sessions.retrieve(sessionId);
    const orderId = typeof stripeSession.metadata?.orderId === "string" ? stripeSession.metadata.orderId : null;
    const sessionUserId = typeof stripeSession.metadata?.userId === "string" ? stripeSession.metadata.userId : null;

    if (orderId && sessionUserId === session.userId && stripeSession.payment_status === "paid") {
      await finalizePaidOrder({
        db: getDb(),
        orderId,
        actorUserId: session.userId
      });

      redirect("/dashboard/account?provisioned=1");
    }

    if (orderId && sessionUserId && sessionUserId !== session.userId) {
      redirect("/dashboard/billing?error=checkout-session");
    }
  }

  return (
    <SiteShell>
      <TopNav />
      <main>
        <section className="page-hero">
          <div className="page-hero-inner">
            <p className="eyebrow">Checkout</p>
            <h1 className="page-title">Payment received</h1>
            <p className="page-copy">Your payment is being reconciled with FundedPro. If provisioning does not appear immediately, refresh billing in a moment.</p>
            <div className="button-row">
              <a href="/dashboard/billing" className="dashboard-link">Open billing</a>
              <a href="/dashboard" className="dashboard-link">Open dashboard</a>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </SiteShell>
  );
}
