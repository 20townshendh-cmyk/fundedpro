import { expect, test } from "@playwright/test";

const protectedRoutes = [
  "/dashboard",
  "/dashboard/account",
  "/dashboard/trades"
];

for (const route of protectedRoutes) {
  test(`${route} redirects unauthenticated users to login`, async ({ page }) => {
    await page.goto(route);

    await expect(page).toHaveURL(/\/login/);
    await expect(
      page.getByText("Log in to your FundedPro workspace", { exact: false })
    ).toBeVisible();
  });
}
