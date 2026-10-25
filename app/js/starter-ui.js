import { createPracticeClock } from './clock.js';
import { lessonById, levelById, topicLabel, skillLabel, LANGUAGE_TOOLS } from '../data/starter-catalog.js';
import { lessonStatus, missingPrerequisites } from './starter-progress.js';
import { esc, icon, duration, safeAction } from './ui.js';

const STATUS_LABELS = { practised: 'Practised', active: 'In progress', new: 'Not practised yet' };
export const lessonMeta = lesson => ({ ...lesson, ...lessonById(lesson.id) });
export function levelPill(level) {
  const entry = levelById(level);
  return `<span class="pill level-${esc(level)}" title="${esc(entry?.goal ?? '')}">${esc(entry ? `${entry.short} · ${entry.label}` : level)}</span>`;
}
export function languageFocus(lesson) {
  const tool = LANGUAGE_TOOLS[lessonMeta(lesson).focus];
  return tool ? `<div class="language-focus"><p class="eyebrow">LANGUAGE FOCUS</p><strong>${esc(tool.title)}</strong><p class="fine">${esc(tool.note)}</p></div>` : '';
}
export function prepLine(course, starter, lessonId) {
  const prep = missingPrerequisites(course, starter, lessonId);
  if (!prep.length) return '';
  return `<p class="small prep-line">Useful first: ${prep.map(item => `<a href="#lesson/${esc(item.id)}">${esc(item.title)}</a>`).join(', ')}</p>`;
}
/** One card shape for the path, the library, and search results. */
export function lessonCard(course, starter, lesson, { showPrep = true } = {}) {
  const meta = lessonMeta(lesson);
  const status = lessonStatus(starter, lesson.id);
  return `<article class="card starter-lesson" data-lesson="${esc(lesson.id)}" data-level="${esc(meta.level)}" data-topic="${esc(meta.topic)}" data-skill="${esc(meta.skill)}" data-status="${status}" data-text="${esc(`${meta.title} ${meta.titleDe} ${lesson.goal ?? ''}`.toLocaleLowerCase('de'))}">
    <div class="pills">${levelPill(meta.level)}<span class="pill">${esc(topicLabel(meta.topic))}</span><span class="pill ${status === 'practised' ? 'green' : status === 'active' ? 'amber' : ''}">${STATUS_LABELS[status]}</span></div>
    <h3>${esc(meta.title)}</h3><p lang="de">${esc(meta.titleDe)}</p>
    <p class="small">${esc(skillLabel(meta.skill))} · ${meta.minutes} min</p>
    ${showPrep ? prepLine(course, starter, lesson.id) : ''}
    <div class="btn-row"><a class="btn secondary" href="#lesson/${esc(lesson.id)}">${status === 'active' ? 'Continue lesson' : status === 'practised' ? 'Practise again' : 'Open lesson'} ${icon('arrow')}</a><a class="text-button" href="#gemini/${esc(lesson.id)}">Export for Gemini</a></div></article>`;
}
export function supportButtons(id, { guided = 'Start guided', light = 'Try with less help' } = {}) {
  return `<div class="btn-row"><button class="btn" data-start-lesson="${esc(id)}" data-support="guided">${guided} ${icon('arrow')}</button><button class="btn secondary" data-start-lesson="${esc(id)}" data-support="light">${light}</button></div>`;
}
export function bindSupportButtons(el, ctx) {
  el.querySelectorAll('[data-start-lesson]').forEach(button => safeAction(button,
    () => ctx.startStarter(button.dataset.startLesson, { support: button.dataset.support }), ctx.error));
}

