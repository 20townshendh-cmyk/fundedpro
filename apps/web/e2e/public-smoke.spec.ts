import { expect, test } from "@playwright/test";

test("homepage shows the refreshed funding and limit copy", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByText("up to $2M in simulated funds", { exact: false })).toBeVisible();

  await page.getByRole("button", { name: /600K/i }).click();

  await expect(
    page.getByText("only 2 can be $600K accounts", { exact: false })
  ).toBeVisible();
});

test("checkout shows challenge limits and apex note", async ({ page }) => {
  await page.goto("/checkout");

  await expect(
    page.getByText("You can hold up to 5 active challenge accounts at once", { exact: false })
  ).toBeVisible();

  await expect(
    page.getByText("2 active 600K accounts at once", { exact: false })
  ).toBeVisible();
});
