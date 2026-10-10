export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

const paths = {
  home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/><path d="M9 21v-8h6v8"/>',
  play: '<path d="m9 5 11 7-11 7z"/>',
  book: '<path d="M12 6c-3-3-7-3-10-2v15c3-1 7-1 10 2 3-3 7-3 10-2V4c-3-1-7-1-10 2Z"/><path d="M12 6v15"/>',
  chart: '<path d="M4 3v17h17M8 16v-5m5 5V7m5 9V4"/>',
  settings: '<path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z"/><path d="m10 2-.6 3-2 .9L4.7 5 2 9.7l2.2 2v2.6L2 16.2 4.7 21l2.8-.9 2 .9.5 3h4l.6-3 2-.9 2.7.9 2.7-4.8-2.2-1.9v-2.6l2.2-2L19.3 5l-2.8.9-2-.9L14 2Z" transform="translate(1 0) scale(.92)"/>',
  mic: '<rect x="8" y="2" width="8" height="13" rx="4"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3m-4 0h8"/>',
  stop: '<rect x="5" y="5" width="14" height="14" rx="2"/>',
  pause: '<path d="M8 4v16M16 4v16" stroke-width="4"/>',
  arrow: '<path d="M4 12h15m-6-6 6 6-6 6"/>',
  back: '<path d="M20 12H5m6-6-6 6 6 6"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  refresh: '<path d="M20 7v5h-5M4 17v-5h5"/><path d="M6 7a7 7 0 0 1 12-1l2 3M4 15l2 3a7 7 0 0 0 12-1"/>',
  volume: '<path d="m11 4-6 5H2v6h3l6 5ZM15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  briefcase: '<rect x="3" y="7" width="18" height="14" rx="3"/><path d="M8 7V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v3M3 12c5 4 13 4 18 0M12 11v5"/>',
  messages: '<path d="M21 11a8 8 0 0 1-8 8H8l-5 3 1-6a8 8 0 1 1 17-5Z"/><path d="M8 10h8m-8 4h5"/>',
  layers: '<path d="m12 3 10 6-10 6L2 9Zm-9 11 9 5 9-5m-18 5 9 4 9-4"/>',
  coffee: '<path d="M3 8h13v7a6 6 0 0 1-12 0V8m12 1h2a3 3 0 1 1 0 6h-2M2 22h17M7 2v3m5-3v3"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
  upload: '<path d="M12 16V4m-5 5 5-5 5 5M4 16v5h16v-5"/>',
  external: '<path d="M14 3h7v7m0-7L10 14M10 3H4v17h17v-6"/>',
  spark: '<path d="m12 3 2.6 6.4L21 12l-6.4 2.6L12 21l-2.6-6.4L3 12l6.4-2.6Z"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
};

export function icon(name, className = '') {
  return `<svg class="icon ${esc(className)}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] ?? paths.spark}</svg>`;
}

export function duration(ms = 0) {
  const seconds = Math.floor(Math.max(0, ms) / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

export function minutes(ms = 0) {
  return (Math.floor(Math.max(0, ms) / 6000) / 10).toLocaleString(undefined, { maximumFractionDigits: 1 });
}

export function dueLabel(timestamp, now = Date.now()) {
  if (timestamp === null) return 'New phrase';
  if (timestamp <= now) return 'Ready to review';
  const hours = Math.ceil((timestamp - now) / 3_600_000);
  if (hours < 24) return `In ${hours} ${hours === 1 ? 'hour' : 'hours'}`;
  const days = Math.ceil(hours / 24);
  return `In ${days} ${days === 1 ? 'day' : 'days'}`;
}

export function progressBar(value, label) {
  const safe = Math.max(0, Math.min(100, Number(value) || 0));
  return `<div class="meter" role="progressbar" aria-label="${esc(label)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(safe)}"><span style="width:${safe}%"></span></div>`;
}

export function pageHeading(kicker, title, description = '') {
  return `<div class="page-heading"><p class="eyebrow">${esc(kicker)}</p><h1 tabindex="-1">${esc(title)}</h1>${description ? `<p class="lede">${esc(description)}</p>` : ''}</div>`;
}

export function downloadFile(content, name, type = 'application/json') {
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export function safeAction(button, action, onError) {
  button?.addEventListener('click', async event => {
    if (button.disabled) return;
    button.disabled = true;
    try { await action(event); }
    catch (error) { onError(error.message); }
    finally { if (button.isConnected) button.disabled = false; }
  });
}

export function outcomeLabel(outcome) {
  return { independent: 'Answered independently', helped: 'Needed some help', again: 'Practise again', correct: 'Correct', incorrect: 'Needs another listen', unscored: 'Practice recorded' }[outcome] ?? outcome;
}

export function englishMeaning(text, { id = '', kind = 'instruction', always = false, label = 'Meaning' } = {}) {
  if (!text) return '';
  return `<details class="meaning" ${id ? `id="${esc(id)}"` : ''} data-meaning="${esc(kind)}" ${always ? 'open' : ''}><summary>${esc(label)}</summary><div lang="en">${esc(text)}</div></details>`;
}

export function lessonCopy(german, english, options = {}) {
  if (!german) return `<p>${esc(english)}</p>`;
  return `<div class="lesson-copy"><p lang="de">${esc(german)}</p>${englishMeaning(english, options)}</div>`;
}

/**
 * Where a number came from. Shown once beside the figure it describes, instead of
 * repeating the same disclaimer prose on every screen. Wording matches the
 * assessment views so one vocabulary covers the whole app.
 */
export const PROVENANCE = {
  measured: 'Measured',
  checked: 'Checked locally',
  'self-rated': 'Self-rated',
  reported: 'Self-reported',
  ai: 'AI estimate',
  external: 'Imported Gemini assessment',
};

export function provenance(kind, extra = '') {
  const label = PROVENANCE[kind];
  if (!label) throw new Error(`Unknown provenance: ${kind}`);
  return `<span class="prov" data-prov="${esc(kind)}">${esc(label)}${extra ? ` · ${esc(extra)}` : ''}</span>`;
}

/** One link per screen to the single explanation, replacing repeated in-place caveats. */
export function howLink(text = 'How progress is measured') {
  return `<a class="inline-link how-link" href="#how">${icon('eye')}${esc(text)}</a>`;
}

/** Discrete pixel blocks: countable at a glance, unlike a smooth bar. */
export function blockMeter(states, label) {
  const cells = states.map(state => `<i data-on="${state === true ? 'true' : state === 'rest' ? 'rest' : 'false'}"></i>`).join('');
  return `<div class="block-meter" role="img" aria-label="${esc(label)}">${cells}</div>`;
}
