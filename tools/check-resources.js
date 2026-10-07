import { chromium } from '@playwright/test';
import { RESOURCES } from '../app/data/resources.js';

// Optional live check. Publisher availability is intentionally not a unit-test dependency.
// It uses a fresh browser context, does not sign in, and never records the microphone.
const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'msedge' });
const requested = process.argv.slice(2);
const selected = RESOURCES.filter(resource => !requested.length || requested.includes(resource.id));
const results = [];
let index = 0;
async function worker() {
  while (index < selected.length) {
    const resource = selected[index++];
    const context = await browser.newContext({ acceptDownloads: false });
    const page = await context.newPage();
    let responseInfo = null;
    page.on('response', response => {
      if (response.request().isNavigationRequest()) responseInfo = { status: response.status(), contentType: response.headers()['content-type'] ?? '' };
    });
    try {
      await page.goto(resource.url, { waitUntil: 'domcontentloaded', timeout: 20_000 });
      if (new URL(resource.url).hostname === 'learngerman.dw.com') {
        await page.waitForFunction(() => document.title !== 'DW Learn German' || document.querySelector('audio, video'), null, { timeout: 10_000 }).catch(() => {});
      }
      const text = await page.locator('body').innerText({ timeout: 3000 }).catch(() => '');
      const status = responseInfo?.status ?? 0;
      const blocked = [401, 403, 429].includes(status) || /access denied|verify you are human|captcha/i.test(text);
      let playback = 'No directly playable media; follow the publisher activity or login instructions.';
      if (!blocked && status < 400) {
        playback = await page.evaluate(async () => {
          const media = document.querySelector('audio, video');
          if (!media) return 'Page accessible; media requires a publisher interaction or is not applicable.';
          let timer;
          try {
            media.muted = true;
            await Promise.race([media.play(), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Player needs an interaction or more loading time.')), 4000); })]);
            return `Muted playback started; readyState ${media.readyState}.`;
          } catch (error) { return `Player not automatically verified: ${error.message}`; }
          finally { clearTimeout(timer); media.pause(); }
        });
      }
      results.push({ id: resource.id, status, result: blocked ? 'blocked/manual check' : status >= 400 ? 'HTTP error' : 'page available', title: await page.title(), playback });
    } catch (error) {
      const pdf = responseInfo?.status === 200 && responseInfo.contentType.includes('pdf');
      results.push({ id: resource.id, status: responseInfo?.status ?? 0, result: pdf ? 'PDF response available' : 'unverified', detail: pdf ? 'Download was not saved by this check.' : error.message.split('\n')[0] });
    } finally { await context.close(); }
  }
}
try {
  await Promise.all([worker(), worker()]);
  results.sort((a, b) => RESOURCES.findIndex(resource => resource.id === a.id) - RESOURCES.findIndex(resource => resource.id === b.id));
  console.log(JSON.stringify({ checkedAt: new Date().toISOString(), resources: results }, null, 2));
} finally { await browser.close(); }
