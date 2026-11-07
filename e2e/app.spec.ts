import { test, expect } from "@playwright/test";
import { firstStore, googleDetailsFor, gotoClientSearch, mockStoreDetails, storesResponse, photonReverseResponse } from "./fixtures";
import { mockGoogleMaps } from "./google-maps-fixture";

test.beforeEach(async ({ page }) => {
  await mockGoogleMaps(page);
  await mockStoreDetails(page, { unavailable: true });
  await page.route("**/api/stores**", (route) => route.fulfill({ json: storesResponse }));
  await page.route("**/api/enrich**", (route) => route.fulfill({ json: { enriched: {} } }));
  // Geocoding runs client-side against Photon (the user's own IP). Stub the
  // reverse call ("near {place}" label) and the typeahead/geocode endpoint.
  // Regex (not glob) so the cross-origin URL + query string matches reliably.
  await page.route(/photon\.komoot\.io\/reverse/, (route) =>
    route.fulfill({ json: photonReverseResponse }),
  );
  await page.route(/photon\.komoot\.io\/api/, (route) => route.fulfill({ json: { features: [] } }));
});

test("ranks stores and crowns the best find", async ({ page }) => {
  await page.goto("/search");
  await expect(page.getByRole("button", { name: /visit score 89.*show score details/i })).toBeVisible();
  await expect(page.getByText(/highest score/i)).toBeVisible();
  await expect(page.locator("[data-store-address]", { hasText: "La Jolla" })).toBeVisible();
  await expect(page.locator("[data-store-address]", { hasText: "Pacific Beach" })).toBeVisible();
});

test("a card exposes actions when expanded", async ({ page }) => {
  await page.goto("/search");
  const best = page.locator('[data-store-card]', { hasText: "La Jolla" }).first();
  await best.locator("[data-store-toggle]").click();
  await expect(best.getByRole("link", { name: /directions/i })).toBeVisible();
  await expect(best.getByRole("link", { name: /sdgoodwill|website/i }))
    .toHaveAttribute("href", new URL(firstStore.website).href);
});

test("clicking an expanded card collapses it", async ({ page }) => {
  await page.goto("/search");
  const card = page.locator('[data-store-card]', { hasText: "La Jolla" }).first();
  await card.locator("[data-store-toggle]").click();
  await expect(card.getByRole("link", { name: /directions/i })).toBeVisible();
  await card.locator("[data-store-toggle]").click();
  await expect(card.getByRole("link", { name: /sdgoodwill|website/i })).toHaveCount(0);
  await expect(card.getByRole("link", { name: /directions/i })).toBeVisible();
});

test("shows the reverse-geocoded search area", async ({ page }) => {
  await page.goto("/search");
  await expect(page.getByText(/near San Diego, CA/i)).toBeVisible();
});

test("selecting a non-top card expands its actions", async ({ page }) => {
  await page.goto("/search");
  const card = page.locator('[data-store-card]', { hasText: "Pacific Beach" }).first();
  await expect(card.getByRole("link", { name: /sdgoodwill|website/i })).toHaveCount(0);
  await card.locator("[data-store-toggle]").click();
  await expect(card.getByRole("link", { name: /sdgoodwill|website/i })).toBeVisible();
  await expect(card.getByRole("link", { name: /directions/i })).toBeVisible();
});

test("filters are reachable", async ({ page }) => {
  await page.goto("/search");
  // Filters start collapsed (desktop) / in a sheet (mobile); both open via the button.
  await page.getByRole("button", { name: /^filters$/i }).click();
  await expect(page.getByText(/search radius/i)).toBeVisible();
});

test("the sort control shows its label at rest, not the raw value", async ({ page }) => {
  await page.goto("/search");
  await page.getByRole("button", { name: /^filters$/i }).click();
  // The trigger must read "Visit score" (the label), never the "score" slug.
  await expect(page.getByRole("combobox", { name: "Sort by" })).toContainText("Visit score");
});

test("search mounts one map and one SDK instance", async ({ page, isMobile }) => {
  await page.goto("/search");
  if (isMobile) {
    await expect(page.locator("[data-google-map]")).toHaveCount(0);
    await page.getByRole("tab", { name: "Map", exact: true }).click();
  }
  await expect(page.locator("[data-google-map][data-state=ready]")).toHaveCount(1);
  await expect(page.locator("[data-google-map-canvas]")).toBeVisible();
  await expect(page.locator("[data-fixture-map-interaction]")).toHaveCount(1);
});

