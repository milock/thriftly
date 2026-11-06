import {test, expect} from '@playwright/test';

test.beforeEach(async ({page}) => {
  await page.route('**/api/enrich**', route => route.fulfill({json: {enriched: {}}}));
});

test('language menu supports keyboard choice and restores focus when dismissed', async ({page}) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/goodwill/new-york-ny');
  const picker = page.getByRole('combobox', {name: 'Language', exact: true});
  await picker.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('option')).toHaveCount(7);
  await expect(page.getByRole('option', {name: 'English', exact: true})).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('listbox')).not.toBeVisible();
  await expect(picker).toBeFocused();
  await page.keyboard.press('Enter');
  await page.keyboard.type('Esp');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL('/es/goodwill/new-york-ny');
  await expect(page.locator('html')).toHaveAttribute('lang', 'es');
  expect(errors).toEqual([]);
});

test('language menu fits narrow and wide layouts in both directions and themes', async ({page}) => {
  for (const [width, height, prefix, theme] of [[320, 740, '', 'light'], [1440, 740, '', 'dark'], [320, 740, '/ar', 'dark'], [740, 320, '', 'light']] as const) {
    await page.setViewportSize({width, height});
    await page.emulateMedia({colorScheme: theme});
    await page.goto(`${prefix}/goodwill/new-york-ny`);
    if (theme === 'dark') await expect(page.locator('html')).toHaveClass(/dark/);
    await page.locator('[data-language-picker]').click();
    const menu = page.getByRole('listbox');
    await expect(menu).toBeVisible();
    const box = (await page.locator('[data-slot="select-content"]').boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(width);
    expect(box.y + box.height).toBeLessThanOrEqual(height);
    for (const option of await page.getByRole('option').all()) {
      expect(Math.round((await option.boundingBox())!.height)).toBeGreaterThanOrEqual(44);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    await page.keyboard.press('Escape');
    await expect(menu).not.toBeVisible();
  }
});

test('the final language remains reachable in a short landscape menu', async ({page}) => {
  await page.setViewportSize({width: 740, height: 320});
  await page.goto('/goodwill/new-york-ny');
  await page.locator('[data-language-picker]').focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('option', {name: 'English', exact: true})).toBeFocused();
  await page.keyboard.press('End');
  const arabic = page.getByRole('option', {name: 'العربية', exact: true});
  await expect(arabic).toBeInViewport();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL('/ar/goodwill/new-york-ny');
  await expect(page.locator('html')).toHaveAttribute('dir','rtl');
});
