import {test,expect} from '@playwright/test';
const locales=['en','es','zh-Hans','zh-Hant','tl','vi','ar'];
for(const locale of locales) test(`${locale}: complete localized navigation and metadata`,async({page,request})=>{
 const prefix=locale==='en'?'':`/${locale}`;
 await page.route('**/api/enrich**',r=>r.fulfill({json:{enriched:{}}}));
 const errors:string[]=[]; page.on('pageerror',e=>errors.push(e.message));
 await page.goto(prefix||'/');
 await expect(page.locator('html')).toHaveAttribute('lang',locale);
 await expect(page.locator('html')).toHaveAttribute('dir',locale==='ar'?'rtl':'ltr');
 await expect(page.locator('h1')).toBeVisible();
 expect((await page.locator('link[rel="canonical"]').getAttribute('href'))?.replace(/\/$/,'')).toBe(`https://www.thriftly.xyz${prefix}`);
 expect(await page.locator('link[rel="alternate"][hreflang]').count()).toBe(8);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBe(true);
 for(const path of ['/goodwill','/goodwill/los-angeles-ca','/how-we-score','/goodwill/los-angeles-ca/outlets']){
  const response=await request.get(prefix+path); expect(response.status()).toBe(200);
  const html=await response.text();
  expect(html).toContain(`lang="${locale}"`);
  expect(html).toContain(`href="https://www.thriftly.xyz${prefix+path}"`);
  expect(html).not.toContain('MISSING_MESSAGE');
 }
 // Follow the real client-side link before checking a fresh server hydration.
 // A hard navigation away from the home page can abort its pending prefetches.
 await page.locator(`a[href="${prefix}/goodwill/los-angeles-ca"]`).click();
 await expect(page).toHaveURL(prefix+'/goodwill/los-angeles-ca');
 await page.waitForLoadState('networkidle');
 // Server and browser CLDR date data can differ, so exercise SSR hydration too.
 await page.reload();
 await page.waitForLoadState('networkidle');
 await expect(page.locator('h1')).toBeVisible();
 const numberingSystem = locale === "ar" ? "arab" : "latn";
 const runtimeNumbers = await page.evaluate(({locale, numberingSystem}) => ({explicit: new Intl.NumberFormat(locale,{numberingSystem}).format(12.3), default: new Intl.NumberFormat(locale).format(12.3)}), {locale,numberingSystem});
 if(locale === "ar") console.log("Arabic runtime defaults", {server:new Intl.NumberFormat(locale).format(12.3),browser:runtimeNumbers.default});
 expect(runtimeNumbers.explicit).toBe(new Intl.NumberFormat(locale,{numberingSystem}).format(12.3));
 expect(errors).toEqual([]);
});
test('language switch retains map coordinates and filters',async({page})=>{
 await page.route('**/api/enrich**',r=>r.fulfill({json:{enriched:{}}}));
 await page.goto('/search?lat=34.05&lon=-118.24&radius=7&label=Los%20Angeles');
 await page.locator('select').filter({has:page.locator('option[value="ar"]')}).selectOption('ar');
 await expect(page).toHaveURL(/\/ar\/search\?/);
 const url=new URL(page.url());expect(Number(url.searchParams.get('lat'))).toBe(34.05);expect(Number(url.searchParams.get('lon'))).toBe(-118.24);expect(url.searchParams.get('radius')).toBe('7');
 await expect(page.locator('html')).toHaveAttribute('dir','rtl');
});