test("mobile exposes list and map tabs", async ({ page, isMobile }) => {
  test.skip(!isMobile, "mobile layout only");
  await page.goto("/search");
  await expect(page.getByRole("tab", { name: /list/i })).toBeVisible();
  await expect(page.getByRole("tab", { name: /map/i })).toBeVisible();
});

test('restores a shared search location and radius', async ({page}) => {
  const search = page.waitForRequest(r => r.url().includes('/api/stores?lat=40.71&lon=-74.01&radius=10'));
  await gotoClientSearch(page, '/search?lat=40.71&lon=-74.01&radius=10&label=New%20York');
  await search;
  await expect(page).toHaveURL(/lat=40.71000.*lon=-74.01000.*radius=10/);
});

test('shows store addresses while neighborhood enrichment is unavailable', async ({page}) => {
  await page.route('**/api/enrich**', () => new Promise(() => {}));
  await page.goto('/search');
  await expect(page.locator('[data-store-card]').first()).toBeVisible();
  await expect(page.getByText('7631 Girard Avenue, La Jolla, CA', {exact:true}).first()).toBeVisible();
});


test('keyboard activation of a store action does not collapse its details', async ({page}) => {
  await page.context().route("https://www.google.com/maps/dir/**", route =>
    route.fulfill({ contentType: "text/html", body: "Directions fixture" }));
  await page.goto('/search');
  const card = page.locator('[data-store-card]', {hasText:'La Jolla'}).first();
  await card.locator('[data-store-toggle]').focus();
  await page.keyboard.press('Enter');
  const directions = card.getByRole('link',{name:/directions/i});
  await directions.focus();
  const popupPromise = page.waitForEvent('popup');
  await page.keyboard.press('Enter');
  const popup = await popupPromise; await popup.close();
  await expect(card.locator('[data-store-toggle]')).toHaveAttribute('aria-expanded','true');
});
test('shared filters survive hydration and can be cleared from an empty result', async ({page}) => {
  await gotoClientSearch(page, '/search?lat=32.84&lon=-117.27&minScore=100&sort=distance');
  await expect(page.getByText('No stores match these filters')).toBeVisible();
  await page.getByRole('button',{name:'Reset filters', exact:true}).first().click();
  await expect(page.locator('[data-store-address]',{hasText:'La Jolla'})).toBeVisible();
  await expect(page).not.toHaveURL(/minScore=100/);
});
test('highest-score badge follows the score when sorting by distance', async ({page}) => {
  const sorted = structuredClone(storesResponse);
  sorted.stores[0].distanceMiles = 5;
  sorted.stores[1].distanceMiles = 1;
  await page.route('**/api/stores**',r=>r.fulfill({json:sorted}));
  await gotoClientSearch(page, '/search?lat=32.84&lon=-117.27&sort=distance');
  await expect(page.locator('[data-store-card]').first()).toContainText('Pacific Beach');
  await expect(page.locator('[data-store-card]',{hasText:'La Jolla'})).toContainText('Highest score');
  await expect(page.locator('[data-store-card]').first()).not.toContainText('Highest score');
});
test('unknown hours cannot silently hide the entire result set', async ({page}) => {
  const unknown = structuredClone(storesResponse);
  for(const store of unknown.stores) store.openingHours = '';
  await page.route('**/api/stores**',r=>r.fulfill({json:unknown}));
  await page.goto('/search');
  await page.getByRole('button',{name:/^filters$/i}).click();
  await expect(page.getByRole('switch')).toBeDisabled();
  await expect(page.getByText(/hours are unavailable/i)).toBeVisible();
});


