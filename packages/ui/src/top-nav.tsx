"use client";

import { useState } from "react";

function LogoMark() {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" aria-hidden="true">
      <defs>
        <linearGradient id="fundedpro-mark" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#143628" />
          <stop offset="100%" stopColor="#0b2118" />
        </linearGradient>
        <linearGradient id="fundedpro-leaves" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#d8fff1" />
          <stop offset="55%" stopColor="#7cf3b4" />
          <stop offset="100%" stopColor="#22c55e" />
        </linearGradient>
        <linearGradient id="fundedpro-trunk" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#f4d6b0" />
          <stop offset="100%" stopColor="#9a5b2d" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="38" height="38" rx="12" fill="url(#fundedpro-mark)" />
      <circle cx="15" cy="16" r="5.5" fill="url(#fundedpro-leaves)" />
      <circle cx="22" cy="13.5" r="6.5" fill="url(#fundedpro-leaves)" />
      <circle cx="27" cy="18" r="5" fill="url(#fundedpro-leaves)" />
      <circle cx="20" cy="20" r="7.2" fill="url(#fundedpro-leaves)" />
      <circle cx="13.5" cy="21" r="4.2" fill="url(#fundedpro-leaves)" opacity="0.95" />
      <rect x="17" y="21" width="6" height="10" rx="3" fill="url(#fundedpro-trunk)" />
      <path d="M16 31c1.2-2.8 2.5-4.2 4-4.2s2.8 1.4 4 4.2h-2.7c-.6-1.3-.9-2-1.3-2s-.7.7-1.3 2Z" fill="#6b3f1f" />
    </svg>
  );
}

const navItems = [
  { href: "/", label: "Home" },
  { href: "/why-fundedpro", label: "About" },
  { href: "/how-it-works", label: "How It Works" },
  { href: "/challenges", label: "Challenges" },
  { href: "/payouts", label: "Payouts" },
  { href: "/dashboard", label: "Trader Area" }
] as const;

const actionItems = [
  { href: "/login", label: "Login" },
  { href: "/signup", label: "Sign Up" }
] as const;

export function TopNav() {
  const [isOpen, setIsOpen] = useState(false);

  const closeMenu = () => setIsOpen(false);

  return (
    <header className={`top-nav-shell${isOpen ? " menu-open" : ""}`}>
      <div className="top-nav">
        <a href="/" className="brand-link" onClick={closeMenu}>
          <LogoMark />
          <span className="brand-copy">
            <span className="brand-text">FundedPro</span>
            <span className="mobile-build-badge" aria-label="Mobile build marker">
              m-e24831e
            </span>
          </span>
        </a>

        <button
          type="button"
          className="nav-toggle"
          aria-expanded={isOpen}
          aria-controls="site-navigation"
          aria-label={isOpen ? "Close navigation menu" : "Open navigation menu"}
          onClick={() => setIsOpen((current) => !current)}
        >
          <span className="nav-toggle-label">{isOpen ? "Close" : "Menu"}</span>
          <span className="nav-toggle-icon" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
        </button>

        <nav className="nav-links nav-links-desktop">
          {navItems.map((item) => (
            <a key={item.href} href={item.href}>
              {item.label}
            </a>
          ))}
        </nav>

        <div className="nav-actions nav-actions-desktop">
          {actionItems.map((item) => (
            <a key={item.href} href={item.href} className="nav-action-link">
              {item.label}
            </a>
          ))}
        </div>
      </div>

      {isOpen ? (
        <div className="top-nav-panel mobile-nav-drawer">
          <nav id="site-navigation" className="nav-links nav-links-mobile mobile-nav-links">
            {navItems.map((item) => (
              <a key={item.href} href={item.href} onClick={closeMenu}>
                {item.label}
              </a>
            ))}
          </nav>

          <div className="nav-actions nav-actions-mobile mobile-nav-actions">
            {actionItems.map((item) => (
              <a key={item.href} href={item.href} className="nav-action-link" onClick={closeMenu}>
                {item.label}
              </a>
            ))}
          </div>
        </div>
      ) : null}
    </header>
  );
}

export function FooterLogo() {
  return (
    <div className="brand-link" style={{ marginBottom: "12px" }}>
      <LogoMark />
      <span className="brand-text">FundedPro</span>
    </div>
  );
}
