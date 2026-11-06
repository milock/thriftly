import { expect, test } from "@playwright/test";
import { firstStore, googleDetailsFor, gotoClientSearch, mockStoreDetails, storesResponse } from "./fixtures";
import { googleMapsBootstrap, mockGoogleMaps } from "./google-maps-fixture";

test.beforeEach(async ({ page }) => {
  await page.route("**/api/stores**", route => route.fulfill({ json: storesResponse }));
  await page.route("**/api/enrich**", route => route.fulfill({ json: { enriched: {} } }));
  await page.route(googleMapsBootstrap, route => route.abort("failed"));
});

test("Google rating failure keeps directions and allows a retry", async ({ page }) => {
  await mockStoreDetails(page, { unavailable: true });
  await gotoClientSearch(page, "/search?lat=32.84&lon=-117.27");
  const card = page.locator("[data-store-card]").first();
  const rating = card.locator("[data-google-rating]");
  await expect(rating).toHaveAttribute("data-state", "unavailable");
  await expect(rating.getByText("Rating unavailable", { exact: true })).toBeVisible();
  await expect(card.getByRole("link", { name: "Directions", exact: true })).toBeVisible();

  await mockStoreDetails(page);
  await rating.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(rating).toHaveAttribute("data-state", "loaded");
  await expect(rating.getByRole("link", { name: /Google rating: 4\.6 out of 5.*120/i }))
    .toHaveAttribute("href", googleDetailsFor(firstStore).mapsUrl!);
  await expect(rating.getByText("Google Maps", { exact: true })).toBeVisible();
});

test("zero and missing ratings stay partial while a failed lookup stays usable", async ({ page }) => {
  await mockStoreDetails(page, { details: store => {
    if (store.id === "node/3") return null;
    return { ...googleDetailsFor(store), rating: null, ratingCount: store.id === "node/1" ? 0 : null };
  } });
  await gotoClientSearch(page, "/search?lat=32.84&lon=-117.27");

  const ratedCards = page.locator("[data-store-card]").filter({
    has: page.getByRole("link", { name: "No Google rating yet", exact: true }),
  });
  await expect(ratedCards).toHaveCount(2);
  await expect(ratedCards.getByRole("button", { name: /show score details.*partial score/i })).toHaveCount(2);
  const failedCard = page.locator("[data-store-card]").filter({ hasText: "Clairemont" });
  await expect(failedCard.locator("[data-google-rating]")).toHaveAttribute("data-state", "unavailable");
  await expect(failedCard.getByRole("button", { name: /show score details.*partial score/i })).toBeVisible();
  await expect(failedCard.getByRole("link", { name: "Directions", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: /Google rating: 0 out of 5/i })).toHaveCount(0);
});

test("Google closure status overrides open source hours and removes permanently closed stores", async ({ page, isMobile }) => {
  await mockGoogleMaps(page);
  const source = structuredClone(storesResponse);
  for (const store of source.stores) {
    store.openingHours = "24/7";
    Object.assign(store, { timezone: "America/Los_Angeles" });
  }
  await page.route("**/api/stores**", route => route.fulfill({ json: source }));
  await mockStoreDetails(page, { details: store => ({
    ...googleDetailsFor(store),
    businessStatus: store.id === "node/1" ? "CLOSED_TEMPORARILY" : store.id === "node/3" ? "CLOSED_PERMANENTLY" : "OPERATIONAL",
  }) });

  await gotoClientSearch(page, "/search?lat=32.84&lon=-117.27&radius=8");
  const cards = page.locator("[data-store-card]");
  const temporary = cards.filter({ hasText: "Girard Avenue" });
  await expect(temporary.locator("[data-google-rating]")).toHaveAttribute("data-state", "loaded");
  await expect(temporary.getByText("Closed", { exact: true })).toBeVisible();
  await expect(temporary.getByText("Open now", { exact: true })).toHaveCount(0);
  await expect(cards).toHaveCount(2);
  await expect(cards.filter({ hasText: "Clairemont" })).toHaveCount(0);

  if (isMobile) await page.getByRole("tab", { name: "Map", exact: true }).click();
  const map = page.locator("[data-google-map][data-state=ready]");
  await expect(map.locator("button.gw-pin")).toHaveCount(2);
  await map.getByRole("button", { name: /Goodwill.*Girard/ }).press("Enter");
  await expect(map.getByRole("dialog").getByText("Closed", { exact: true })).toBeVisible();
  await expect(map.getByRole("dialog").getByText("Open now", { exact: true })).toHaveCount(0);
});
