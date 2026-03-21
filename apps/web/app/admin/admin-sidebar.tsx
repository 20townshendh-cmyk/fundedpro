import { logoutAction } from "../../lib/auth";

type AdminSection =
  | "overview"
  | "billing"
  | "users"
  | "accounts"
  | "challenges"
  | "payouts"
  | "risk"
  | "sync"
  | "audit"
  | "settings"
  | "content";

type AdminSidebarProps = {
  active: AdminSection;
  title: string;
  description: string;
};

const adminLinks: Array<{ id: AdminSection; href: string; label: string }> = [
  { id: "overview", href: "/admin", label: "Overview" },
  { id: "billing", href: "/admin/billing", label: "Billing" },
  { id: "users", href: "/admin/users", label: "Users" },
  { id: "accounts", href: "/admin/accounts", label: "Accounts" },
  { id: "challenges", href: "/admin/challenges", label: "Challenges" },
  { id: "payouts", href: "/admin/payouts", label: "Payouts" },
  { id: "risk", href: "/admin/risk", label: "Risk" },
  { id: "sync", href: "/admin/sync", label: "Sync" },
  { id: "audit", href: "/admin/audit", label: "Audit" },
  { id: "settings", href: "/admin/settings", label: "Settings" },
  { id: "content", href: "/admin/content", label: "Content" }
];

export function AdminSidebar({ active, title, description }: AdminSidebarProps) {
  return (
    <aside className="dashboard-sidebar">
      <div className="sidebar-brand">
        <p className="eyebrow">Admin workspace</p>
        <h2 className="sidebar-title">{title}</h2>
        <p className="surface-copy">{description}</p>
      </div>
      <nav className="sidebar-nav">
        {adminLinks.map((link) => (
          <a key={link.id} className={`sidebar-link${active === link.id ? " active" : ""}`} href={link.href}>
            {link.label}
          </a>
        ))}
        <a className="sidebar-link" href="/dashboard">Trader view</a>
      </nav>
      <form action={logoutAction}>
        <button className="ghost-button" type="submit">
          Log out
        </button>
      </form>
    </aside>
  );
}
