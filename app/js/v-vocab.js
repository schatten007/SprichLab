import { allPhrases, PHRASES } from '../data/phrases.js';
import { VOCAB } from '../data/vocab.js';
import { CHUNKS } from '../data/chunks.js';
import { reviewStates, nextDue, retained } from './srs.js';
import { phraseForm, bindPhraseForm } from './phrase-form.js';
import { esc, icon, pageHeading, dueLabel, englishMeaning } from './ui.js';

export function render(el, ctx) {
  let filter = 'all';
  let query = '';
  let limit = 24;
  const states = reviewStates(ctx.store.state.attempts);
  const always = ctx.store.state.preferences.englishSupport === 'always';
  el.innerHTML = `${pageHeading('WORDS YOU CAN ACTUALLY USE', 'Your conversation toolkit.', `${PHRASES.length} curated phrases, plus the expressions you collect yourself. Recall first, then use a phrase in your own situation.`)}
    <details class="card phrase-add"><summary>Add a personal phrase</summary>${phraseForm()}</details>
    <div class="phrase-toolbar section-gap"><label class="search-field"><span class="sr-only">Search phrases</span><input id="phrase-search" type="text" placeholder="Find a phrase, meaning, or situation…"></label><a href="#resources" class="btn secondary">${icon('book')}Find phrases in context</a></div>
    <div class="filter-row" role="group" aria-label="Phrase topics">${Object.entries({ all: 'All phrases', personal: 'My saved phrases', interview: 'Interviews', phone: 'Phone calls', time: 'Times & availability', work: 'At work', repair: 'When you get stuck', meeting: 'Meetings', smalltalk: 'Small talk' }).map(([tag, label]) => `<button class="filter-chip" data-filter="${tag}" aria-pressed="${filter === tag}">${label}</button>`).join('')}</div>
    <p id="phrase-count" class="fine" aria-live="polite"></p><div id="phrase-list" class="phrase-grid"></div><button class="btn secondary section-gap" id="more-phrases">Show more phrases</button>
    <details class="reference-collection section-gap"><summary>More reference words &amp; sentence frames <span class="fine">Original collection</span></summary><p class="fine">Extra reference material. Practise it in a sentence of your own.</p>
      <div class="reference-grid">${[...VOCAB.map(word => ({ de: word.german, en: word.english, ex: word.ex })), ...CHUNKS.map(chunk => ({ de: chunk.frame, en: chunk.en, ex: chunk.ex }))].map(entry => `<div><strong lang="de">${esc(entry.de)}</strong>${englishMeaning(entry.en, { always })}<p lang="de">${esc(entry.ex)}</p><button class="text-button" data-say="${esc(entry.ex)}">${icon('volume')} Listen to example</button></div>`).join('')}</div></details>`;
  function draw() {
    const matches = allPhrases(ctx.store.state).filter(phrase => (filter === 'all' || phrase.tags.includes(filter)) && `${phrase.de} ${phrase.en} ${phrase.cueDe} ${phrase.cue}`.toLocaleLowerCase('de').includes(query));
    const visible = matches.slice(0, limit);
    el.querySelector('#phrase-count').textContent = `${visible.length} of ${matches.length} matching phrases`;
    el.querySelector('#more-phrases').hidden = visible.length >= matches.length;
    el.querySelector('#phrase-list').innerHTML = visible.length ? visible.map(phrase => {
      const state = states.get(phrase.id);
      return `<article class="card phrase-card"><div class="pills"><span class="pill ${nextDue(state) !== null && nextDue(state) <= Date.now() ? 'amber' : ''}">${dueLabel(nextDue(state))}</span>${phrase.tags.includes('personal') ? '<span class="pill">Saved by you</span>' : ''}${retained(state) ? '<span class="pill green">Spaced spoken use · self-rated</span>' : ''}</div>
        <h2 lang="de">${esc(phrase.de)}</h2>${englishMeaning(phrase.en, { always })}
        ${phrase.example ? `<p class="phrase-example" lang="de">${esc(phrase.example)}</p>` : ''}<p class="fine" lang="de">${esc(phrase.noteDe ?? '')}</p>${englishMeaning(phrase.note, { always, label: 'Learning note in English' })}
        ${phrase.sourceUrl ? `<a class="inline-link phrase-source" href="${esc(phrase.sourceUrl)}" target="_blank" rel="noopener noreferrer">${esc(phrase.sourceTitle || 'Original source')} ${icon('external')}</a>` : ''}
        <div class="btn-row"><button class="btn secondary small-btn" data-say="${esc(phrase.example || phrase.de)}">${icon('volume')}Listen</button><button class="btn soft small-btn" data-practise="${phrase.id}">Recall aloud ${icon('arrow')}</button></div></article>`;
    }).join('') : '<div class="empty-state"><h3>No matching phrases</h3><p class="muted small">Try a different topic, or add a phrase from your own reading or conversations.</p></div>';
  }
  draw();
  bindPhraseForm(el, ctx, () => { filter = 'personal'; limit = 24; el.querySelectorAll('[data-filter]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.filter === filter))); draw(); });
  el.querySelector('#phrase-search').addEventListener('input', event => { query = event.target.value.trim().toLocaleLowerCase('de'); limit = 24; draw(); });
  el.querySelector('#more-phrases').addEventListener('click', () => { limit += 24; draw(); });
  el.addEventListener('click', async event => {
    const chip = event.target.closest('[data-filter]');
    if (chip) { filter = chip.dataset.filter; limit = 24; el.querySelectorAll('[data-filter]').forEach(button => button.setAttribute('aria-pressed', String(button === chip))); draw(); }
    const say = event.target.closest('[data-say]'); if (say) await ctx.play(say.dataset.say, say);
    const practise = event.target.closest('[data-practise]');
    if (practise && !practise.disabled) { practise.disabled = true; try { await ctx.startReview([practise.dataset.practise]); } catch (error) { ctx.error(error.message); practise.disabled = false; } }
  }, { signal: ctx.signal });
}
