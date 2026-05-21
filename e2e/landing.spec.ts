import { test, expect } from "@playwright/test";

test.describe("landing page", () => {
  test("shows the hero and scoring explainer", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /find the goodwill/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /how the goods score works/i })).toBeVisible();
    // The four scoring factors are explained with weights.
    await expect(page.getByText(/median home value/i).first()).toBeVisible();
    await expect(page.getByText(/40% weight/i)).toBeVisible();
  });

  test("primary CTA launches the app", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /find stores near me/i }).click();
    // /search mirrors its state into the URL (shareable), so allow query params.
    await expect(page).toHaveURL(/\/search(\?|$)/);
  });
});
