import { expect, test } from "@playwright/test";
import { gotoClientSearch, mockStoreDetails, storesResponse } from "./fixtures";
import { mockGoogleMaps } from "./google-maps-fixture";

const search = "/search?lat=32.84&lon=-117.27&radius=8";

test.beforeEach(async ({ page }) => {
  await mockGoogleMaps(page);
  await mockStoreDetails(page, { unavailable: true });
  await page.route("**/api/stores**", route => route.fulfill({ json: storesResponse }));
  await page.route("**/api/enrich**", route => route.fulfill({ json: { enriched: {} } }));
});

test("keyboard focus previews listing provenance and Escape restores focus", async ({ page }) => {
  await gotoClientSearch(page, search);
  const source = page.locator("[data-store-card]").first().getByRole("button", { name: "Listing source and verification" });
  await source.focus();
  await expect(source).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByText(/^Source retrieved:/)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(source).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByText(/^Source retrieved:/)).toBeHidden();
  await expect(source).toBeFocused();
});

test("click pins a mouse-hover preview after the pointer leaves", async ({ page, isMobile }) => {
  test.skip(isMobile, "mouse hover is a desktop interaction");
  await gotoClientSearch(page, search);
  const source = page.locator("[data-store-card]").first().getByRole("button", { name: "Listing source and verification" });
  await expect(source).toBeVisible();
  await page.clock.install();
  await source.hover();
  await expect(source).toHaveAttribute("aria-expanded", "true");
  await source.click();
  await page.mouse.move(5, 5);
  await page.clock.runFor(450);
  await expect(page.getByText(/^Source retrieved:/)).toBeVisible();
  await source.click();
  await expect(page.getByText(/^Source retrieved:/)).toBeHidden();
});

test("nested visit evidence opens its source and Escape returns to the evidence control", async ({ page }) => {
  await page.goto("/independent-thrift-stores/san-diego-ca");
  const store = page.locator("li[data-store-id]").filter({ hasText: "Father Joe's Villages Hillcrest Thrift Store" });
  const details = store.getByRole("button", { name: "Visit details", exact: true });
  await details.click();
  const evidence = page.getByRole("button", { name: /^Source for / }).first();
  await expect(evidence).toBeVisible();
  await evidence.press("Enter");
  await expect(page.getByText(/Source checked:/)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByText(/Source checked:/)).toBeHidden();
  await expect(details).toHaveAttribute("aria-expanded", "true");
  await expect(evidence).toBeFocused();
});
