import { expect, test } from "@playwright/test";
import { authenticateAsUser, traderSeed } from "./auth-helpers";

test("authenticated trader can open dashboard overview", async ({ page }) => {
  await authenticateAsUser(page, traderSeed);
  await page.goto("/dashboard");

  await expect(page.locator(".overview-hello")).toBeVisible();
  await expect(page.locator(".overview-actions").getByRole("link", { name: "Trade Now" })).toBeVisible();
  await expect(page.locator(".overview-actions").getByRole("link", { name: "New Challenge" })).toBeVisible();
});

test("authenticated trader can open account detail", async ({ page }) => {
  await authenticateAsUser(page, traderSeed);
  await page.goto(`/dashboard/account?accountId=${traderSeed.tradingAccountId}`);

  await expect(page.getByRole("link", { name: "Buy Challenge" })).toBeVisible();
  await expect(page.getByText("Trading Results Disclaimer", { exact: false })).toBeVisible();
  await expect(page.getByRole("heading", { name: /FP100245/i })).toBeVisible();
});

test("authenticated trader can open Trade Now terminal", async ({ page }) => {
  await authenticateAsUser(page, {
    ...traderSeed,
    terminalAccountId: traderSeed.tradingAccountId
  });

  await page.goto(`/dashboard/trades?accountId=${traderSeed.tradingAccountId}`);

  await expect(page.getByText("Account Details", { exact: false })).toBeVisible();
  await expect(page.getByRole("button", { name: "BUY" })).toBeVisible();
  await expect(page.getByRole("button", { name: "SELL" })).toBeVisible();
  await expect(page.getByText("fundedpro terminal", { exact: false })).toHaveCount(0);
});
