import {expect, test} from '@playwright/test';
import {storesResponse, photonReverseResponse} from './fixtures';
import type {ScoredStore} from '../lib/types';

test.beforeEach(async({page})=>{
 const mixed: {stores: ScoredStore[]} = structuredClone(storesResponse);
 mixed.stores[0].brandId='goodwill';
 mixed.stores[1].brandId='buffalo-exchange';
 mixed.stores[1].name='Buffalo Exchange';
 await page.route('**/api/stores**',r=>r.fulfill({json:mixed}));
 await page.route('**/api/enrich**',r=>r.fulfill({json:{enriched:{}}}));
 await page.route(/photon\.komoot\.io\/reverse/,r=>r.fulfill({json:photonReverseResponse}));
 await page.route(/photon\.komoot\.io\/api/,r=>r.fulfill({json:{features:[]}}));
 await page.route('https://tile.openstreetmap.org/**',r=>r.abort('failed'));
 await page.route('**/api/place-match**',r=>r.fulfill({json:{placeId:null}}));
});

test('brand-only deep link survives location resolution and supports multiple brands', async({page,isMobile})=>{
 await page.goto('/search?brands=buffalo-exchange');
 await expect(page.locator('[data-store-card]')).toHaveCount(1);
 await expect(page.locator('[data-store-card]')).toContainText('Buffalo Exchange');
 await expect(page).toHaveURL(/brands=buffalo-exchange/);
 await page.getByRole('button',{name:/^filters/i}).click();
 await page.getByRole('checkbox',{name:'Goodwill',exact:true}).check();
 if(isMobile) await page.getByRole('button',{name:/show .* stores/i}).click();
 await expect(page.locator('[data-store-card]')).toHaveCount(storesResponse.stores.length);
 await expect(page).toHaveURL(/brands=/);
});

test('map tile failure preserves addresses and directions in the list', async({page,isMobile})=>{
 await page.goto('/search?lat=32.84&lon=-117.27');
 if(isMobile) await page.getByRole('tab',{name:'Map',exact:true}).click();
 await expect(page.getByText('The map is temporarily unavailable. Store listings and directions are still available.')).toBeVisible();
 if(isMobile) await page.getByRole('tab',{name:'List',exact:true}).click();
 const card=page.locator('[data-store-card]').first();
 await expect(card.locator('[data-store-address]')).not.toBeEmpty();
 await card.locator('[data-store-toggle]').click();
 await expect(card.getByRole('link',{name:'Directions',exact:true})).toHaveAttribute('href',/^https:\/\/www.google.com\/maps\/dir\//);
});

test('problem reports enter pending review without changing the listing',async({page})=>{
 let submission: Record<string,unknown>|undefined;
 await page.route('**/api/reports',async r=>{submission=r.request().postDataJSON();await r.fulfill({status:201,json:{id:'qa-report-id',status:'pending'}})});
 await page.goto('/search?lat=32.84&lon=-117.27');
 const card=page.locator('[data-store-card]').first();
 const address=await card.locator('[data-store-address]').textContent();
 await card.getByRole('button',{name:/report a problem/i}).click();
 await card.getByRole('combobox').selectOption('donation-only');
 await card.getByRole('button',{name:'Send for review',exact:true}).click();
 await expect(card.locator('[data-report-listing]').getByRole('status')).toContainText(/review/i);
 expect(submission?.reason).toBe('donation-only');
 expect(submission?.requestId).toMatch(/^[a-f0-9-]{36}$/);
 await expect(card.locator('[data-store-address]')).toHaveText(address!);
});

test('city pages separate all stores and Goodwill while retaining a visible source',async({page})=>{
 await page.goto('/thrift-stores/san-diego-ca');
 await expect(page.getByRole('heading',{level:1})).toHaveText('Thrift and resale stores in San Diego, CA');
 const brands=page.getByRole('navigation',{name:'Browse store brands in San Diego'});
 await expect(brands.getByRole('link',{name:/All stores/})).toHaveAttribute('aria-current','page');
 await brands.getByRole('link',{name:/^Goodwill/}).click();
 await expect(page).toHaveURL(/\/goodwill\/san-diego-ca/);
 await expect(page.getByText(/Listing source/).first()).toBeVisible();
 await expect(page.getByText(/Source checked/).first()).toBeVisible();
 await expect(page.getByRole('heading',{level:3}).filter({hasText:'Buffalo Exchange'})).toHaveCount(0);
});
