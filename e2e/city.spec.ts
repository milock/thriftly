import { test, expect } from "@playwright/test";

// The /goodwill hub and state pages are static (no upstream API calls), so these are hermetic.
test.describe("local SEO hierarchy", () => {
  test("the hub lists states and links to state pages", async ({ page }) => {
    await page.goto("/goodwill");
    await expect(page.getByRole("heading", { name: /goodwill stores by state/i })).toBeVisible();
    const ca = page.getByRole("link", { name: /^california$/i });
    await expect(ca).toBeVisible();
    await expect(ca).toHaveAttribute("href", "/goodwill/state/california");
  });

  test("a state page lists its cities", async ({ page }) => {
    await page.goto("/goodwill/state/california");
    await expect(page.getByRole("heading", { name: /goodwill stores in california/i })).toBeVisible();
    const sd = page.getByRole("link", { name: /^san diego$/i });
    await expect(sd).toBeVisible();
    await expect(sd).toHaveAttribute("href", "/goodwill/san-diego-ca");
  });

  test("the landing page links into the hierarchy", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: /all 50 states/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /san diego, ca/i }).first()).toHaveAttribute(
      "href",
      "/goodwill/san-diego-ca",
    );
  });
});
