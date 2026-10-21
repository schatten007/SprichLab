import { allPhrases, PHRASES } from '../data/phrases.js';
import { VOCAB } from '../data/vocab.js';
import { CHUNKS } from '../data/chunks.js';
import { reviewStates, nextDue, retained } from './srs.js';
import { phraseForm, bindPhraseForm, sharedCapture } from './phrase-form.js';
import { lookupTatoebaExamples } from './tatoeba.js';
import { esc, icon, pageHeading, dueLabel, englishMeaning } from './ui.js';

export function render(el, ctx) {
  let filter = 'all';
  let query = '';
  let limit = 24;
  const states = reviewStates(ctx.store.state.attempts);
  const always = ctx.store.state.preferences.englishSupport === 'always';
  const shared = ctx.sharedCapture ?? sharedCapture();
  const hasShared = Boolean(shared?.text || shared?.sourceUrl || shared?.rejected);
  const sharedSource = shared?.sourceUrl ? { url: shared.sourceUrl, title: 'Shared source' } : null;
  const exampleResults = new Map();
  el.innerHTML = `<section class="phrase-collection" role="region" aria-label="Phrase collection">
    ${pageHeading('SPOKEN PHRASE BANK', 'Your conversation toolkit.', `${PHRASES.length} curated phrases, plus the expressions you collect yourself. Recall first, then use a phrase in your own situation.`)}
    <div class="phrase-collection-header"><div><div class="pills"><span class="pill">SPOKEN BANK · ${PHRASES.length} PHRASES</span><span class="pill">Curated offline ready</span></div><p class="fine">Situational prompts and your own real-world German chunks, kept local and scheduled by honest self-rating.</p></div><button class="btn" id="open-capture" type="button">${icon('book')}Capture phrase</button></div>
    <div class="phrase-offline-notice"><strong>Data &amp; network rule:</strong><span>Curated phrase audio works offline. Tatoeba example lookups require an active connection.</span><span class="pill">Checked locally</span></div>
    <details id="phrase-capture" class="card phrase-add" ${hasShared ? 'open' : ''}><summary>${hasShared ? 'Save shared phrase' : 'Add a personal phrase'}</summary>${hasShared ? `<p class="callout ${shared.rejected ? 'error' : ''}">${esc(shared.rejected ? shared.error : shared.tooLong ? 'That shared text is longer than one phrase. Select one sentence or edit it below.' : 'Your shared German text is ready. Check the meaning before saving.')}</p>` : ''}${phraseForm(sharedSource, shared?.text ?? '')}</details>
    <div class="phrase-library section-gap"><aside class="phrase-filter-panel"><section class="card"><div class="card-title"><h2>Situational channels</h2><span class="pill">${Object.keys({ all: 1, personal: 1, interview: 1, phone: 1, time: 1, work: 1, repair: 1, meeting: 1, smalltalk: 1 }).length} filters</span></div><div class="filter-row" role="group" aria-label="Phrase topics">${Object.entries({ all: 'All phrases', personal: 'My saved phrases', interview: 'Interviews', phone: 'Phone calls', time: 'Times & availability', work: 'At work', repair: 'When you get stuck', meeting: 'Meetings', smalltalk: 'Small talk' }).map(([tag, label]) => `<button class="filter-chip" data-filter="${tag}" aria-pressed="${filter === tag}">${label}</button>`).join('')}</div></section></aside>
      <section class="phrase-results"><div class="phrase-toolbar"><label class="search-field"><span class="sr-only">Search phrases</span><input id="phrase-search" type="text" placeholder="Find a phrase, meaning, or situation…"></label><a href="#resources" class="btn secondary">${icon('book')}Find phrases in context</a></div><p id="phrase-count" class="fine" aria-live="polite"></p><div id="phrase-list" class="phrase-grid"></div><button class="btn secondary section-gap" id="more-phrases">Show more phrases</button></section>
    </div>
    <details class="reference-collection section-gap"><summary>More reference words &amp; sentence frames <span class="fine">Original collection</span></summary><p class="fine">Extra reference material. Practise it in a sentence of your own.</p>
      <div class="reference-grid">${[...VOCAB.map(word => ({ de: word.german, en: word.english, ex: word.ex })), ...CHUNKS.map(chunk => ({ de: chunk.frame, en: chunk.en, ex: chunk.ex }))].map(entry => `<div><strong lang="de">${esc(entry.de)}</strong>${englishMeaning(entry.en, { always })}<p lang="de">${esc(entry.ex)}</p><button class="text-button" data-say="${esc(entry.ex)}">${icon('volume')} Listen to example</button></div>`).join('')}</div></details></section>`;
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
        ${phrase.exampleSourceUrl ? `<a class="inline-link phrase-source" href="${esc(phrase.exampleSourceUrl)}" target="_blank" rel="noopener noreferrer">${esc(phrase.exampleSourceTitle || 'Example source')} ${icon('external')}</a>` : ''}
        <div class="btn-row"><button class="btn secondary small-btn" data-say="${esc(phrase.example || phrase.de)}">${icon('volume')}Listen</button><button class="btn soft small-btn" data-practise="${phrase.id}">Recall aloud ${icon('arrow')}</button></div>
        ${phrase.tags.includes('personal') ? `<div class="phrase-examples"><button class="text-button" data-find-examples="${esc(phrase.id)}">Find a free example</button><div data-example-results="${esc(phrase.id)}"></div></div>` : ''}</article>`;
    }).join('') : '<div class="empty-state"><h3>No matching phrases</h3><p class="muted small">Try a different topic, or add a phrase from your own reading or conversations.</p></div>';
  }
  draw();
  el.querySelector('#open-capture').addEventListener('click', () => {
    const capture = el.querySelector('#phrase-capture');
    capture.open = true;
    capture.scrollIntoView({ block: 'nearest' });
    capture.querySelector('input[name="de"]')?.focus();
  });
  bindPhraseForm(el, ctx, () => {
    if (hasShared) ctx.clearSharedCapture?.();
    filter = 'personal'; limit = 24; el.querySelectorAll('[data-filter]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.filter === filter))); draw();
  });
  el.querySelector('#phrase-search').addEventListener('input', event => { query = event.target.value.trim().toLocaleLowerCase('de'); limit = 24; draw(); });
  el.querySelector('#more-phrases').addEventListener('click', () => { limit += 24; draw(); });
  el.addEventListener('click', async event => {
    const chip = event.target.closest('[data-filter]');
    if (chip) { filter = chip.dataset.filter; limit = 24; el.querySelectorAll('[data-filter]').forEach(button => button.setAttribute('aria-pressed', String(button === chip))); draw(); }
    const find = event.target.closest('[data-find-examples]');
    if (find && !find.disabled) {
      find.disabled = true;
      const phraseId = find.dataset.findExamples;
      const host = find.closest('.phrase-card')?.querySelector('[data-example-results]');
      if (host) host.innerHTML = '<p class="fine">Searching Tatoeba… The phrase text is sent to its public API.</p>';
      try {
        const phrase = allPhrases(ctx.store.state).find(item => item.id === phraseId);
        const examples = await lookupTatoebaExamples(phrase?.de, { signal: ctx.signal });
        exampleResults.set(phraseId, examples);
        if (host) host.innerHTML = examples.length ? examples.map((item, index) => `<div class="phrase-example-result"><p lang="de">${esc(item.de)}</p><p lang="en">${esc(item.en)}</p><p class="fine">${esc(item.sourceTitle)}</p><button class="text-button" data-use-example="${index}" data-phrase="${esc(phraseId)}">Use this example</button></div>`).join('') : '<p class="fine">No English-linked examples were found. Try the phrase without punctuation.</p>';
      } catch (error) { if (!ctx.signal.aborted && host) host.innerHTML = `<p class="callout error">${esc(error.message)}</p>`; }
      finally { if (find.isConnected) find.disabled = false; }
      return;
    }
    const use = event.target.closest('[data-use-example]');
    if (use && !use.disabled) {
      use.disabled = true;
      try {
        const phraseId = use.dataset.phrase;
        const example = exampleResults.get(phraseId)?.[Number(use.dataset.useExample)];
        const phrase = allPhrases(ctx.store.state).find(item => item.id === phraseId);
        const personalId = phrase?.personalId ?? phrase?.id;
        if (!example || !personalId) throw new Error('Choose a saved phrase before adding an example.');
        await ctx.store.update(state => {
          const saved = state.personalPhrases.find(item => item.id === personalId);
          if (!saved) throw new Error('This saved phrase is no longer available.');
          saved.example = example.de;
          saved.exampleSourceUrl = example.sourceUrl;
          saved.exampleSourceTitle = example.sourceTitle;
        });
        ctx.notify('Tatoeba example saved with its attribution.');
        draw();
      } catch (error) { ctx.error(error.message); use.disabled = false; }
      return;
    }
    const say = event.target.closest('[data-say]'); if (say) await ctx.play(say.dataset.say, say);
    const practise = event.target.closest('[data-practise]');
    if (practise && !practise.disabled) { practise.disabled = true; try { await ctx.startReview([practise.dataset.practise]); } catch (error) { ctx.error(error.message); practise.disabled = false; } }
  }, { signal: ctx.signal });
}
