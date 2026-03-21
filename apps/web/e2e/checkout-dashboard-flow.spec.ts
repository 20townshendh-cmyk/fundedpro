import { expect, test } from "@playwright/test";
import { authenticateAsUser, cleanupE2eUser, createCheckoutFixtureUser } from "./auth-helpers";

test("authenticated trader can confirm a mock checkout and land on the account dashboard", async ({ page }) => {
  const checkoutUser = await createCheckoutFixtureUser();

  try {
    await authenticateAsUser(page, checkoutUser);

    await page.goto("/checkout");
    await expect(page.getByRole("heading", { name: "Build your funded path" })).toBeVisible();

    await page.goto(`/checkout/mock?orderId=${checkoutUser.orderId}`);

    await expect(page.getByRole("heading", { name: "New challenge" })).toBeVisible();
    await expect(page.getByText("Order state", { exact: false })).toBeVisible();
    await page.getByRole("button", { name: "Confirm mock payment" }).click();

    await expect(page).toHaveURL(/\/dashboard\/account\?provisioned=1/);
    await expect(page.getByText("Trading account provisioned", { exact: false })).toBeVisible();
    await expect(page.getByRole("link", { name: "Trade Now", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: /#FP/i })).toBeVisible();
  } finally {
    await cleanupE2eUser(checkoutUser.userId);
  }
});
