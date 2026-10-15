import { esc, icon } from './ui.js';
import { safeSourceURL } from './model.js';

const MAX_SHARED_TEXT = 6000;
const MAX_SHARED_SOURCE_URL = 2048;
const URL_IN_SHARED_TEXT = /https:\/\/[^\s<>"'`]+/gi;
// shortcut: 6000 characters, raise only with a reviewed draft transport.

function rejectCapture(error, tooLong = false) {
  return { text: '', sourceUrl: '', tooLong, rejected: true, error };
}

function sourceURL(value, fromText = false) {
  const candidate = fromText ? value.trim().replace(/[),.;!?]+$/, '') : value.trim();
  return candidate.length <= MAX_SHARED_SOURCE_URL && safeSourceURL(candidate) ? candidate : '';
}

export function hasSharedCaptureIntent(href = globalThis.location?.href ?? '') {
  try {
    const url = new URL(href || 'http://localhost/');
    return url.searchParams.has('text') || url.searchParams.has('url');
  } catch { return false; }
}

export function sharedCapture(href = globalThis.location?.href ?? '') {
  let url;
  try { url = new URL(href || 'http://localhost/'); }
  catch { return rejectCapture('The shared link could not be read.'); }

  const params = url.searchParams;
  const title = params.get('title')?.trim() ?? '';
  let text = params.get('text')?.trim() ?? '';
  let source = sourceURL(params.get('url')?.trim() ?? '');
  if (title && text === title) text = '';
  text = text.replace(URL_IN_SHARED_TEXT, value => {
    const embedded = sourceURL(value, true);
    if (embedded && !source) source = embedded;
    return embedded ? '' : value;
  }).trim();

  if (text.length > MAX_SHARED_TEXT) return rejectCapture('The shared text is over the 6000-character limit. Choose a smaller selection and share it again.', true);
  return { text, sourceUrl: source, tooLong: text.length > 500, rejected: false, error: '' };
}

export function phraseForm(source = null, sharedText = '') {
  const german = sharedText.length > 500
    ? `<textarea name="de" lang="de" required maxlength="500" rows="4">${esc(sharedText)}</textarea>`
    : `<input type="text" name="de" lang="de" required maxlength="500" value="${esc(sharedText)}" placeholder="Ich rufe wegen … an.">`;
  return `<form class="personal-phrase-form"><div class="form-grid">
    <label>German phrase${german}</label>
    <label>English meaning<input type="text" name="en" lang="en" required maxlength="1000" placeholder="I am calling about …"></label>
    <label class="full">Your own example sentence<textarea name="example" lang="de" maxlength="1500" placeholder="Use the phrase in a situation that matters to you."></textarea></label>
    <label class="full">Source link (optional)<input type="text" name="sourceUrl" inputmode="url" value="${esc(source?.url ?? '')}" placeholder="https://…"></label>
    <input type="hidden" name="sourceId" value="${esc(source?.id ?? '')}"><input type="hidden" name="sourceTitle" value="${esc(source?.title ?? '')}">
    </div><div class="btn-row form-actions"><button class="btn" type="submit">${icon('book')}Save phrase to my collection</button><a class="inline-link" href="#phrases">Open my phrases ${icon('arrow')}</a></div>
    <p class="fine">Saved phrases can be recalled aloud and travel with your progress export. Their wording is your own; check it against the source.</p></form>`;
}

export function bindPhraseForm(root, ctx, onSaved = () => {}) {
  root.querySelectorAll('.personal-phrase-form').forEach(form => form.addEventListener('submit', async event => {
    event.preventDefault();
    const button = form.querySelector('button[type="submit"]');
    if (button.disabled) return;
    button.disabled = true;
    try {
      const data = Object.fromEntries(new FormData(form));
      const id = await ctx.store.addPersonalPhrase(data);
      form.reset();
      ctx.notify('Phrase saved. Matching phrases are kept once, including across devices.');
      await onSaved(id);
    } catch (error) { ctx.error(error.message); }
    finally { if (button.isConnected) button.disabled = false; }
  }));
}
