import { COURSE_LEVELS, COURSE_SKILLS, COURSE_TOPICS, moduleById } from '../data/starter-catalog.js';
import { loadCourse, starterSnapshot, lessonDialogues } from './starter-content.js';
import { starterSteps, starterDraft, supportOf } from './starter-state.js';
import { dueWords, recommendNext, stageSummary, currentStage, pathLessons, lessonStatus, practisedLessons } from './starter-progress.js';
import { mountRecording } from './recording-ui.js';
import { journalDraft, clearJournal } from './draft-journal.js';
import { mountGeminiExport } from './gemini-export.js';
import { starterGeminiSource } from './gemini-pack.js';
import { courseError, wordCard, bindWordActions, pathPicker, bindPathPicker, startStarterClock, mountCompanionReflection,
  lessonCard, lessonMeta, levelPill, languageFocus, prepLine, supportButtons, bindSupportButtons } from './starter-ui.js';
import { esc, icon, pageHeading, safeAction, duration, progressBar } from './ui.js';
import { dateKey } from './model.js';

export async function render(el, ctx) {
  el.innerHTML = pageHeading('YOUR PATH', 'Small lessons, in a useful order.', 'Opening your course…');
  let course;
  try { course = await loadCourse(ctx.store, { signal: ctx.signal }); } catch (error) { courseError(el, ctx, error); return; }
  if (ctx.signal.aborted) return;
  const starter = ctx.store.state.starter;
  const stages = stageSummary(course, starter);
  const stageIndex = Math.max(0, stages.findIndex(item => item.done < item.total));
  const stage = stages[stageIndex];
  const next = recommendNext(course, starter);
  const practised = practisedLessons(starter);
  const nextMeta = lessonMeta(next.lesson);
  let view = 'path';
  el.innerHTML = `${pageHeading('YOUR PATH', 'Small lessons, in a useful order.', `${course.lessons.length} lessons from first words to work conversations. Every lesson stays open — the path only suggests what comes next.`)}
    <div class="practice-toolbar"><div class="btn-row" role="tablist" aria-label="Lesson view"><button class="btn" id="view-path" role="tab" aria-selected="true">My path</button><button class="btn secondary" id="view-all" role="tab" aria-selected="false">All lessons</button></div>
      <div class="btn-row"><a class="btn secondary" href="#words">Vocabulary ${icon('book')}</a><a class="inline-link" href="#practice">Workplace missions · A2–B1</a></div></div>
    <section id="path-view">
      <section class="card section-gap next-lesson"><div class="card-title"><div><p class="eyebrow">RECOMMENDED NEXT · STAGE ${stageIndex + 1} OF ${stages.length}</p><h2>${esc(nextMeta.title)}</h2></div>${levelPill(nextMeta.level)}</div>
        <p lang="de" class="starter-model">${esc(nextMeta.titleDe)}</p><p>${esc(next.lesson.goal)}</p>
        <p class="fine">${esc(next.reason)}</p>
        ${next.prep.length ? `<p class="fine prep-line">Useful first: ${next.prep.map(item => `<a href="#lesson/${esc(item.id)}">${esc(item.title)}</a>`).join(', ')}</p>` : ''}
        ${next.session ? `<div class="btn-row"><a class="btn" href="#learn/${esc(next.session.id)}">Continue lesson ${icon('arrow')}</a><a class="text-button" href="#lesson/${esc(next.lesson.id)}">See the lesson first</a></div>` : supportButtons(next.lesson.id)}</section>
      <div class="stage-list section-gap">${stages.map((item, index) => `<section class="card stage-card ${item.stage.id === stage.stage.id ? 'current-stage' : ''}"><div class="card-title"><div><p class="eyebrow">STAGE ${index + 1} · ${esc(item.stage.title)}</p><h3>${esc(item.stage.lede)}</h3></div><span class="pill ${item.done === item.total ? 'green' : ''}">${item.done} / ${item.total}</span></div>
        ${progressBar(item.total ? item.done / item.total * 100 : 0, `${item.stage.title} progress`)}
        <ol class="stage-lessons">${item.lessons.map(lesson => { const meta = lessonMeta(lesson); const status = lessonStatus(starter, lesson.id);
          return `<li class="${status}"><a href="#lesson/${esc(lesson.id)}"><span>${status === 'practised' ? icon('check') : status === 'active' ? icon('clock') : `<em>${meta.number}</em>`}</span><span><strong>${esc(meta.title)}</strong><small>${esc(meta.level === 'starter' ? 'Starter' : meta.level)} · ${esc(moduleById(meta.module).title)}</small></span></a></li>`;
        }).join('')}</ol></section>`).join('')}</div></section>
    <section id="all-view" hidden><section class="card section-gap"><div class="form-grid">
      <label>Search lessons<input type="text" id="lesson-search" placeholder="Situation, German phrase, or goal…"></label>
      <label>Level<select id="lesson-level"><option value="all">All levels</option>${COURSE_LEVELS.map(level => `<option value="${level.id}">${esc(level.short)} · ${esc(level.label)}</option>`).join('')}</select></label>
      <label>Topic<select id="lesson-topic"><option value="all">All topics</option>${COURSE_TOPICS.map(topic => `<option value="${topic.id}">${esc(topic.label)}</option>`).join('')}</select></label>
      <label>Speaking skill<select id="lesson-skill"><option value="all">All skills</option>${COURSE_SKILLS.map(skill => `<option value="${skill.id}">${esc(skill.label)}</option>`).join('')}</select></label>
      <label>Status<select id="lesson-status"><option value="all">Any status</option><option value="new">Not practised yet</option><option value="active">In progress</option><option value="practised">Practised</option></select></label>
      </div><p class="fine section-gap" id="lesson-count" aria-live="polite"></p></section>
      <div class="starter-grid" id="lesson-cards">${pathLessons(course).map(lesson => lessonCard(course, starter, lesson)).join('')}</div>
      <p class="card section-gap" id="lesson-empty" hidden>No lesson matches these filters. Clear the search or choose another level.</p></section>`;
  bindSupportButtons(el, ctx);
  const cards = [...el.querySelectorAll('#lesson-cards [data-lesson]')];
  const filter = () => {
    const query = el.querySelector('#lesson-search').value.trim().toLocaleLowerCase('de');
    const level = el.querySelector('#lesson-level').value;
    const topic = el.querySelector('#lesson-topic').value;
    const skill = el.querySelector('#lesson-skill').value;
    const status = el.querySelector('#lesson-status').value;
    let shown = 0;
    for (const card of cards) {
      const visible = (level === 'all' || card.dataset.level === level) && (topic === 'all' || card.dataset.topic === topic)
        && (skill === 'all' || card.dataset.skill === skill) && (status === 'all' || card.dataset.status === status)
        && card.dataset.text.includes(query);
      card.hidden = !visible;
      if (visible) shown++;
    }
    el.querySelector('#lesson-count').textContent = `${shown} of ${cards.length} lessons · ${practised.size} practised`;
    el.querySelector('#lesson-empty').hidden = shown > 0;
  };
  filter();
  ['#lesson-search', '#lesson-level', '#lesson-topic', '#lesson-skill', '#lesson-status']
    .forEach(selector => el.querySelector(selector).addEventListener('input', filter));
  const show = next => {
    view = next;
    el.querySelector('#path-view').hidden = view !== 'path';
    el.querySelector('#all-view').hidden = view !== 'all';
    el.querySelector('#view-path').className = `btn ${view === 'path' ? '' : 'secondary'}`;
    el.querySelector('#view-all').className = `btn ${view === 'all' ? '' : 'secondary'}`;
    el.querySelector('#view-path').setAttribute('aria-selected', String(view === 'path'));
    el.querySelector('#view-all').setAttribute('aria-selected', String(view === 'all'));
  };
  el.querySelector('#view-path').addEventListener('click', () => show('path'));
  el.querySelector('#view-all').addEventListener('click', () => show('all'));
}

