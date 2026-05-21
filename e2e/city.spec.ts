import { test, expect } from "@playwright/test";

// The /goodwill hub is static (no upstream API calls), so these are hermetic.
test.describe("local SEO pages", () => {
  test("the city hub lists cities and links to their pages", async ({ page }) => {
    await page.goto("/goodwill");
    await expect(page.getByRole("heading", { name: /goodwill stores by city/i })).toBeVisible();
    const sd = page.getByRole("link", { name: /san diego, ca/i });
    await expect(sd).toBeVisible();
    await expect(sd).toHaveAttribute("href", "/goodwill/san-diego-ca");
  });

  test("the landing page links into the city hub", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: /^all cities$/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /san diego, ca/i }).first()).toHaveAttribute(
      "href",
      "/goodwill/san-diego-ca",
    );
  });
});
