import { test, expect } from '@playwright/test';

/** Screenshots of each theme so a reviewer can see the pixel language, not just token values. */
const THEMES = [
  ['paper', 'system', 'paper', 'light'],
  ['contrast', 'light', 'contrast', 'light'],
  ['night', 'system', 'paper', 'dark'],
];

for (const [name, mode, palette, scheme] of THEMES) {
  test(`the ${name} theme renders the beginner path without a flash of the wrong colours`, async ({ page }, info) => {
    await page.emulateMedia({ colorScheme: scheme });
    await page.addInitScript(([savedMode, savedPalette]) => {
      localStorage.setItem('sprich.mode', savedMode);
      localStorage.setItem('sprich.palette', savedPalette);
    }, [mode, palette]);

    const seen = [];
    await page.goto('/#lessons');
    seen.push(await page.evaluate(() => document.documentElement.dataset.theme));
    await expect(page.getByRole('heading', { name: 'Small lessons, in a useful order.' })).toBeVisible();
    await expect(page.locator('.next-lesson')).toBeVisible();

    const root = page.locator('html');
    await expect(root).toHaveAttribute('data-theme', name === 'night' ? 'dark' : 'light');
    await expect(root).toHaveAttribute('data-palette', name === 'night' ? 'night' : palette);
    // The pre-paint script runs before the stylesheet, so the very first observed value is already correct.
    expect(seen[0]).toBe(name === 'night' ? 'dark' : 'light');

    const paint = await page.evaluate(() => {
      const styles = getComputedStyle(document.documentElement);
      const card = document.querySelector('.next-lesson');
      return {
        bg: styles.getPropertyValue('--bg').trim(),
        texture: styles.getPropertyValue('--texture').trim(),
        border: styles.getPropertyValue('--border').trim(),
        cardRadius: card ? getComputedStyle(card).borderTopLeftRadius : null,
      };
    });
    expect(paint.bg).toMatch(/^#[0-9a-f]{3,6}$/i);
    expect(paint.texture).toBe('0');
    expect(paint.border).toBe(name === 'contrast' ? '3px' : '1px');
    // Electric Slate uses tactile cards while keeping the radius bounded.
    expect(parseFloat(paint.cardRadius)).toBeLessThanOrEqual(24);

    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    await page.screenshot({ path: info.outputPath(`theme-${name}.png`), fullPage: true });
  });
}

test('legacy light palettes stay supported but are no longer exposed in settings', async ({ page }) => {
  await page.goto('/#settings');
  await expect(page.getByLabel('Light theme')).toHaveCount(0);

  await page.evaluate(() => { localStorage.setItem('sprich.palette', 'contrast'); localStorage.setItem('sprich.mode', 'light'); });
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-palette', 'contrast');

  // A device-local choice must never be written into exportable progress.
  const exported = await page.evaluate(async () => {
    const request = indexedDB.open('sprich-german-v2');
    const db = await new Promise(resolve => { request.onsuccess = () => resolve(request.result); });
    const state = await new Promise(resolve => {
      const read = db.transaction('meta').objectStore('meta').get('state');
      read.onsuccess = () => resolve(read.result);
    });
    db.close();
    return JSON.stringify(state);
  });
  expect(exported).not.toContain('palette');
});

test('new installs start in the Electric Slate night theme', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/#settings');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('html')).toHaveAttribute('data-palette', 'night');
  await expect(page.getByLabel('Appearance')).toHaveValue('dark');
});
