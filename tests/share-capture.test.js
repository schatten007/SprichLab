import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { hasSharedCaptureIntent, sharedCapture } from '../app/js/phrase-form.js';

test('shared capture reads text and an optional source URL', () => {
  const capture = sharedCapture('https://sprich.example/?text=Guten%20Tag%21&url=https%3A%2F%2Fexample.org%2Flesson');
  assert.equal(capture.text, 'Guten Tag!');
  assert.equal(capture.sourceUrl, 'https://example.org/lesson');
  assert.equal(capture.tooLong, false);
  assert.equal(capture.rejected, false);
  assert.equal(capture.error, '');
});

test('shared capture extracts an HTTPS source URL included in shared text', () => {
  const capture = sharedCapture(`https://sprich.example/?text=${encodeURIComponent('Guten Tag! https://example.org/lesson')}`);
  assert.equal(capture.text, 'Guten Tag!');
  assert.equal(capture.sourceUrl, 'https://example.org/lesson');
});

test('shared capture preserves text over the phrase field limit for sentence selection', () => {
  const capture = sharedCapture(`https://sprich.example/?text=${encodeURIComponent('a'.repeat(501))}`);
  assert.equal(capture.tooLong, true);
  assert.equal(capture.text.length, 501);
  assert.equal(capture.rejected, false);
});

test('shared capture rejects very large text explicitly instead of truncating it', () => {
  const capture = sharedCapture(`https://sprich.example/?text=${encodeURIComponent('a'.repeat(6001))}`);
  assert.equal(capture.tooLong, true);
  assert.equal(capture.rejected, true);
  assert.equal(capture.text, '');
  assert.match(capture.error, /6000/);
});

test('shared capture drops unsafe source URLs before they reach the form', () => {
  const capture = sharedCapture('https://sprich.example/?text=Hallo&url=javascript%3Aalert(1)');
  assert.equal(capture.sourceUrl, '');
});

test('shared capture ignores blank or title-only text while retaining a safe source', () => {
  const capture = sharedCapture('https://sprich.example/?title=Article%20title&text=Article%20title&url=https%3A%2F%2Fexample.org');
  assert.equal(capture.text, '');
  assert.equal(capture.sourceUrl, 'https://example.org');
});

test('share intent recognizes text or URL parameters, not an arbitrary title', () => {
  assert.equal(hasSharedCaptureIntent('https://sprich.example/?text='), true);
  assert.equal(hasSharedCaptureIntent('https://sprich.example/?url=https%3A%2F%2Fexample.org'), true);
  assert.equal(hasSharedCaptureIntent('https://sprich.example/?title=Article%20title'), false);
  assert.equal(hasSharedCaptureIntent('https://sprich.example/?source=Article%20title'), false);
});

test('manifest declares a GET share target for title, text, and URL', async () => {
  const manifest = JSON.parse(await readFile(new URL('../app/public/manifest.webmanifest', import.meta.url), 'utf8'));
  assert.equal(manifest.share_target.method, 'GET');
  assert.equal(manifest.share_target.action, './');
  assert.deepEqual(manifest.share_target.params, { title: 'title', text: 'text', url: 'url' });
});
