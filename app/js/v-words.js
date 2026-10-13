import { STARTER_UNITS } from '../data/starter-catalog.js';
import { loadStarterCourse } from './starter-content.js';
import { starterDraft } from './starter-state.js';
import { dueWords, wordMemories } from './starter-progress.js';
import { journalDraft, clearJournal } from './draft-journal.js';
import { wordCard, bindWordActions, courseError, startStarterClock } from './starter-ui.js';
import { esc, icon, pageHeading, safeAction, provenance, howLink } from './ui.js';

const modeLabels = { meaning: 'Recognise the meaning', recall: 'Say the German word', sentence: 'Use it in a sentence' };

export async function render(el, ctx) {
  el.innerHTML = pageHeading('USEFUL WORDS', 'Vocabulary you can use.', 'Opening your starter word collection…');
  let course;
  try { course = await loadStarterCourse(ctx.store, { signal: ctx.signal }); } catch (error) { courseError(el, ctx, error); return; }
  if (ctx.signal.aborted) return;
  let query = ''; let unit = 'all'; let pos = 'all'; let savedOnly = false; let limit = 12; let mode = 'recall';
  el.innerHTML = `${pageHeading('UNDERSTAND IT. SAY IT. USE IT.', 'Vocabulary you can use.', `${course.words.length} beginner-friendly words with English meanings, useful forms, and examples. Start with five words, then bring them into a conversation.`)}
    <div class="practice-toolbar"><a class="btn secondary" href="#lessons">Learn words in lessons ${icon('arrow')}</a><a class="inline-link" href="#phrases">Useful phrases &amp; your own collection</a></div>
    <section class="card section-gap"><div class="card-title"><h2>A small word practice</h2>${provenance('self-rated')}</div>
      <div class="btn-row segmented" role="radiogroup" aria-label="Practice mode">${Object.entries(modeLabels).map(([value, label]) => `<button class="btn secondary" role="radio" data-word-mode="${value}" aria-checked="${mode === value}" tabindex="${mode === value ? 0 : -1}">${label}</button>`).join('')}</div>
      <select id="word-mode" aria-label="Practice mode" hidden>${Object.entries(modeLabels).map(([value, label]) => `<option value="${value}" ${mode === value ? 'selected' : ''}>${label}</option>`).join('')}</select>
      <p class="fine section-gap" id="word-review-count" role="status"></p><div class="btn-row"><button class="btn" id="learn-words">Learn five words</button><button class="btn secondary" id="review-words">Review due words</button></div><div id="resume-words"></div><div class="status-foot">${howLink()}</div></section>
    <section class="card section-gap"><details class="word-filters"><summary>Filter</summary><div class="form-grid section-gap"><label>Search words<input type="text" id="word-search" placeholder="German, English, or an example…"></label><label>Topic<select id="word-unit"><option value="all">All topics</option>${STARTER_UNITS.map((name, index) => `<option value="${index + 1}">${esc(name)}</option>`).join('')}</select></label><label>Word type<select id="word-pos"><option value="all">All word types</option>${['noun', 'verb', 'adjective', 'adverb', 'pronoun', 'number', 'preposition', 'conjunction', 'expression', 'language'].map(type => `<option value="${type}">${type}</option>`).join('')}</select></label><label class="check-label"><input type="checkbox" id="saved-words">My saved words only</label></div></details></section>
    <p id="word-count" class="fine section-gap" aria-live="polite"></p><div class="starter-grid" id="word-cards"></div><button class="btn secondary section-gap" id="more-words">Show more words</button>`;
  function matches() {
    const saved = new Set(ctx.store.state.starter.wordMarks.filter(mark => mark.saved).map(mark => mark.id));
    return course.words.filter(word => (unit === 'all' || word.unit === Number(unit)) && (pos === 'all' || word.pos === pos)
      && (!savedOnly || saved.has(word.id)) && `${word.de} ${word.en} ${word.exampleDe} ${word.exampleEn}`.toLocaleLowerCase('de').includes(query));
  }
  function draw() {
    const state = ctx.store.state.starter;
    const words = matches();
    const visible = words.slice(0, limit);
    el.querySelector('#word-cards').innerHTML = visible.map(word => wordCard(word, { saved: state.wordMarks.some(mark => mark.id === word.id && mark.saved) })).join('') || '<div class="card"><h2>No matching words.</h2><p class="fine section-gap">Try another topic, a shorter search, or turn off the saved-words filter.</p></div>';
    el.querySelector('#word-count').textContent = `${visible.length} of ${words.length} matching words`;
    el.querySelector('#more-words').hidden = visible.length === words.length;
    const due = dueWords(course, state, mode);
    el.querySelector('#word-review-count').textContent = `${due.length} words due for “${modeLabels[mode]}”. Try first, then reveal and compare.`;
    el.querySelector('#review-words').disabled = !due.length;
    el.querySelector('#learn-words').disabled = !words.length;
    const active = [...state.wordSessions].filter(session => !session.completedAt).sort((a, b) => b.updatedAt - a.updatedAt)[0];
    el.querySelector('#resume-words').innerHTML = active ? `<a class="inline-link section-gap" href="#word-session/${active.id}">Resume word practice · ${esc(modeLabels[active.mode])}</a>` : '';
  }
  draw(); bindWordActions(el, ctx, (_id, saved) => { if (savedOnly && !saved) draw(); });
  el.querySelector('#word-search').addEventListener('input', event => { query = event.target.value.trim().toLocaleLowerCase('de'); limit = 12; draw(); });
  el.querySelector('#word-unit').addEventListener('change', event => { unit = event.target.value; limit = 12; draw(); });
  el.querySelector('#word-pos').addEventListener('change', event => { pos = event.target.value; limit = 12; draw(); });
  el.querySelector('#saved-words').addEventListener('change', event => { savedOnly = event.target.checked; limit = 12; draw(); });
  const modes = [...el.querySelectorAll('[data-word-mode]')];
  const chooseMode = value => {
    mode = value;
    el.querySelector('#word-mode').value = mode;
    modes.forEach(button => { button.setAttribute('aria-checked', String(button.dataset.wordMode === mode)); button.tabIndex = button.dataset.wordMode === mode ? 0 : -1; });
    draw();
  };
  modes.forEach(button => button.addEventListener('click', () => chooseMode(button.dataset.wordMode)));
  el.querySelector('[role="radiogroup"]').addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const index = modes.findIndex(button => button.dataset.wordMode === mode);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? modes.length - 1 : (index + (['ArrowLeft', 'ArrowUp'].includes(event.key) ? -1 : 1) + modes.length) % modes.length;
    chooseMode(modes[next].dataset.wordMode); modes[next].focus();
  });
  el.querySelector('#word-mode').addEventListener('change', event => chooseMode(event.target.value));
  el.querySelector('#more-words').addEventListener('click', () => {
    const firstNew = limit;
    limit += 12; draw();
    const heading = el.querySelectorAll('#word-cards h3')[firstNew];
    heading?.setAttribute('tabindex', '-1'); heading?.focus();
  });
  safeAction(el.querySelector('#learn-words'), () => {
    const known = wordMemories(ctx.store.state.starter, mode);
    const words = matches();
    const fresh = words.filter(word => !known.has(word.id));
    return ctx.startWordPractice((fresh.length ? fresh : words).slice(0, 5).map(word => word.id), mode);
  }, ctx.error);
  safeAction(el.querySelector('#review-words'), () => ctx.startWordPractice(dueWords(course, ctx.store.state.starter, mode).slice(0, 10).map(word => word.id), mode), ctx.error);
}

