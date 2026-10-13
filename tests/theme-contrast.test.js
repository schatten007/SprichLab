import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const css = await readFile(new URL('../app/css/styles.css', import.meta.url), 'utf8');

/** WCAG 2.1 relative luminance from an #rrggbb string. */
function luminance(hex) {
  const value = hex.trim().replace('#', '');
  const full = value.length === 3 ? [...value].map(part => part + part).join('') : value;
  assert.match(full, /^[0-9a-fA-F]{6}$/, `Themes must use #rrggbb colours, received "${hex}".`);
  const channels = [0, 2, 4].map(index => parseInt(full.slice(index, index + 2), 16) / 255)
    .map(channel => channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}
const ratio = (a, b) => {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
};

/** Read one CSS rule block and return its custom properties. */
function tokens(selector) {
  const start = css.indexOf(selector);
  assert.notEqual(start, -1, `Missing theme block: ${selector}`);
  const open = css.indexOf('{', start);
  const close = css.indexOf('}', open);
  const block = css.slice(open + 1, close);
  const found = {};
  for (const match of block.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) found[match[1]] = match[2].trim();
  return found;
}

const THEMES = {
  paper: tokens(':root'),
  contrast: tokens("html[data-theme='light'][data-palette='contrast']"),
  night: tokens("html[data-theme='dark']"),
};
// Contrast and night only override what differs, so fall back to the paper defaults.
const token = (theme, name) => THEMES[theme][name] ?? THEMES.paper[name];

const REQUIRED = [
  ['--ink', '--bg', 'body text on the page'],
  ['--ink', '--surface', 'body text on a card'],
  ['--muted', '--bg', 'secondary text on the page'],
  ['--muted', '--surface', 'secondary text on a card'],
  ['--brand-ink', '--brand', 'label on a primary button'],
  ['--tint-ink', '--tint', 'label on a tinted pill'],
  ['--amber-ink', '--amber', 'label on a warning'],
  ['--danger', '--danger-bg', 'error text on its background'],
];

for (const [name, minimum] of [['paper', 4.5], ['contrast', 7], ['night', 4.5]]) {
  test(`${name} keeps every text pair readable (>= ${minimum}:1)`, () => {
    for (const [front, back, description] of REQUIRED) {
      const measured = ratio(token(name, front), token(name, back));
      assert.ok(measured >= minimum,
        `${name}: ${description} (${front} on ${back}) is ${measured.toFixed(2)}:1, needs ${minimum}:1.`);
    }
  });

  test(`${name} keeps the focus ring visible (>= 3:1)`, () => {
    for (const back of ['--bg', '--surface']) {
      const measured = ratio(token(name, '--focus'), token(name, back));
      assert.ok(measured >= 3, `${name}: --focus on ${back} is ${measured.toFixed(2)}:1, needs 3:1.`);
    }
  });
}

for (const name of ['paper', 'contrast', 'night']) {
  test(`${name} keeps empty progress cells visible (>= 3:1)`, () => {
    const measured = ratio(token(name, '--meter-line'), token(name, '--surface'));
    assert.ok(measured >= 3, `${name}: --meter-line on --surface is ${measured.toFixed(2)}:1, needs 3:1.`);
  });
}

test('every theme defines a complete palette', () => {
  const names = Object.keys(THEMES.paper).filter(name => !name.startsWith('--space')
    && !name.startsWith('--text') && !name.startsWith('--radius') && !name.startsWith('--z-')
    && !name.startsWith('--font') && !['--border', '--press', '--shadow'].includes(name));
  assert.ok(names.length >= 16, 'The default theme should define the full colour set.');
  for (const theme of ['contrast', 'night']) {
    for (const name of names) assert.ok(token(theme, name), `${theme} is missing ${name}.`);
  }
});

test('the contrast theme removes decorative texture and thickens rules', () => {
  assert.equal(token('contrast', '--texture'), '0');
  assert.equal(token('contrast', '--border'), '3px');
  assert.equal(token('paper', '--texture'), '1');
});

test('dark text is off-white so it cannot halate on near-black', () => {
  assert.notEqual(token('night', '--ink').toLowerCase(), '#fff');
  assert.notEqual(token('night', '--ink').toLowerCase(), '#ffffff');
  assert.ok(luminance(token('night', '--ink')) < 0.95, 'Dark-theme ink should sit below pure white.');
  assert.ok(luminance(token('night', '--bg')) > 0, 'Dark-theme background should not be pure black.');
});

test('no theme hard-codes a colour outside its token block', () => {
  const body = css.slice(css.indexOf('* { box-sizing'));
  const offenders = [...body.matchAll(/#[0-9a-fA-F]{3,8}\b/g)].map(match => match[0]);
  assert.deepEqual(offenders, [], `Use palette tokens instead of literal colours: ${offenders.join(', ')}`);
});
