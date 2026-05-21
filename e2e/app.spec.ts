import { test, expect } from "@playwright/test";
import { storesResponse, geocodeResponse } from "./fixtures";

test.beforeEach(async ({ page }) => {
  await page.route("**/api/stores**", (route) => route.fulfill({ json: storesResponse }));
  await page.route("**/api/geocode**", (route) => route.fulfill({ json: geocodeResponse }));
  await page.route("**/api/reverse**", (route) => route.fulfill({ json: { label: "San Diego, CA" } }));
  await page.route("**/api/enrich**", (route) => route.fulfill({ json: { enriched: {} } }));
});

test("ranks stores and crowns the best find", async ({ page }) => {
  await page.goto("/search");
  await expect(page.getByRole("img", { name: /goods score 89/i })).toBeVisible();
  await expect(page.getByText(/best find/i)).toBeVisible();
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

test("filters are reachable", async ({ page, isMobile }) => {
  await page.goto("/search");
  if (isMobile) await page.getByRole("button", { name: /^filters$/i }).click();
  await expect(page.getByText(/search radius/i)).toBeVisible();
});

test("the sort control shows its label at rest, not the raw value", async ({ page, isMobile }) => {
  await page.goto("/search");
  if (isMobile) await page.getByRole("button", { name: /^filters$/i }).click();
  // The trigger must read "Goods Score" (the label), never the "score" slug.
  await expect(page.getByText("Goods Score", { exact: true })).toBeVisible();
});

test("the map renders", async ({ page, isMobile }) => {
  await page.goto("/search");
  if (isMobile) await page.getByRole("tab", { name: /map/i }).click();
  await expect(page.locator(".leaflet-container").first()).toBeVisible();
});

test("mobile exposes list and map tabs", async ({ page, isMobile }) => {
  test.skip(!isMobile, "mobile layout only");
  await page.goto("/search");
  await expect(page.getByRole("tab", { name: /list/i })).toBeVisible();
  await expect(page.getByRole("tab", { name: /map/i })).toBeVisible();
});