export function pathPicker(state) {
  return `<label class="path-picker">Learning path<select aria-label="Learning path" data-learning-path><option value="starter" ${state.preferences.learningPath === 'starter' ? 'selected' : ''}>Start speaking · near-beginner</option><option value="work" ${state.preferences.learningPath === 'work' ? 'selected' : ''}>Workplace course · A2–B1</option></select></label>`;
}
export function bindPathPicker(el, ctx) {
  el.querySelector('[data-learning-path]')?.addEventListener('change', async event => {
    try { await ctx.store.update(state => { state.preferences.learningPath = event.target.value; }); await ctx.refresh(); }
    catch (error) { ctx.error(error.message); }
  });
}
export function courseError(el, ctx, error) {
  if (ctx.signal?.aborted) return;
  el.innerHTML = `<section class="card"><p class="eyebrow">START SPEAKING</p><h1 tabindex="-1">Save your course for offline practice.</h1><p class="section-gap" role="alert">${esc(error.message)}</p><div class="btn-row"><button class="btn" data-retry-course>Try again</button><a class="btn secondary" href="#practice">Open workplace missions</a><a href="#settings">Settings &amp; backups</a></div></section>`;
  safeAction(el.querySelector('[data-retry-course]'), () => ctx.refresh(), ctx.error);
}
export function wordCard(word, { saved = false, actions = true } = {}) {
  return `<article class="card starter-word"><span class="pill">${esc(word.pos)}</span><h3 lang="de">${esc(word.de)}</h3><p class="word-meaning" lang="en">${esc(word.en)}</p>${word.forms ? `<p class="word-forms small">${esc(word.forms)}</p>` : ''}
    <p lang="de" class="word-example">${esc(word.exampleDe)}</p><p class="small" lang="en">${esc(word.exampleEn)}</p>
    <div class="btn-row"><button class="text-button" data-say="${esc(word.de)}">${icon('volume')}Hear word</button><button class="text-button" data-say="${esc(word.exampleDe)}">Hear sentence</button></div>
    ${actions ? `<div class="btn-row"><button class="btn secondary small-btn" data-word-practice="${word.id}">Say from memory</button><button class="text-button" data-save-word="${word.id}" aria-pressed="${saved}">${saved ? 'Saved word' : 'Save word'}</button></div>` : ''}</article>`;
}
export function bindWordActions(el, ctx, onSaved = () => {}) {
  el.addEventListener('click', async event => {
    const say = event.target.closest('[data-say]');
    if (say && !say.disabled) await ctx.play(say.dataset.say, say);
    const practise = event.target.closest('[data-word-practice]');
    if (practise && !practise.disabled) {
      practise.disabled = true;
      try { await ctx.startWordPractice([practise.dataset.wordPractice], 'recall'); }
      catch (error) { ctx.error(error.message); practise.disabled = false; }
    }
    const save = event.target.closest('[data-save-word]');
    if (save && !save.disabled) {
      const saved = save.getAttribute('aria-pressed') !== 'true';
      save.disabled = true;
      try {
        await ctx.store.saveWord(save.dataset.saveWord, saved);
        if (!ctx.signal?.aborted && save.isConnected) { save.setAttribute('aria-pressed', String(saved)); save.textContent = saved ? 'Saved word' : 'Save word'; onSaved(save.dataset.saveWord, saved); }
      }
      catch (error) { ctx.error(error.message); }
      finally { save.disabled = false; }
    }
  }, { signal: ctx.signal });
}
export function startStarterClock(ctx, sessionId, el) {
  const update = ({ paused = false } = {}) => {
    const label = el.querySelector('[data-starter-time]');
    if (!label) return;
    const ms = ctx.store.state.activity.filter(event => event.sessionId === sessionId).reduce((total, event) => total + event.ms, 0);
    label.textContent = `${duration(ms)} saved active practice${paused ? ' · paused' : ''}`;
  };
  const clock = createPracticeClock({ sessionId, timeZone: ctx.store.state.preferences.timeZone,
    onSegments: async segments => { await ctx.store.addActivity(segments); update(); }, onTick: update });
  clock.start(); update();
  return clock;
}
export function mountCompanionReflection(host, ctx, lessonId) {
  host.innerHTML = `<section class="card"><p class="eyebrow">AFTER GEMINI</p><h2>Keep one thing you can say.</h2><form data-companion-reflection><label class="section-gap">Your takeaway<textarea name="text" aria-label="Your takeaway" maxlength="6000" required placeholder="A sentence I said, one thing to practise, and a useful new word…"></textarea></label><label class="outside-time">Minutes with Gemini (self-reported)<input type="number" name="minutes" min="0" max="120" step="1" value="5"></label><button class="btn secondary" type="submit">Save Gemini takeaway</button><p class="fine section-gap" data-note-status role="status">Saved separately from measured practice and word recall.</p></form></section>`;
  let saving = false;
  host.querySelector('form').addEventListener('submit', async event => {
    event.preventDefault(); if (saving) return; saving = true;
    const button = event.submitter; if (button) button.disabled = true;
    try {
      const values = new FormData(event.target);
      await ctx.store.addCompanionNote({ id: crypto.randomUUID(), missionId: lessonId, text: String(values.get('text')), minutes: Number(values.get('minutes')) });
      host.querySelector('[data-note-status]').textContent = 'Gemini takeaway saved. You can find it in Progress.';
      event.target.reset();
    } catch (error) { ctx.error(error.message); }
    finally { saving = false; if (button?.isConnected) button.disabled = false; }
  });
}
