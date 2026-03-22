import { logoutAction } from "../../lib/auth";

type DashboardSidebarProps = {
  active: "overview" | "account" | "history" | "billing" | "payouts" | "support";
  isAdmin?: boolean;
  description?: string;
};

const links = [
  { id: "challenge", href: "/checkout", label: "New Challenge", gold: true },
  { id: "trade", href: "/dashboard/trades", label: "Trade Now" },
  { id: "overview", href: "/dashboard", label: "Overview" },
  { id: "account", href: "/dashboard/account", label: "Account detail" },
  { id: "history", href: "/dashboard/trades?tab=history", label: "Trade history" },
  { id: "billing", href: "/dashboard/billing", label: "Billing" },
  { id: "payouts", href: "/dashboard/payouts", label: "Payouts" },
  { id: "support", href: "/dashboard/support", label: "Support" },
  { id: "switch", href: "/login", label: "Switch account" }
] as const;

type SidebarLink = (typeof links)[number];

function renderLinks(active: DashboardSidebarProps["active"], isAdmin: boolean) {
  return (
    <>
      {links.map((link: SidebarLink) => (
        <a
          key={link.id}
          className={`sidebar-link${"gold" in link ? " sidebar-link-gold" : ""}${active === link.id ? " active" : ""}`}
          href={link.href}
        >
          {link.label}
        </a>
      ))}
      {isAdmin ? <a className="sidebar-link" href="/admin">Admin panel</a> : null}
    </>
  );
}

export function DashboardSidebar({
  active,
  isAdmin = false,
  description = "Use the navigation drawer on mobile to jump between your trader workspace pages."
}: DashboardSidebarProps) {
  return (
    <aside className="dashboard-sidebar">
      <div className="sidebar-brand">
        <p className="eyebrow">Trader workspace</p>
        <h2 className="sidebar-title">FundedPro</h2>
        <p className="surface-copy">{description}</p>
      </div>

      <details className="sidebar-mobile-nav">
        <summary className="sidebar-mobile-toggle">
          <span>Navigation</span>
          <span className="sidebar-mobile-toggle-icon" aria-hidden="true" />
        </summary>
        <div className="sidebar-mobile-panel">
          <nav className="sidebar-nav">{renderLinks(active, isAdmin)}</nav>
          <form action={logoutAction} className="sidebar-mobile-logout">
            <button className="ghost-button" type="submit">Log out</button>
          </form>
        </div>
      </details>

      <nav className="sidebar-nav sidebar-nav-desktop">
        {renderLinks(active, isAdmin)}
      </nav>
      <form action={logoutAction} className="sidebar-logout-desktop">
        <button className="ghost-button" type="submit">Log out</button>
      </form>
    </aside>
  );
}