export async function renderSession(el, ctx, id) {
  let session = ctx.store.state.starter.wordSessions.find(item => item.id === id);
  if (!session) throw new Error('This word practice is not saved here. Open Vocabulary to start.');
  let draft; let word; let busy = false; let alive = true; let pendingSave = Promise.resolve();
  el.innerHTML = `<a class="inline-link" href="#words">${icon('back')}Vocabulary</a>${pageHeading('A FEW WORDS, OFTEN', modeLabels[session.mode], 'Try first. Compare with the model. Choose an honest self-rating.')}
    <div class="starter-session-meta"><span id="word-position"></span><span class="fine" data-starter-time></span></div><section class="card section-gap" id="word-task"></section><div class="status-foot">${provenance('self-rated')} ${howLink()}</div>`;
  const clock = startStarterClock(ctx, id, el);
  function persist() {
    if (!word || !draft || session.completedAt) return pendingSave;
    const copy = structuredClone(draft); const wordId = word.id;
    const journal = journalDraft(id, wordId, copy, 'word');
    pendingSave = pendingSave.then(() => ctx.store.saveWordDraft(id, wordId, copy)).then(() => clearJournal(id, journal));
    return pendingSave;
  }
  function draw() {
    if (!alive) return;
    session = ctx.store.state.starter.wordSessions.find(item => item.id === id);
    const host = el.querySelector('#word-task');
    el.querySelector('#word-position').textContent = `${Math.min(session.cursor + 1, session.words.length)} / ${session.words.length} words · ${modeLabels[session.mode]}`;
    if (session.completedAt) {
      const reviews = ctx.store.state.starter.reviews.filter(review => review.sessionId === id);
      host.innerHTML = `<p class="eyebrow">PRACTICE SAVED</p><h2 tabindex="-1">A small batch, ready to reuse.</h2><p class="section-gap">${reviews.length} word reviews saved. Bring these words into your next conversation.</p><div class="btn-row"><a class="btn" href="#words">Back to Vocabulary</a><a class="btn secondary" href="#lessons">Use words in a lesson</a></div>`;
      word = null; draft = null; host.querySelector('h2').focus(); return;
    }
    word = session.words[session.cursor];
    draft = { ...starterDraft(), ...session.drafts[word.id] };
    const meaning = session.mode === 'meaning';
    const sentence = session.mode === 'sentence';
    host.innerHTML = `<p class="eyebrow">${meaning ? 'WHAT DOES IT MEAN?' : sentence ? 'MAKE YOUR OWN SHORT SENTENCE' : 'SAY THIS IN GERMAN'}</p><h2 tabindex="-1" lang="${meaning || sentence ? 'de' : 'en'}">${esc(meaning || sentence ? word.de : word.en)}</h2>
      ${sentence ? `<p lang="en" class="section-gap">${esc(word.en)}</p>` : ''}<p class="fine section-gap">${meaning ? 'Think of the English meaning before revealing it.' : sentence ? 'Use this word in a sentence about your own situation. You can keep written notes below.' : 'Try saying the German word. Include the article if it is a noun.'}</p>
      <label class="check-label"><input type="checkbox" id="word-attempted" ${draft.attempted ? 'checked' : ''} ${draft.revealed ? 'disabled' : ''}>${meaning ? 'I tried to remember the meaning' : sentence ? 'I tried my own sentence aloud' : 'I tried saying the German word'}</label>
      <label>Optional notes<textarea id="word-notes" aria-label="Optional notes" maxlength="6000" rows="2" ${draft.revealed ? 'disabled' : ''}>${esc(draft.text)}</textarea></label>
      <button class="btn section-gap" id="reveal-word" ${draft.revealed ? 'hidden' : ''}>Reveal ${meaning ? 'meaning' : 'word and example'}</button>
      <div id="word-answer" ${draft.revealed ? '' : 'hidden'}><div class="starter-pattern"><h3 lang="de">${esc(word.de)}</h3><p lang="en">${esc(word.en)}</p><p class="fine">${esc(word.forms)}</p><p lang="de">${esc(word.exampleDe)}</p><p lang="en">${esc(word.exampleEn)}</p><div class="btn-row"><button class="text-button" data-say="${esc(word.de)}">${icon('volume')}Hear word</button><button class="text-button" data-say="${esc(word.exampleDe)}">Hear example</button></div></div>
      <p class="fine">${draft.hintUsed ? 'You revealed the answer before an attempt. Choose With help or Again.' : 'Compare your attempt with the model. This is a self-rating.'}</p>${!meaning && !draft.attempted ? `<label class="check-label"><input type="checkbox" id="word-supported" ${draft.aloud ? 'checked' : ''}>I repeated a supported answer aloud</label>` : ''}<div class="btn-row"><button class="btn secondary" data-word-grade="again">Again</button><button class="btn secondary" data-word-grade="helped">With help</button><button class="btn" data-word-grade="independent" ${!draft.attempted || draft.hintUsed ? 'disabled' : ''}>${meaning ? 'Remembered the meaning' : sentence ? 'Used it myself' : 'Said from memory'}</button></div></div>`;
    host.querySelector('#word-attempted').addEventListener('change', event => {
      draft.attempted = event.target.checked;
      draft.aloud = !meaning && event.target.checked;
      void persist().catch(error => ctx.error(error.message));
    });
    host.querySelector('#word-notes').addEventListener('input', event => { draft.text = event.target.value; void persist().catch(error => ctx.error(error.message)); });
    host.querySelector('#word-supported')?.addEventListener('change', event => { draft.aloud = event.target.checked; void persist().catch(error => ctx.error(error.message)); });
    safeAction(host.querySelector('#reveal-word'), async () => {
      draft.hintUsed = !draft.attempted; draft.revealed = true;
      await persist(); draw();
    }, ctx.error);
    host.querySelectorAll('[data-word-grade]').forEach(button => safeAction(button, async () => {
      if (busy) return; busy = true;
      try {
        await persist(); ctx.speech.stop();
        await ctx.store.saveWordReview(id, word.id, draft, button.dataset.wordGrade);
        draw();
      } finally { busy = false; }
    }, ctx.error));
    host.querySelector('h2').focus();
  }
  el.addEventListener('click', event => { const say = event.target.closest('[data-say]'); if (say) void ctx.play(say.dataset.say, say); }, { signal: ctx.signal });
  draw();
  return async () => { alive = false; await persist(); await pendingSave; await clock.stop(); ctx.speech.stop(); };
}
