import {test, expect} from '@playwright/test';
import {mockStoreDetails} from './fixtures';

test('directory schema describes the visible store order and directions', async ({page}) => {
  await page.route('**/api/enrich**', route => route.abort());
  await mockStoreDetails(page, {unavailable: true});
  for (const path of ['/goodwill/new-york-ny', '/thrift-stores/los-angeles-ca']) {
    await page.goto(path);
    const items = await page.locator('script[type="application/ld+json"]').evaluateAll(nodes => {
      const graphs = nodes.flatMap(node => {
        const parsed = JSON.parse(node.textContent ?? '{}');
        return parsed['@graph'] ?? [parsed];
      });
      return graphs.find(graph => graph['@type'] === 'ItemList')?.itemListElement ?? [];
    });
    expect(items.length).toBeGreaterThan(0);
    const cards = page.locator('li[data-store-id]');
    for (const [index, entry] of items.entries()) {
      const store = entry.item;
      const card = cards.nth(index);
      await expect(card).toHaveAttribute('data-store-id', store.identifier);
      if (store.address.streetAddress) await expect(card).toContainText(store.address.streetAddress);
      const directions = card.getByRole('link', {name: 'Directions', exact: true});
      await expect(directions).toHaveAttribute('href', /^https:\/\/www\.google\.com\/maps\/dir\//);
      const url = new URL((await directions.getAttribute('href'))!);
      expect(url.searchParams.get('destination')).toBe(`${store.geo.latitude},${store.geo.longitude}`);
      expect(store.aggregateRating).toBeUndefined();
    }
  }
});

test('single-brand cross-brand pages disclose their current coverage', async ({page}) => {
  await page.goto('/thrift-stores/denver-co');
  await page.getByRole('button', {name: 'Coverage and sources', exact: true}).first().click();
  await expect(page.getByText('Our current sources list only Goodwill within this radius. Other thrift shops may be nearby.')).toBeVisible();
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://www.thriftly.xyz/thrift-stores/denver-co');
  await expect(page.getByRole('link', {name: /^Goodwill \(/})).toHaveAttribute('href', '/goodwill/denver-co');
});

test('city listings and directions remain available without JavaScript', async ({browser, baseURL}) => {
  const context = await browser.newContext({baseURL, javaScriptEnabled: false, ignoreHTTPSErrors: true});
  const page = await context.newPage();
  try {
    await page.goto('/es/goodwill/los-angeles-ca');
    const cards = page.locator('li[data-store-id]');
    expect(await cards.count()).toBeGreaterThan(0);
    await expect(cards.first().locator('a[href^="https://www.google.com/maps/dir/"]')).toBeVisible();
    await expect(page.getByRole('heading', {level: 1})).toContainText('Los Angeles');
  } finally {
    await context.close();
  }
});
