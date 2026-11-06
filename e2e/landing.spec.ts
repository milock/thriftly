import { test, expect } from "@playwright/test";
import { mockStoreDetails } from "./fixtures";
import { mockGoogleMaps } from "./google-maps-fixture";

test.describe("landing page", () => {
  test("shows the hero and scoring explainer", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /find thrift and resale stores near you/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /how the visit score works/i })).toBeVisible();
    // The four scoring factors are explained with weights.
    await expect(page.getByText(/median home value/i).first()).toBeVisible();
    await expect(page.getByText(/40% weight/i)).toBeVisible();
  });

  test("primary CTA launches the app", async ({ page }) => {
    await mockGoogleMaps(page);
    await mockStoreDetails(page, { unavailable: true });
    await page.goto("/");
    await page.locator("section").filter({has: page.getByRole("heading", {name: /find thrift and resale stores near you/i})}).getByRole("link", {name: /find stores near me/i}).click();
    // /search mirrors its state into the URL (shareable), so allow query params.
    await expect(page).toHaveURL(/\/search(\?|$)/);
  });
});
