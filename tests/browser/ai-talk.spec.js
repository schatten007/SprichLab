import { test, expect } from '@playwright/test';

const ACCESS_CODE = 'test-only-owner-token-000000000000000000000';
const PARTNER_FOLLOW_UP = 'Danke. Wie viele Stunden könnten Sie an diesen Tagen arbeiten?';

async function unlock(page) {
  await page.goto('/#ai');
  await expect(page.getByRole('heading', { name: 'A private German conversation that waits for you.' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Gemini Companion on your phone' })).toBeVisible();
  const token = page.locator('#ai-token');
  await expect(token).toBeVisible({ timeout: 15_000 });
  await token.fill(ACCESS_CODE);
  await page.getByRole('button', { name: 'Unlock AI Talk' }).click();
  await expect(page.getByText('Unlocked', { exact: true })).toBeVisible();
  await expect(page.locator('.usage-block')).toBeVisible();
}

async function startConversation(page) {
  await page.getByRole('button', { name: 'Start conversation' }).click();
  await expect(page).toHaveURL(/#ai\/session\//);
  await expect(page.locator('.transcript-line.assistant').first()).toBeVisible();
}

test('AI Talk unlocks, sends one pushed clip, and shows the partner reply', async ({ page }, testInfo) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await unlock(page);
  await expect(page.getByRole('link', { name: 'AI Talk' })).toHaveAttribute('aria-current', 'page');
  await startConversation(page);

  await page.getByRole('button', { name: 'Hold a short answer' }).click();
  await expect(page.getByRole('button', { name: 'Stop' })).toBeVisible();
  await page.waitForTimeout(1200);
  await page.getByRole('button', { name: 'Stop' }).click();
  await expect(page.locator('#ai-audio audio')).toBeVisible({ timeout: 15_000 });

  await page.getByRole('button', { name: 'Send to partner' }).click();
  await expect(page.locator('.transcript-line.you').first()).toContainText('Ich kann montags und donnerstags arbeiten.', { timeout: 25_000 });
  await expect(page.locator('.transcript-line.assistant').last()).toContainText(PARTNER_FOLLOW_UP);
  await page.screenshot({ path: testInfo.outputPath('ai-session.png'), fullPage: true });
  expect(errors).toEqual([]);
});

test('a typed answer still works, and the review never returns a score', async ({ page }, testInfo) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await unlock(page);
  await startConversation(page);

  for (const answer of ['Ich bin seit zwei Jahren als Werkstudent tätig.', 'Ich kann dreißig Stunden pro Woche arbeiten.']) {
    await page.locator('.notes-details').evaluate(details => { details.open = true; });
    await page.locator('#ai-text').fill(answer);
    await page.getByRole('button', { name: 'Send to partner' }).click();
    await expect(page.locator('.transcript-line.you').last()).toContainText(answer, { timeout: 25_000 });
    await expect(page.locator('.transcript-line.assistant').last()).toContainText(PARTNER_FOLLOW_UP);
  }

  await page.getByRole('button', { name: 'End & get a review' }).click();
  await expect(page.getByRole('heading', { name: 'What worked, and one thing to try again' })).toBeVisible({ timeout: 25_000 });
  await expect(page.getByRole('heading', { name: 'Good moments' })).toBeVisible();
  await expect(page.getByText('No correction was confident enough to raise, so none was invented.')).toBeVisible();
  await expect(page.locator('.review-card')).toContainText('NOT A SCORE');
  await expect(page.getByText('Nothing here awards mastery or a pronunciation grade.')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('ai-review.png'), fullPage: true });

  await page.locator('.nav-link[href="#ai"]').click();
  await expect(page.getByText(/exchanges · .* · reviewed/)).toBeVisible();
  expect(errors).toEqual([]);
});
