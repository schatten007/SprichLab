import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { PracticePage } from './practice-page.js';
import { TEST_ACCESS_CODE } from '../../tools/mock-ai-provider.js';

const pack = JSON.parse(await readFile(new URL('../../app/public/assessments/pilot-cafe-a-v1.json', import.meta.url), 'utf8'));
const roleplay = pack.definitions.find(definition => definition.kind === 'roleplay');

class AssessmentSendPage {
  constructor(page) { this.page = page; this.storage = new PracticePage(page); }
  async start() {
    await this.page.goto('/#ai');
    await this.page.getByLabel('Owner access code').fill(TEST_ACCESS_CODE);
    await this.page.getByRole('button', { name: 'Unlock AI Talk', exact: true }).click();
    await expect(this.page.getByText('Unlocked', { exact: true })).toBeVisible();
    await expect(this.page.getByText('Test provider · no real AI', { exact: true })).toBeVisible();
    await this.page.goto('/#assessments');
    await this.page.getByRole('combobox', { name: 'Assessment mode', exact: true }).selectOption('checkpoint');
    await this.page.locator(`[data-start-assessment="${roleplay.id}"]:not([data-gemini-live])`).click();
    await expect(this.page).toHaveURL(/#ai\/session\//);
    await expect(this.page.getByRole('heading', { name: roleplay.title, exact: true })).toBeVisible();
    this.sessionId = new URL(this.page.url()).hash.slice('#ai/session/'.length);
  }
  async session() { return (await this.storage.readState()).aiSessions.find(session => session.id === this.sessionId); }
  async record() {
    // The existing browser projects supply a fake microphone, while the app uses real MediaRecorder.
    await this.page.getByRole('button', { name: 'Hold a short answer', exact: true }).click();
    const timer = this.page.getByRole('status', { name: 'Recording duration', exact: true });
    await expect.poll(async () => {
      const match = /^(\d+):(\d{2})$/.exec(await timer.textContent());
      return match ? Number(match[1]) * 60 + Number(match[2]) : 0;
    }).toBeGreaterThanOrEqual(1);
    await this.page.getByRole('button', { name: 'Stop', exact: true }).click();
    await expect(this.page.getByRole('button', { name: 'Send to partner', exact: true })).toBeEnabled();
    const draft = (await this.session()).draft;
    expect(draft.recordingMs).toBeGreaterThanOrEqual(1000);
    expect(draft.audioKey).not.toBe('');
    expect(draft.text).toBe(''); expect(draft.status).toBe('draft');
    return draft;
  }
}

test('discard is disabled throughout an assessed audio send and the completed turn retains its recording provenance', async ({ page }) => {
  const app = new AssessmentSendPage(page);
  await app.start();
  const recorded = await app.record();
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  let upstream = null; let routeError = null; let posts = 0;
  await page.route('**/api/v1/turns', async route => {
    if (route.request().method() !== 'POST') { await route.continue(); return; }
    posts++;
    try {
      const response = await route.fetch();
      upstream = { status: response.status(), body: await response.json() };
      await gate;
      await route.fulfill({ response });
    } catch (error) {
      routeError = error;
      await route.abort().catch(() => {});
    }
  });
  try {
    await page.getByRole('button', { name: 'Send to partner', exact: true }).click();
    await expect.poll(() => {
      if (routeError) throw routeError;
      return upstream !== null;
    }).toBe(true);
    expect(upstream.status).toBe(200);
    expect(upstream.body.data).toMatchObject({ requestId: recorded.requestId, sessionId: app.sessionId, inputStatus: 'clear', testMode: true });
    const pending = await app.session();
    expect(pending.turns).toHaveLength(0);
    expect(pending.draft).toEqual({ ...recorded, status: 'sending', error: '' });
    const discard = page.getByRole('button', { name: 'Discard unsent answer', exact: true });
    await expect(discard).toBeDisabled();
    // Dispatch deliberately bypasses normal disabled-button actionability, exercising the event guard too.
    await discard.dispatchEvent('click');
    await expect(discard).toBeDisabled();
    expect((await app.session()).draft).toEqual(pending.draft);
    expect(posts).toBe(1);

    release();
    await expect.poll(async () => (await app.session()).turns.length).toBe(1);
    const completed = (await app.session()).turns[0];
    expect(completed).toMatchObject({ id: recorded.requestId, operation: 'reply', transcript: upstream.body.data.transcript,
      inputMode: 'transcribed', audioKey: recorded.audioKey, recordingMs: recorded.recordingMs });
    expect((await app.session()).draft).toMatchObject({ status: 'draft', text: '', audioKey: '', recordingMs: 0 });
    expect(routeError).toBeNull(); expect(posts).toBe(1);
  } finally {
    release();
    await page.unrouteAll({ behavior: 'wait' });
  }
});