test("map markers open a keyboard-accessible store and score breakdown", async ({ page, isMobile }) => {
  await gotoClientSearch(page, "/search?lat=32.84&lon=-117.27&radius=8");
  if (isMobile) await page.getByRole("tab", { name: "Map", exact: true }).click();
  const map = page.locator("[data-google-map][data-state=ready]");
  const marker = map.getByRole("button", { name: /Goodwill.*Girard.*Visit score 89/i });
  await expect(marker).toBeVisible();
  expect((await marker.boundingBox())!.width).toBeGreaterThanOrEqual(44);
  expect((await marker.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await expect(map.getByRole("button", { name: "", exact: true })).toHaveCount(0);
  await marker.press("Enter");
  const popup = map.getByRole("dialog", { name: "Goodwill", exact: true });
  await expect(popup).toBeVisible();
  await expect(popup.getByRole("link", { name: "Directions", exact: true }))
    .toHaveAttribute("href", /^https:\/\/www\.google\.com\/maps\/dir\//);
  const details = popup.getByRole("button", { name: /show score details/i });
  await details.click();
  const breakdown = page.getByRole("dialog", { name: "Visit score", exact: true }).and(page.locator("[data-open]"));
  await breakdown.locator("summary").filter({ hasText: "Neighborhood signal" }).click();
  await expect(page.getByText("Median household income", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByText("Median household income", { exact: true })).toBeHidden();
  await expect(popup).toBeVisible();
  await popup.getByRole("button", { name: "Close", exact: true }).click();
  await expect(popup).toBeHidden();
  await expect(marker).toBeFocused();
});

test("switching between mobile list and map reuses a fetched place", async ({ page, isMobile }) => {
  test.skip(!isMobile, "mobile layout only");
  const requests: string[] = [];
  await mockStoreDetails(page, { onRequest: id => requests.push(id) });
  await gotoClientSearch(page, "/search?lat=32.84&lon=-117.27&radius=8");
  const first = page.locator("[data-store-card]").first();
  await expect(first.locator("[data-google-rating][data-state=loaded]")).toBeVisible();
  for (let attempt = 0; attempt < 2; attempt++) {
    await page.getByRole("tab", { name: "Map", exact: true }).click();
    const map = page.locator("[data-google-map][data-state=ready]");
    await expect(map).toHaveCount(1);
    await map.getByRole("button", { name: /Goodwill.*Girard.*Visit score/i }).press("Enter");
    await expect(map.getByRole("dialog").locator("[data-google-rating][data-state=loaded]")).toBeVisible();
    await page.getByRole("tab", { name: "List", exact: true }).click();
    await expect(page.locator("[data-google-map]")).toHaveCount(0);
    await expect(first.locator("[data-google-rating][data-state=loaded]")).toBeVisible();
  }
  expect(requests.filter(id => id === firstStore.id)).toHaveLength(1);
});

test("the rated store uses the same score in the card, map and breakdown", async ({ page, isMobile }) => {
  await mockStoreDetails(page, { details: store => ({
    ...googleDetailsFor(store),
    ...(store.id === firstStore.id ? { rating: 5, ratingCount: 450 } : {}),
  }) });
  await gotoClientSearch(page, "/search?lat=32.84&lon=-117.27&radius=8");
  const card = page.locator("[data-store-card]").filter({ hasText: "Girard Avenue" });
  const cardScore = card.getByRole("button", { name: /visit score 94 out of 100.*show score details/i });
  await expect(cardScore).toBeVisible();
  await cardScore.click();
  const breakdown = page.getByRole("dialog", { name: "Visit score", exact: true }).and(page.locator("[data-open]"));
  await expect(breakdown.locator("[data-score-total]")).toHaveAttribute("data-score-total", "94");
  await page.keyboard.press("Escape");
  await expect(breakdown).toHaveCount(0);

  if (isMobile) await page.getByRole("tab", { name: "Map", exact: true }).click();
  const map = page.locator("[data-google-map][data-state=ready]");
  const pin = map.getByRole("button", { name: /Goodwill.*Girard.*Visit score 94 out of 100/i });
  await expect(pin).toHaveText("94");
  await pin.press("Enter");
  const popup = map.getByRole("dialog");
  await popup.getByRole("button", { name: /visit score 94 out of 100.*show score details/i }).click();
  await expect(breakdown.locator("[data-score-total]")).toHaveAttribute("data-score-total", "94");
  const google = breakdown.locator("[data-score-component=googleRatings]");
  await expect(google.getByRole("rowheader")).toContainText("5/5 · 450");
  await expect(google.getByRole("cell", { name: "45%", exact: true })).toBeVisible();
  await expect(google.getByRole("cell", { name: "45", exact: true })).toBeVisible();
});