export async function renderOverview(el, ctx, id) {
  let course;
  try { course = await loadCourse(ctx.store, { signal: ctx.signal }); } catch (error) { courseError(el, ctx, error); return; }
  if (ctx.signal.aborted) return;
  const starter = ctx.store.state.starter;
  const active = starter.sessions.find(session => session.lessonId === id && !session.completedAt);
  const content = active?.content ?? starterSnapshot(course, id);
  const lesson = content.lesson;
  const meta = lessonMeta(lesson);
  const done = starter.sessions.filter(session => session.lessonId === id && session.completedAt).length;
  el.innerHTML = `<a class="inline-link" href="#lessons">${icon('back')}Your path</a>${pageHeading(`${esc(meta.moduleTitle ?? '')} · LESSON ${meta.number}`, lesson.title, lesson.goal)}
    <div class="pills section-gap">${levelPill(meta.level)}<span class="pill">${esc(meta.register === 'Sie' ? 'Sie · polite' : 'du · informal')}</span><span class="pill">${meta.minutes} min</span>${done ? `<span class="pill green">Practised ${done}×</span>` : ''}${lessonDialogues(lesson).length > 1 ? `<span class="pill">${lessonDialogues(lesson).length} model conversations</span>` : ''}</div>
    ${prepLine(course, starter, id)}
    <section class="card starter-first section-gap"><p class="eyebrow">YOUR FIRST WORDS</p><h2 lang="de">${esc(lesson.warmup.de)}</h2><p lang="en">${esc(lesson.warmup.en)}</p>
      <div class="btn-row"><button class="btn secondary" data-say="${esc(lesson.warmup.de)}">${icon('volume')}Hear and repeat</button></div>
      ${active ? `<div class="btn-row section-gap"><a class="btn" href="#learn/${esc(active.id)}">Resume this lesson ${icon('arrow')}</a><span class="pill">${supportOf(active) === 'light' ? 'Less help' : 'Guided'}</span></div>` : `<div class="section-gap">${supportButtons(id, { guided: done ? 'Practise again · guided' : 'Start guided' })}</div>`}</section>
    ${languageFocus(lesson)}
    <div class="section-gap" id="starter-export"></div>
    <section class="section-gap"><h2>Words you will use</h2><div class="starter-grid section-gap">${content.words.map(word => wordCard(word, { saved: starter.wordMarks.some(mark => mark.id === word.id && mark.saved) })).join('')}</div></section>
    <div class="section-gap" id="starter-takeaway"></div>`;
  bindSupportButtons(el, ctx);
  bindWordActions(el, ctx);
  mountGeminiExport(el.querySelector('#starter-export'), ctx, starterGeminiSource(content));
  mountCompanionReflection(el.querySelector('#starter-takeaway'), ctx, id);
}

