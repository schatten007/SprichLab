import { test, expect } from '@playwright/test';
import { PracticePage } from './practice-page.js';

test('settings shows local-first storage, honest empty states, and the real backup composition', async ({ page }) => {
  await page.goto('/#settings');
  await expect(page.getByRole('heading', { name: 'Make it fit your life.' })).toBeVisible();
  await expect(page.locator('#local-first-status')).toHaveText('Local-first storage · this browser');
  await expect(page.locator('#backup-composition')).toContainText('Profile and preferences');
  await expect(page.locator('#backup-composition')).toContainText('Practice evidence · 0 attempts');
  await expect(page.locator('#backup-composition')).toContainText('Audio recordings stay on this device');
  await expect(page.locator('#audio-size')).toHaveText('No saved audio on this device yet.');
  await expect(page.locator('#import-status')).toHaveText('No file selected yet. Choose a Sprich progress export.');
  await expect(page.getByLabel('Light theme')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
});

test('settings saves preferences and exports only the state-backed transfer contents', async ({ page }) => {
  const app = new PracticePage(page);
  await page.goto('/#settings');
  await page.getByLabel('What should we call you?').fill('Sam');
  await page.getByRole('button', { name: 'Save my profile', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Your profile is saved.' })).toBeVisible();
  await page.getByLabel('Daily practice goal').selectOption('30');
  await page.getByLabel('Study day time zone').selectOption('UTC');
  await page.getByLabel('Appearance').selectOption('light');
  await page.getByRole('button', { name: 'Save preferences', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Preferences saved.' })).toBeVisible();
  await expect.poll(async () => (await app.readState()).preferences).toMatchObject({ dailyMinutes: 30, timeZone: 'UTC', theme: 'light' });

  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export progress', exact: true }).click();
  const download = await downloadEvent;
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  const exported = JSON.parse(Buffer.concat(chunks).toString());
  expect(exported.state.profile.name).toBe('Sam');
  expect(exported.state.preferences.theme).toBe('light');
  expect(JSON.stringify(exported)).not.toContain('palette');
  expect(JSON.stringify(exported)).not.toContain('recordings');
});

test('settings keeps legacy and pre-upgrade backup downloads available after migration', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('deutsch-trainer-v1', JSON.stringify({ planMin: 15, assess: [{ id: 'old-check' }] }));
  });
  await page.goto('/#settings');
  await expect(page.getByRole('heading', { name: 'Previous trainer backup' })).toBeVisible();
  const legacyDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download previous data', exact: true }).click();
  expect((await legacyDownload).suggestedFilename()).toBe('deutsch-trainer-legacy.json');

  await page.evaluate(async () => {
    const request = indexedDB.open('sprich-german-v2');
    const db = await new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    await new Promise((resolve, reject) => {
      const tx = db.transaction('meta', 'readwrite');
      tx.objectStore('meta').put({ schemaVersion: 5, migratedAt: Date.now() }, 'schema-5-backup');
      tx.oncomplete = resolve; tx.onerror = () => reject(tx.error);
    });
    db.close();
  });
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Before this course update' })).toBeVisible();
  const previousDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download pre-upgrade backup', exact: true }).click();
  expect((await previousDownload).suggestedFilename()).toBe('sprich-before-course-update.json');
});
