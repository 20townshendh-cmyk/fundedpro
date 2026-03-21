import { expect, test } from "@playwright/test";
import { adminSeed, authenticateAsUser, traderSeed } from "./auth-helpers";

test("admin routes redirect unauthenticated users to login", async ({ page }) => {
  await page.goto("/admin");

  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByText("Log in to your FundedPro workspace", { exact: false })).toBeVisible();
});

test("trader session is redirected away from admin routes", async ({ page }) => {
  await authenticateAsUser(page, traderSeed);
  await page.goto("/admin");

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.locator(".overview-hello")).toBeVisible();
});

const adminPages = [
  { href: "/admin", heading: "Run FundedPro with visible controls" },
  { href: "/admin/billing", heading: "Track purchases, invoices, and provisioning" },
  { href: "/admin/accounts", heading: "Monitor linked trading accounts" },
  { href: "/admin/payouts", heading: "Review payout queue and release decisions" },
  { href: "/admin/users", heading: "Recent users and access levels" }
];

for (const adminPage of adminPages) {
  test(`admin can open ${adminPage.href}`, async ({ page }) => {
    await authenticateAsUser(page, adminSeed);
    await page.goto(adminPage.href);

    await expect(page.getByRole("heading", { name: adminPage.heading })).toBeVisible();
    await expect(page.getByRole("link", { name: "Trader view" })).toBeVisible();
  });
}