export async function renderToday(el, ctx) {
  el.innerHTML = pageHeading('START SPEAKING', 'A little more confident, every day.', 'Opening your next small lesson…');
  let course;
  try { course = await loadCourse(ctx.store, { signal: ctx.signal }); } catch (error) { courseError(el, ctx, error); return; }
  const plan = await ctx.store.ensureStarterPlan(course);
  if (ctx.signal.aborted) return;
  const state = ctx.store.state;
  const starter = state.starter;
  const next = recommendNext(course, starter);
  const chosen = course.lessons.find(item => item.id === plan.lessonId) ?? next.lesson;
  const meta = lessonMeta(chosen);
  const active = starter.sessions.find(session => session.lessonId === chosen.id && !session.completedAt);
  const done = starter.sessions.some(session => session.lessonId === chosen.id && session.completedAt && dateKey(session.completedAt, state.preferences.timeZone) === plan.id);
  const due = dueWords(course, starter);
  const stage = currentStage(course, starter);
  const practised = practisedLessons(starter);
  el.innerHTML = `${pageHeading('ONE SMALL CONVERSATION', state.profile.name ? `A little more confident, ${state.profile.name}.` : 'A little more confident, every day.', 'Say a useful sentence, try it with less help, then keep talking with Gemini.')}
    ${pathPicker(state)}
    <section class="hero starter-hero section-gap"><div class="hero-main"><p class="eyebrow">TODAY’S LESSON · ${done ? 'PRACTISED TODAY' : active ? 'CONTINUE' : esc(stage.stage.title.toUpperCase())}</p>
      <h2>${esc(meta.title)}</h2><div class="pills">${levelPill(meta.level)}<span class="pill">${meta.minutes} min</span></div>
      <p>${esc(chosen.goal)}</p><p class="starter-hero-words" lang="de">${esc(chosen.warmup.de)}</p><p>${esc(chosen.warmup.en)}</p>
      ${chosen.id === next.lesson.id ? `<p class="fine">${esc(next.reason)}</p>` : ''}
      ${active ? `<div class="btn-row"><a class="btn hero-cta" href="#learn/${esc(active.id)}">Resume lesson ${icon('arrow')}</a><a class="hero-more" href="#lessons">Your path</a></div>`
      : `<div class="btn-row"><button class="btn hero-cta" data-start-lesson="${esc(chosen.id)}" data-support="guided">${done ? 'Practise another variation' : 'Start guided'} ${icon('arrow')}</button><button class="btn secondary" data-start-lesson="${esc(chosen.id)}" data-support="light">Less help</button><a class="hero-more" href="#lessons">Your path</a></div>`}</div></section>
    <section class="card section-gap"><div class="card-title"><h2>Your speaking routine</h2><span class="pill">${practised.size} / ${course.lessons.length} lessons practised</span></div>
      <ol class="starter-routine"><li><strong>Review a few words</strong><p class="fine">${due.length ? `${due.length} words are due for spoken recall.` : 'Start with up to five words from today’s lesson.'}</p><button class="btn secondary" id="today-words">${due.length ? 'Review due words' : 'Learn five words'}</button></li>
      <li><strong>Say short answers</strong><p class="fine">Hear a model, change a detail, and answer with less help. About ${meta.minutes} minutes, at your pace.</p><a href="#lesson/${esc(chosen.id)}">See the lesson</a></li>
      <li><strong>Keep talking on your phone</strong><p class="fine">Copy the lesson pack to Gemini and try a few natural exchanges.</p><a href="#gemini/${esc(chosen.id)}">Export this lesson for Gemini</a></li></ol>
      <label>Choose today’s lesson<select id="starter-focus" aria-label="Choose today’s lesson">${pathLessons(course).map(item => { const entry = lessonMeta(item); return `<option value="${esc(item.id)}" ${item.id === chosen.id ? 'selected' : ''}>${esc(entry.level === 'starter' ? 'Starter' : entry.level)} · ${esc(entry.title)}</option>`; }).join('')}</select></label>
      <p class="fine section-gap">This assignment stays in place today. Repeat it or choose another lesson whenever you want. Viewing a word or exporting a pack does not count as spoken practice.</p></section>
    <section class="card section-gap"><h2>One sentence to keep</h2><form id="starter-reflection"><label class="section-gap">Today’s takeaway<textarea aria-label="Today’s takeaway" maxlength="2000" required>${esc(plan.reflection)}</textarea></label><button class="btn secondary" type="submit">Save today’s takeaway</button><p class="fine" role="status" data-reflection-status>${plan.reflection ? 'Takeaway saved.' : ''}</p></form></section>`;
  bindPathPicker(el, ctx);
  bindSupportButtons(el, ctx);
  safeAction(el.querySelector('#today-words'), () => ctx.startWordPractice(due.length ? due.slice(0, 10).map(word => word.id) : plan.wordIds, 'recall'), ctx.error);
  el.querySelector('#starter-focus').addEventListener('change', async event => {
    try { const lesson = course.lessons.find(item => item.id === event.target.value); await ctx.store.setStarterFocus(plan.id, lesson.id, lesson.wordIds); await ctx.refresh(); }
    catch (error) { ctx.error(error.message); }
  });
  el.querySelector('#starter-reflection').addEventListener('submit', async event => {
    event.preventDefault();
    try { await ctx.store.saveStarterReflection(plan.id, event.target.querySelector('textarea').value); el.querySelector('[data-reflection-status]').textContent = 'Takeaway saved.'; }
    catch (error) { ctx.error(error.message); }
  });
}

