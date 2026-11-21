import { expect, test } from './test';

const path = "/search?lat=32.84&lon=-117.27&radius=8&brands=goodwill&label=San%20Diego";

test.describe("live Google provider acceptance", () => {
  test.skip(process.env.THRIFTLY_REAL_GOOGLE_MAPS !== "1", "Run with THRIFTLY_REAL_GOOGLE_MAPS=1 and a real Maps configuration");

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

});
