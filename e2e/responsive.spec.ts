import {test, expect} from '@playwright/test';
import {storesResponse, photonReverseResponse} from './fixtures';

test.beforeEach(async ({page}) => {
  await page.route('**/api/stores**', r => r.fulfill({json: storesResponse}));
  await page.route('**/api/enrich**', r => r.fulfill({json: {enriched: {}}}));
  await page.route(/photon\.komoot\.io\/reverse/, r => r.fulfill({json: photonReverseResponse}));
  await page.route('https://tile.openstreetmap.org/**', r => r.fulfill({
    contentType: 'image/png',
    body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=','base64'),
  }));
});

test('320px navigation stays on one row in English, Vietnamese and Arabic', async ({page}) => {
  await page.setViewportSize({width: 320, height: 740});
  for (const prefix of ['', '/vi', '/ar']) {
    await page.goto(`${prefix}/goodwill`);
    await page.evaluate(() => document.fonts.ready);
    const header = await page.locator('header').boundingBox();
    expect(header!.height).toBeLessThan(70);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
    const language = page.locator('header select');
    await expect(language).toBeEnabled();
    const box = await language.boundingBox();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);
  }
});

test('phone filters have a reachable completion action and return focus', async ({page}) => {
  await page.setViewportSize({width: 320, height: 640});
  await page.goto('/search?lat=32.84&lon=-117.27');
  await expect(page.locator('[data-store-card]').first()).toBeVisible();
  const filters = page.getByRole('button', {name: /^Filters/});
  await filters.click();
  const slider = page.getByRole('slider', {name: 'Minimum Goods Score'});
  await slider.focus(); await page.keyboard.press('ArrowRight');
  await expect(page).toHaveURL(/minScore=1/);
  const done = page.getByRole('button', {name: 'Show 3 stores', exact: true});
  await expect.poll(async () => {
    const box = await done.boundingBox();
    return box ? box.y + box.height : Infinity;
  }).toBeLessThanOrEqual(640);
  expect((await done.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  const close = page.getByRole('button', {name: 'Close', exact: true});
  expect(Math.round((await close.boundingBox())!.height)).toBeGreaterThanOrEqual(44);
  await done.click();
  await expect(page.locator('[data-slot="sheet-content"]')).not.toBeVisible();
  await expect(filters).toBeFocused();
});

test('landscape gives the map most of the screen and keeps view controls visible', async ({page}) => {
  await page.setViewportSize({width: 667, height: 375});
  await page.goto('/search?lat=32.84&lon=-117.27');
  await page.getByRole('tab', {name: 'Map', exact: true}).click();
  const map = page.locator('.leaflet-container');
  await expect(map).toBeVisible();
  expect((await map.boundingBox())!.height).toBeGreaterThan(200);
  const toolbar = await page.locator('[data-mobile-toolbar]').boundingBox();
  expect(toolbar!.y + toolbar!.height).toBeLessThanOrEqual(376);
  await expect(page.getByRole('button', {name: /^Filters/})).toBeVisible();
});

test('map search control cannot intercept the scoring popover', async ({page}) => {
  await page.setViewportSize({width: 390, height: 844});
  await page.goto('/search?lat=32.84&lon=-117.27');
  await expect(page.locator('[data-store-card]').first()).toBeVisible();
  await page.getByRole('tab', {name: 'Map', exact: true}).click();
  const map = page.locator('.leaflet-container');
  await expect(map).toBeVisible();
  // Keyboard panning exercises Leaflet's normal move handler without relying
  // on device-specific synthetic drag support.
  const searchArea = page.getByRole('button', {name: 'Search this area'});
  await expect.poll(async () => {
    await map.focus(); await page.keyboard.press('ArrowRight');
    return searchArea.isVisible();
  }, {intervals: [500, 500, 1000]}).toBe(true);
  await page.getByRole('button', {name: 'How scoring works', exact: true}).click();
  const popover = page.locator('[data-slot="popover-content"]');
  await expect(popover).toBeVisible();
  const topHitIsPopover = await page.evaluate(() => {
    const a = document.querySelector('[data-slot="popover-content"]')!.getBoundingClientRect();
    const b = Array.from(document.querySelectorAll('button')).find(x => x.textContent?.includes('Search this area'))!.getBoundingClientRect();
    const left = Math.max(a.left,b.left), right = Math.min(a.right,b.right);
    const top = Math.max(a.top,b.top), bottom = Math.min(a.bottom,b.bottom);
    return right > left && bottom > top && !!document.elementFromPoint((left+right)/2,(top+bottom)/2)?.closest('[data-slot="popover-content"]');
  });
  expect(topHitIsPopover).toBe(true);
});

test('narrow cards give addresses the full content width', async ({page}) => {
  await page.setViewportSize({width: 320, height: 740});
  await page.goto('/ar/search?lat=32.84&lon=-117.27');
  const card = page.locator('[data-store-card]').first();
  await expect(card).toBeVisible();
  const address = card.locator('[data-store-address]');
  expect((await address.boundingBox())!.width).toBeGreaterThan(250);
  await card.locator('[data-store-toggle]').click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
});
