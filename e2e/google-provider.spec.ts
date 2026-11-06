import { expect, test } from "@playwright/test";

const path = "/search?lat=32.84&lon=-117.27&radius=8&brands=goodwill&label=San%20Diego";

test.describe("live Google provider acceptance", () => {
  test.skip(process.env.THRIFTLY_REAL_GOOGLE_MAPS !== "1", "Run with THRIFTLY_REAL_GOOGLE_MAPS=1 and real Maps and Places configuration");

  test("a coordinate search renders a live attributed rating without JavaScript", async ({ browser, baseURL }) => {
    const context = await browser.newContext({ baseURL, javaScriptEnabled: false, ignoreHTTPSErrors: true });
    try {
      const page = await context.newPage();
      const response = await page.goto(path);
      expect(response?.ok()).toBe(true);
      expect(response?.headers()["cache-control"]).toMatch(/no-store/);
      const rating = page.getByRole("link", { name: /Google rating: .* out of 5/i }).first();
      await expect(rating).toBeVisible();
      await expect(rating.getByText("Google Maps", { exact: true })).toBeVisible();
    } finally {
      await context.close();
    }
  });

  test("search draws a Google tile and native attribution", async ({ page, isMobile }) => {
    test.setTimeout(60_000);
    const tile = page.waitForResponse(response => {
      const url = new URL(response.url());
      return response.ok() && /(?:^|\.)(?:googleapis|google)\.com$/.test(url.hostname)
        && /\/(?:maps\/)?vt$/.test(url.pathname)
        && response.headers()["content-type"]?.startsWith("image/");
    });
    await page.goto(path);
    if (isMobile) await page.getByRole("tab", { name: "Map", exact: true }).click();
    await tile;
    const map = page.locator("[data-google-map][data-state=ready]");
    await expect(map).toHaveCount(1);
    await expect(map.locator('img[alt="Google"], a[aria-label^="Open this area in Google Maps"]').first()).toBeVisible();
    await expect(map.locator("button.gw-pin:visible").first()).toBeVisible();
  });

  test("matched store details return a live Google rating and attributed link", async ({ page }) => {
    test.setTimeout(60_000);
    const detail = page.waitForResponse(response => new URL(response.url()).pathname === "/api/store-details" && response.ok());
    await page.goto(path);
    const response = await detail;
    expect(response.headers()["cache-control"]).toMatch(/no-store/);
    expect((await response.json()).google.placeId).toMatch(/^[\w-]{6,512}$/);
    const rating = page.getByRole("link", { name: /Google rating: .* out of 5/i }).first();
    await expect(rating).toBeVisible({ timeout: 15_000 });
    await expect(rating).toHaveAttribute("href", /^https:\/\/(?:www\.|maps\.)?google\.com\/|^https:\/\/maps\.app\.goo\.gl\//);
    await expect(rating.getByText("Google Maps", { exact: true })).toBeVisible();
  });
});
