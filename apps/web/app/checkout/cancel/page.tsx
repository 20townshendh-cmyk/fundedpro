import { Footer, SiteShell, TopNav } from "@fundedpro/ui";

export default function CheckoutCancelPage() {
  return (
    <SiteShell>
      <TopNav />
      <main>
        <section className="page-hero">
          <div className="page-hero-inner">
            <p className="eyebrow">Checkout</p>
            <h1 className="page-title">Checkout cancelled</h1>
            <p className="page-copy">Your order is still open, so you can return to billing or restart checkout whenever you're ready.</p>
            <div className="button-row">
              <a href="/dashboard/billing" className="dashboard-link">Return to billing</a>
              <a href="/checkout" className="dashboard-link">Browse challenges</a>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </SiteShell>
  );
}