export async function renderSession(el, ctx, id) {
  let session = ctx.store.state.starter.sessions.find(item => item.id === id);
  if (!session) throw new Error('This lesson is not saved here. Open Your path to start one.');
  let recording = null;
  let alive = true;
  let busy = false;
  let task; let draft;
  let pendingSave = Promise.resolve();
  const lesson = session.content.lesson;
  const meta = lessonMeta(lesson);
  const light = supportOf(session) === 'light';
  el.innerHTML = `<a class="inline-link" href="#lessons">${icon('back')}Your path</a>${pageHeading(`${esc(meta.moduleTitle ?? 'LESSON')} · LESSON ${meta.number}`, lesson.title, lesson.goal)}
    <div class="starter-session-meta"><span data-starter-step></span><div class="pills">${levelPill(meta.level)}<span class="pill">${light ? 'Less help' : 'Guided'}</span></div><span class="fine" data-starter-time></span></div>
    <div data-starter-meter></div><section class="card section-gap" id="starter-task"></section>
    <div class="btn-row section-gap"><button class="btn secondary" id="starter-back">${icon('back')}Previous step</button><button class="btn" id="starter-next">Next step ${icon('arrow')}</button></div><div class="section-gap" id="lesson-export"></div>`;
  const clock = startStarterClock(ctx, id, el);
  const persist = () => {
    if (!draft || session.completedAt || session.responses.some(response => response.taskId === task.id)) return pendingSave;
    const copy = structuredClone(draft); const taskId = task.id;
    const journal = journalDraft(id, taskId, copy, 'starter');
    pendingSave = pendingSave.then(() => ctx.store.saveStarterDraft(id, taskId, copy)).then(() => { clearJournal(id, journal); });
    return pendingSave;
  };
  const pauseForExport = async () => { await recording?.stop(); await persist(); await clock.flush(); };
  mountGeminiExport(el.querySelector('#lesson-export'), ctx, starterGeminiSource(session.content, { variant: session.variant, support: supportOf(session) }), { beforeExport: pauseForExport, level: meta.level });
  const act = action => async () => {
    if (busy || !alive) return; busy = true; updateControls();
    try { await action(); } catch (error) { ctx.error(error.message); }
    finally { busy = false; if (alive) updateControls(); }
  };
  const changed = () => { updateControls(); return persist(); };
  const move = async delta => {
    await recording?.stop(); await persist(); ctx.speech.stop();
    await ctx.store.updateStarterSession(id, item => { item.cursor = Math.max(0, Math.min(starterSteps(item).length - 1, item.cursor + delta)); });
    await draw();
  };
  function updateControls() {
    if (!alive || !task) return;
    const saved = session.responses.some(response => response.taskId === task.id);
    const spoken = draft.aloud || draft.recordingMs > 0;
    const unavailable = busy || Boolean(recording?.recording);
    el.querySelectorAll('[data-starter-grade]').forEach(button => {
      const grade = button.dataset.starterGrade;
      button.disabled = unavailable || saved || (grade !== 'again' && !spoken) || (grade === 'independent' && draft.hintUsed);
    });
    el.querySelectorAll('#starter-task [data-say]').forEach(button => { button.disabled = unavailable; });
    el.querySelector('#starter-next').disabled = busy || (['warmup', 'speak'].includes(task.kind) && !saved);
    el.querySelector('#starter-back').disabled = busy || session.cursor === 0;
  }
  async function draw() {
    await recording?.dispose(); recording = null;
    if (!alive) return;
    session = ctx.store.state.starter.sessions.find(item => item.id === id);
    const steps = starterSteps(session); task = steps[session.cursor];
    const saved = session.responses.find(response => response.taskId === task.id);
    draft = { ...starterDraft(), ...session.drafts[task.id], ...(saved ? { text: saved.text, aloud: saved.spoken, recordingMs: saved.recordingMs, recordingKey: saved.recordingKey, hintUsed: saved.hintUsed } : {}) };
    el.querySelector('[data-starter-step]').textContent = `Step ${session.cursor + 1} of ${steps.length}`;
    el.querySelector('[data-starter-meter]').innerHTML = progressBar((session.cursor + 1) / steps.length * 100, 'Lesson progress');
    const body = el.querySelector('#starter-task');
    if (task.kind === 'warmup') body.innerHTML = `<p class="eyebrow">SAY SOMETHING RIGHT AWAY</p><h2>Start with these words.</h2><p class="starter-model" lang="de">${esc(lesson.warmup.de)}</p><p lang="en">${esc(lesson.warmup.en)}</p><button class="btn secondary" data-say="${esc(lesson.warmup.de)}">${icon('volume')}Hear and repeat</button><p class="fine section-gap">Repeat the model once. This is supported practice, with no grade.</p><div data-starter-recorder></div>${saved ? '<p class="callout" role="status">Warm-up saved. You made a start.</p>' : '<button class="btn" data-starter-grade="unscored">Save warm-up &amp; continue</button>'}`;
    if (task.kind === 'words') body.innerHTML = `<p class="eyebrow">A FEW USEFUL WORDS</p><h2>Hear them. Say them. Notice the meaning.</h2><p class="fine section-gap">You will use these words in the conversation. They also have their own recall practice in Vocabulary.</p><div class="starter-grid">${session.content.words.map(word => wordCard(word, { actions: false })).join('')}</div>`;
    if (task.kind === 'patterns') body.innerHTML = `<p class="eyebrow">BUILD ONE SHORT SENTENCE</p><h2>Put your own detail in the gap.</h2>${lesson.patterns.map(pattern => `<div class="starter-pattern"><h3 lang="de">${esc(pattern.de)}</h3><p lang="en">${esc(pattern.en)}</p><p class="fine">${esc(pattern.note)}</p><button class="text-button" data-say="${esc(pattern.de)}">${icon('volume')}Hear pattern</button></div>`).join('')}${languageFocus(lesson)}`;
    if (task.kind === 'dialogue') body.innerHTML = `<p class="eyebrow">HEAR THE SITUATION</p><h2>A short model conversation.</h2><p class="fine section-gap">Listen to a line, then say it yourself.${task.alternates > 1 ? ' Practising this lesson again uses the other conversation.' : ''}</p><div class="starter-dialogue">${task.dialogue.map(line => `<div><span class="eyebrow">${esc(line.speaker)}</span><p lang="de">${esc(line.de)}</p><p class="fine" lang="en">${esc(line.en)}</p><button class="text-button" data-say="${esc(line.de)}">${icon('volume')}Hear line</button></div>`).join('')}</div>`;
    if (task.kind === 'speak') body.innerHTML = `<p class="eyebrow">${task.id === 'variation' ? 'A SMALL CHANGE' : 'YOUR TURN'}</p><h2>${esc(task.cue)}</h2>
      <div class="starter-question"><p lang="de">${esc(task.promptDe)}</p>${light ? `<details class="meaning"><summary>Meaning</summary><p lang="en">${esc(task.promptEn)}</p></details>` : `<p lang="en">${esc(task.promptEn)}</p>`}<button class="btn secondary" data-say="${esc(task.promptDe)}">${icon('volume')}Hear question</button></div>
      ${!saved ? `<button class="text-button" id="starter-hint" ${draft.hintUsed ? 'hidden' : ''}>${light ? 'I need the model answer' : 'Show model answer'}</button>` : ''}<div class="starter-pattern" id="starter-model" ${draft.hintUsed ? '' : 'hidden'}><p lang="de">${esc(task.modelDe)}</p><p lang="en">${esc(task.modelEn)}</p><p class="fine">Change the model to fit you. This attempt counts as supported.</p><button class="text-button" data-say="${esc(task.modelDe)}">Hear model</button></div><div data-starter-recorder></div>
      ${saved ? `<p class="callout" role="status">Response saved · ${saved.outcome === 'independent' ? 'said on your own, self-reported' : saved.outcome === 'helped' ? 'practised with help' : 'marked to practise again'}.</p>` : `<p class="fine">One honest reflection is enough. English question meanings do not count as an answer hint.</p><div class="btn-row"><button class="btn secondary" data-starter-grade="again">Try again later</button><button class="btn secondary" data-starter-grade="helped">Needed help</button><button class="btn" data-starter-grade="independent">Said it on my own</button></div>`}`;
    if (task.kind === 'finish') {
      const spoken = session.responses.filter(response => response.spoken).length;
      const recorded = session.responses.reduce((total, response) => total + response.recordingMs, 0);
      body.innerHTML = `<p class="eyebrow">A SMALL CONVERSATION PRACTISED</p><h2>You made room for your voice.</h2><p class="section-gap">${spoken} spoken tasks practised · ${duration(recorded)} recorded. Support and self-ratings stay attached to each answer.</p><div class="btn-row">${session.completedAt ? `<span class="pill green">Lesson finished</span><a class="btn" href="#lessons">Continue the path ${icon('arrow')}</a><button class="btn secondary" data-start-lesson="${esc(lesson.id)}" data-support="light">Practise again with less help</button>` : '<button class="btn" id="finish-starter">Finish lesson</button>'}<button class="btn secondary" id="show-lesson-pack">Export for Gemini</button></div><p class="fine section-gap">Try the same situation in Gemini. Your lesson pack is below. Finishing this sequence is practice, not a proficiency score.</p><div id="lesson-takeaway"></div>`;
      mountCompanionReflection(body.querySelector('#lesson-takeaway'), ctx, lesson.id);
      bindSupportButtons(body, ctx);
      body.querySelector('#finish-starter')?.addEventListener('click', act(async () => { await clock.flush(); await ctx.store.finishStarterSession(id); await draw(); }));
      body.querySelector('#show-lesson-pack').addEventListener('click', () => { const pack = el.querySelector('#lesson-export details'); pack.open = true; pack.scrollIntoView({ block: 'start' }); });
    }
    el.querySelector('#starter-next').hidden = task.kind === 'finish';
    if (['warmup', 'speak'].includes(task.kind)) {
      recording = await mountRecording(body.querySelector('[data-starter-recorder]'), { draft, key: `${id}:${task.id}`, store: ctx.store,
        ctx: { ...ctx, interact: () => clock.interact() }, onChange: changed, locked: Boolean(saved), maxMs: 60_000, onRecordingChange: updateControls });
    }
    body.querySelector('#starter-hint')?.addEventListener('click', act(async () => {
      draft.hintUsed = true; await persist(); body.querySelector('#starter-model').hidden = false; body.querySelector('#starter-hint').hidden = true;
    }));
    body.querySelectorAll('[data-starter-grade]').forEach(button => button.addEventListener('click', act(async () => {
      await recording?.stop(); await persist();
      await ctx.store.saveStarterResponse(id, task.id, draft, button.dataset.starterGrade);
      if (task.kind === 'warmup') await move(1); else await draw();
    })));
    updateControls();
    body.querySelector('h2')?.setAttribute('tabindex', '-1');
  }
  el.querySelector('#starter-back').addEventListener('click', act(() => move(-1)));
  el.querySelector('#starter-next').addEventListener('click', act(() => move(1)));
  el.addEventListener('click', event => { const say = event.target.closest('#starter-task [data-say]'); if (say && !say.disabled) void ctx.play(say.dataset.say, say); }, { signal: ctx.signal });
  await draw();
  return async () => { alive = false; await recording?.dispose(); await persist(); await pendingSave; await clock.stop(); ctx.speech.stop(); };
}
