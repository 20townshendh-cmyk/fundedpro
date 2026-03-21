import { expect, test } from "@playwright/test";
import { authenticateAsUser, breachedTraderSeed, traderSeed } from "./auth-helpers";

test("trade now shows the terminal login gate without the terminal access cookie", async ({ page }) => {
  await authenticateAsUser(page, traderSeed);
  await page.goto(`/dashboard/trades?accountId=${traderSeed.tradingAccountId}`);

  await expect(page.getByText("Use the trading login and password", { exact: false })).toBeVisible();
  await expect(page.getByRole("button", { name: "Login" })).toBeVisible();
});

test("active trader can switch layouts, symbols, and blotter tabs in Trade Now", async ({ page }) => {
  await authenticateAsUser(page, {
    ...traderSeed,
    terminalAccountId: traderSeed.tradingAccountId
  });

  await page.goto(`/dashboard/trades?accountId=${traderSeed.tradingAccountId}`);

  await expect(page.getByText("Account Details", { exact: false })).toBeVisible();
  await page.getByRole("link", { name: "Split ES/NQ" }).click();
  await expect(page).toHaveURL(/layout=split/);

  await page.getByRole("link", { name: /^NQ6$/ }).click();
  await expect(page).toHaveURL(/symbol=NQ/);

  await page.getByRole("link", { name: "Orders" }).click();
  await expect(page).toHaveURL(/tab=orders/);
  await expect(page.getByText("No orders yet.", { exact: false })).toBeVisible();

  await page.getByRole("link", { name: "History" }).click();
  await expect(page).toHaveURL(/tab=history/);
  await expect(page.getByText("No history yet.", { exact: false })).toBeVisible();
});

test("breached trader sees trade entry locked and no switchable linked accounts", async ({ page }) => {
  await authenticateAsUser(page, {
    ...breachedTraderSeed,
    terminalAccountId: breachedTraderSeed.tradingAccountId
  });

  await page.goto(`/dashboard/trades?accountId=${breachedTraderSeed.tradingAccountId}`);

  await expect(page.getByText("Account breached", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "BUY" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "SELL" })).toBeDisabled();

  await page.getByRole("button", { name: "Accounts" }).click();
  await expect(page.getByText("No linked accounts", { exact: false })).toBeVisible();
});
