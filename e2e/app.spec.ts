import { test, expect } from "@playwright/test";
import { storesResponse, photonReverseResponse } from "./fixtures";

test.beforeEach(async ({ page }) => {
  // Keep CI off community tile infrastructure; real tiles are visually checked
  // once during release verification.
  await page.route('https://tile.openstreetmap.org/**', route => route.fulfill({
    contentType:'image/png',
    body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=','base64')
  }));
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
  await expect(page.getByRole("img", { name: /goods score 89/i })).toBeVisible();
  await expect(page.getByText(/highest score/i)).toBeVisible();
  await expect(page.getByRole("heading", { name: "La Jolla" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Pacific Beach" })).toBeVisible();
});

test("a card exposes actions when expanded", async ({ page }) => {
  await page.goto("/search");
  const best = page.locator('[role="button"]', { hasText: "La Jolla" }).first();
  await best.click();
  await expect(best.getByRole("link", { name: /directions/i })).toBeVisible();
  await expect(best.getByRole("link", { name: /reviews/i })).toBeVisible();
});

test("clicking an expanded card collapses it", async ({ page }) => {
  await page.goto("/search");
  const card = page.locator('[role="button"]', { hasText: "La Jolla" }).first();
  await card.click();
  await expect(card.getByRole("link", { name: /directions/i })).toBeVisible();
  await card.click();
  await expect(card.getByRole("link", { name: /directions/i })).toHaveCount(0);
});

test("shows the reverse-geocoded search area", async ({ page }) => {
  await page.goto("/search");
  await expect(page.getByText(/near San Diego, CA/i)).toBeVisible();
});

test("selecting a non-top card expands its actions", async ({ page }) => {
  await page.goto("/search");
  const card = page.locator('[role="button"]', { hasText: "Pacific Beach" }).first();
  await expect(card.getByRole("link", { name: /directions/i })).toHaveCount(0);
  await card.click();
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
  // The trigger must read "Goods Score" (the label), never the "score" slug.
  await expect(page.getByText("Goods Score", { exact: true })).toBeVisible();
});

test("the map renders", async ({ page, isMobile }) => {
  await page.goto("/search");
  if (isMobile) await page.getByRole("tab", { name: /map/i }).click();
  await expect(page.locator(".leaflet-container").first()).toBeVisible();
  await expect(page.locator('.leaflet-tile-loaded').first()).toBeVisible();
  await expect(page.locator('.leaflet-tile').first()).toHaveAttribute('src', /^https:\/\/tile\.openstreetmap\.org\//);
  await expect(page.locator('.leaflet-control-attribution a', {hasText:'OpenStreetMap'})).toHaveAttribute('href','https://www.openstreetmap.org/copyright');
});

test("mobile exposes list and map tabs", async ({ page, isMobile }) => {
  test.skip(!isMobile, "mobile layout only");
  await page.goto("/search");
  await expect(page.getByRole("tab", { name: /list/i })).toBeVisible();
  await expect(page.getByRole("tab", { name: /map/i })).toBeVisible();
});

test('restores a shared search location and radius', async ({page}) => {
  const search = page.waitForRequest(r => r.url().includes('/api/stores?lat=40.71&lon=-74.01&radius=10'));
  await page.goto('/search?lat=40.71&lon=-74.01&radius=10&label=New%20York');
  await search;
  await expect(page).toHaveURL(/lat=40.71000.*lon=-74.01000.*radius=10/);
});

test('shows store addresses while neighborhood enrichment is unavailable', async ({page}) => {
  await page.route('**/api/enrich**', () => new Promise(() => {}));
  await page.goto('/search');
  await expect(page.getByRole('heading', {name:'La Jolla'})).toBeVisible();
  await expect(page.getByText('7631 Girard Avenue, La Jolla, CA', {exact:true}).first()).toBeVisible();
});
