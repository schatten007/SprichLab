import { test, expect } from '@playwright/test';

/** Primary routes stay one tap away; everything else lives behind More. */
test('the four primary destinations are always one tap away', async ({ page }) => {
  await page.goto('/');
  for (const name of ['Today', 'Lessons', 'Words', 'Progress']) {
    await expect(page.getByRole('link', { name, exact: true })).toBeVisible();
  }
  await expect(page.locator('#navigation .nav-link')).toHaveCount(10);
});

test('Settings is reachable on a phone, where the sidebar footer is hidden', async ({ page }) => {
  await page.goto('/');
  const summary = page.locator('.nav-more > summary');
  if (await summary.isVisible()) await summary.click();

  const settings = page.locator('.nav-more-panel .nav-link[href="#settings"]');
  await expect(settings).toBeVisible();
  await settings.click();
  await expect(page.getByRole('heading', { name: 'Make it fit your life.' })).toBeVisible();
  await expect(page.locator('.nav-more')).toHaveAttribute('data-active', 'true');
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
});

test('the More menu reaches every secondary screen and marks the current one', async ({ page }) => {
  const destinations = [
    ['#how', 'What your numbers actually mean.'],
    ['#practice', 'A conversation worth having.'],
    ['#assessments', 'Checks and graded roleplays'],
  ];
  for (const [href, heading] of destinations) {
    await page.goto('/');
    const summary = page.locator('.nav-more > summary');
    if (await summary.isVisible()) await summary.click();
    await page.locator(`.nav-more-panel .nav-link[href="${href}"]`).click();
    await expect(page.getByRole('heading', { name: heading })).toBeVisible();
    await expect(page.locator(`.nav-more-panel .nav-link[href="${href}"]`)).toHaveAttribute('aria-current', 'page');
    await expect(page.locator('.nav-more')).toHaveAttribute('data-active', 'true');
  }
});

test('a primary destination clears the More menu highlight', async ({ page }) => {
  await page.goto('/#settings');
  await expect(page.locator('.nav-more')).toHaveAttribute('data-active', 'true');
  await page.getByRole('link', { name: 'Lessons', exact: true }).click();
  await expect(page.locator('.nav-more')).toHaveAttribute('data-active', 'false');
  await expect(page.getByRole('link', { name: 'Lessons', exact: true })).toHaveAttribute('aria-current', 'page');
});

test('the explainer page documents each kind of evidence once', async ({ page }) => {
  await page.goto('/#how');
  await expect(page.getByRole('heading', { name: 'What your numbers actually mean.' })).toBeVisible();
  await expect(page.locator('.prov')).toHaveCount(6);
  for (const label of ['Measured', 'Checked locally', 'Self-rated', 'Self-reported', 'AI estimate', 'Imported Gemini assessment']) {
    await expect(page.getByText(label, { exact: true })).toBeVisible();
  }
  await expect(page.getByText('15 minutes of measured practice')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
});
