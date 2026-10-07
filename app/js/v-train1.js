import { resourceById } from '../data/resources.js';
import { tasksFor, taskAttempts, draftFor, makeAttempt, checkListening, missionForSession, phraseForSession } from './session.js';
import { reviewStates, nextDue } from './srs.js';
import { createPracticeClock } from './clock.js';
import { mountRecording } from './recording-ui.js';
import { journalDraft, clearJournal } from './draft-journal.js';
import { mountGeminiExport } from './gemini-export.js';
import { missionGeminiSource } from './gemini-pack.js';
import { esc, icon, duration, minutes, progressBar, outcomeLabel, dueLabel, lessonCopy, englishMeaning } from './ui.js';

const FOCUS_OPTIONS = [
  ['', 'Choose one useful focus…'], ['finding words', 'Finding the words more easily'],
  ['word order', 'Keeping the verb in the right place'], ['clear key information', 'Making the key information clearer'],
  ['understanding the question', 'Understanding the question'], ['a calmer speaking pace', 'Speaking at a calmer pace'],
];
const TASK_LABELS = { brief: 'Your mission', listen: 'Listen & understand', recall: 'Recall aloud', shadow: 'Find the rhythm', speak: 'Your turn to speak', wrap: 'Take something with you' };

export async function render(el, ctx, sessionId) {
  const session = ctx.store.state.sessions.find(item => item.id === sessionId);
  if (!session) throw new Error('This session was not found. Open Lessons and choose a workplace mission.');
  const mission = missionForSession(session);
  const tasks = tasksFor(session);
  const task = tasks[Math.min(session.cursor, tasks.length - 1)];
  const attempts = taskAttempts(ctx.store.state, session.id, task.id);
  const locked = attempts.length > 0;
  const draft = draftFor(session, task.id);
  const always = ctx.store.state.preferences.englishSupport === 'always';
  const copy = (de, en, options = {}) => lessonCopy(de, en, { always, ...options });
  const meaning = (en, options = {}) => englishMeaning(en, { always, ...options });
  const phrase = id => phraseForSession(session, id);
  let alive = true;
  let busy = false;
  let recording = null;
  let pendingSave = Promise.resolve();
  let saveTimer = null;
  let clock = null;
  let journal = null;
  if (always && !locked && ['speak', 'listen'].includes(task.kind)) draft.questionTranslation = true;
  const activeMs = () => ctx.store.state.activity.filter(event => event.sessionId === session.id).reduce((sum, event) => sum + event.ms, 0);

  async function persist() {
    clearTimeout(saveTimer);
    const snapshot = structuredClone(draft);
    const writtenJournal = journal;
    pendingSave = pendingSave.catch(() => {}).then(() => ctx.store.saveDraft(session.id, task.id, snapshot));
    await pendingSave;
    if (writtenJournal) clearJournal(session.id, writtenJournal);
    if (alive && journal === writtenJournal) {
      const status = el.querySelector('#draft-save-status');
      if (status) status.textContent = 'Draft saved on this device';
    }
  }
  function changed() {
    updateControls();
    journal = journalDraft(session.id, task.id, draft);
    const status = el.querySelector('#draft-save-status');
    if (alive && status) status.textContent = 'Saving your draft…';
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => { void persist().catch(error => ctx.error(error.message)); }, 300);
    return Promise.resolve();
  }
  async function action(callback) {
    if (busy) return;
    busy = true;
    updateControls();
    try { await callback(); }
    catch (error) { ctx.error(error.message); }
    finally { busy = false; updateControls(); }
  }

  el.innerHTML = `
    <div class="session-top"><a href="#today" class="inline-link">${icon('back')}Back to Today</a>
      <div class="session-time"><span id="session-clock">${duration(activeMs())}</span><span class="fine" id="clock-label">active practice</span>
      ${!session.completedAt ? `<button class="text-button" id="pause-session" aria-label="${session.paused ? 'Resume practice timer' : 'Pause practice timer'}">${icon(session.paused ? 'play' : 'pause')}</button>` : ''}</div></div>
    <div class="session-progress"><div><span>${session.kind === 'review' ? 'Phrase recall' : esc(mission.shortTitle)}</span><span>Step ${session.cursor + 1} of ${tasks.length}</span></div>
      ${progressBar(session.completedAt ? 100 : session.cursor / tasks.length * 100, 'Session progress')}</div>
    <div class="lesson-layout"><div class="lesson-main"><header class="lesson-heading"><p class="eyebrow">${task.retry ? 'TRY IT AGAIN · WITH LESS HELP' : TASK_LABELS[task.kind]}</p>
      <h1 tabindex="-1">${titleFor(task, mission)}</h1></header><div id="task-body"></div></div><aside id="lesson-side" class="lesson-side"></aside></div>`;
  const body = el.querySelector('#task-body');
  const side = el.querySelector('#lesson-side');
  side.innerHTML = `<section class="side-note"><span class="circle-icon">${icon(mission.icon)}</span><p class="eyebrow">THE REAL-WORLD GOAL</p>
    <h2>${esc(mission.titleDe || mission.shortTitle)}</h2>${copy(mission.goalDe, mission.goal)}<span class="pill">${esc(mission.register)}</span></section>
    <section class="side-note quiet"><h3>One idea, then a detail.</h3><p lang="de">Sprich eine klare Idee aus. Atme kurz durch. Ergänze ein Detail oder stelle eine Frage.</p>
    <p class="fine">Replay and self-assess honestly. English meanings support understanding; answer models are recorded as help.</p></section>`;

  if (!session.completedAt) {
    clock = createPracticeClock({
      sessionId, timeZone: ctx.store.state.preferences.timeZone,
      onSegments: async segments => { try { await ctx.store.addActivity(segments); } catch (error) { ctx.error(error.message); } },
      onTick: status => {
        if (!alive) return;
        el.querySelector('#session-clock').textContent = duration(activeMs());
        el.querySelector('#clock-label').textContent = status.paused ? (status.manual ? 'paused' : 'paused while idle') : 'active practice';
      },
    });
    clock.start();
    if (session.paused) clock.setPaused(true);
    el.querySelector('#pause-session').addEventListener('click', () => action(async () => {
      const paused = !ctx.store.state.sessions.find(item => item.id === sessionId).paused;
      if (paused) { await recording?.stop(); ctx.speech.stop(); }
      await ctx.store.updateSession(sessionId, saved => { saved.paused = paused; });
      clock.setPaused(paused);
      const button = el.querySelector('#pause-session');
      button.innerHTML = icon(paused ? 'play' : 'pause');
      button.setAttribute('aria-label', paused ? 'Resume practice timer' : 'Pause practice timer');
    }));
  }

  async function advance() {
    await recording?.stop();
    await persist();
    await clock?.flush();
    await ctx.store.updateSession(session.id, saved => { if (saved.cursor === session.cursor) saved.cursor = Math.min(saved.cursor + 1, tasks.length - 1); });
    await ctx.refresh();
  }
  const nextButton = (label = 'Continue') => `<div class="task-footer"><button class="btn" id="next-task">${label}${icon('arrow')}</button></div>`;
  const bindNext = () => el.querySelector('#next-task')?.addEventListener('click', () => action(advance));
  const onClick = (selector, callback) => el.querySelector(selector)?.addEventListener('click', () => action(callback));
  const say = (text, button, options = {}) => { clock?.interact(); return ctx.play(text, button, options); };

  if (task.kind === 'brief') {
    body.innerHTML = `${copy(mission.situationDe, mission.situation)}<div class="mission-brief"><p class="eyebrow">YOUR COMMUNICATION GOAL</p>
      ${copy(mission.goalDe, mission.goal)}<ol class="brief-steps">
      <li><span>1</span><div><strong>Hören und verstehen</strong>${meaning('Listen for the main point and a useful detail.')}</div></li>
      <li><span>2</span><div><strong>Wörter selbst finden</strong>${meaning('Try the phrases from memory, then compare with the model.')}</div></li>
      <li><span>3</span><div><strong>Sprechen und noch einmal versuchen</strong>${meaning('Answer aloud, replay, reflect, and try again with less support.')}</div></li></ol></div>
      <div class="callout">${copy('Du kannst jederzeit pausieren. Deine Antworten und dein Platz werden gespeichert.', 'You can pause at any time. Your responses and place are saved on this device.')}</div>${nextButton('Begin with listening')}`;
    bindNext();
  }

  if (task.kind === 'listen') {
    const listening = task.listening;
    const transcript = listening.dialogue
      ? listening.dialogue.map(line => `<p><strong>${esc(line.speaker)}:</strong> ${esc(line.de)}</p>`).join('')
      : esc(listening.transcript);
    body.innerHTML = `${copy(`Höre „${listening.title}“. Versuche zuerst, die wichtigsten Informationen ohne Text zu verstehen.`, 'Listen for the key information before opening the transcript.')}
      <div class="listen-player"><span class="audio-symbol">${icon('volume')}</span><div><strong>Listen to the example</strong><span class="fine">German read-aloud · original teaching dialogue</span></div>
        <div class="btn-row"><button class="btn" id="listen-normal">${icon('play')}Listen</button><button class="btn secondary" id="listen-slow">Slower</button><button class="btn secondary" id="listen-stop" aria-label="Stop example playback">${icon('stop')}</button></div></div>
      <p id="listened-status" class="fine" role="status">${draft.listened ? 'Example played. Answer when you are ready.' : ''}</p>
      <button class="text-button" id="read-instead">${locked ? 'Show transcript' : 'Use the reading alternative / show transcript'}</button>
      <div class="transcript" id="transcript" ${draft.readInstead || locked ? '' : 'hidden'}><div lang="de">${transcript}</div>${meaning(listening.transcriptEn, { kind: 'answer', label: 'English transcript' })}</div>
      <form id="listening-form" class="listening-questions">${listening.questions.map((question, index) => `
        <fieldset><legend lang="de">${index + 1}. ${esc(question.question)}</legend>
        ${meaning(question.questionEn ? `${question.questionEn}\n${question.optionsEn.map((option, i) => `${i + 1}. ${option}`).join('\n')}` : '', { kind: 'question' })}
        ${question.options.map((option, optionIndex) => `<label class="answer-option"><input type="radio" name="${esc(question.id)}" value="${optionIndex}" ${draft.answers[question.id] === optionIndex ? 'checked' : ''} ${locked ? 'disabled' : ''}>
          <span lang="de">${esc(option)}</span>${locked && optionIndex === question.answer ? `<span class="answer-correct">${icon('check')}Model answer</span>` : ''}</label>`).join('')}</fieldset>`).join('')}
        ${!locked ? '<button class="btn" id="check-listening" type="submit">Check understanding</button>' : ''}</form>
      ${locked ? `<div class="callout"><strong>${attempts.filter(attempt => attempt.outcome === 'correct').length} of ${listening.questions.length} answers correct.</strong>
        ${draft.readInstead ? 'Reading-supported practice. Excluded from unassisted listening statistics.' : 'Your first submitted answers are saved once. Read the transcript, then listen again.'}</div>${nextButton()}`
      : '<p class="fine">English question meanings support the task. Opening the transcript marks the listening attempt as reading-supported.</p>'}`;
    const playListening = async (button, slow = false) => {
      const result = await say(listening.transcript, button, { slow });
      if (alive && result?.status === 'ended' && !locked) {
        draft.listened = true; await persist();
        el.querySelector('#listened-status').textContent = 'Example played. Answer when you are ready.';
        updateControls();
      }
    };
    el.querySelector('#listen-normal').addEventListener('click', event => { void playListening(event.currentTarget).catch(error => ctx.error(error.message)); });
    el.querySelector('#listen-slow').addEventListener('click', event => { void playListening(event.currentTarget, true).catch(error => ctx.error(error.message)); });
    el.querySelector('#listen-stop').addEventListener('click', () => ctx.speech.stop());
    el.querySelector('#read-instead').addEventListener('click', () => { el.querySelector('#transcript').hidden = false; if (!locked) { draft.readInstead = true; if (always && listening.transcriptEn) draft.answerTranslation = true; void changed(); } });
    el.querySelector('#listening-form').addEventListener('change', event => {
      if (!locked && event.target.type === 'radio') { draft.answers[event.target.name] = Number(event.target.value); void changed(); }
    });
    el.querySelector('#listening-form').addEventListener('submit', event => {
      event.preventDefault();
      void action(async () => { if (locked) return; await persist(); await ctx.store.addAttempts(checkListening(session, task, draft, ctx.store.state.preferences.timeZone)); await ctx.refresh(); });
    });
    bindNext();
  }

  if (task.kind === 'recall') {
    const word = phrase(task.phraseId);
    const review = reviewStates(ctx.store.state.attempts).get(word.id);
    body.innerHTML = `<div class="recall-cue"><span class="pill">${esc(dueLabel(nextDue(review)))}</span>
      ${copy(word.cueDe, word.cue)}${word.id.startsWith('personal-') ? meaning(word.en, { label: 'English cue' }) : ''}</div>
      <div id="response-recorder"></div>
      ${!draft.revealed && !locked ? `<div class="task-footer"><button class="btn secondary" id="show-model">${icon('eye')}Show model &amp; rate my recall</button><p class="fine">Try first. Record, add a draft, or tick “I practised aloud” before revealing.</p></div>` : `
        <div class="model-answer"><p class="eyebrow">MODEL PHRASE</p><h2 lang="de">${esc(word.de)}</h2>${meaning(word.en)}
        <p lang="de">${esc(word.example)}</p>${copy(word.noteDe, word.note)}<button class="text-button" id="hear-model">${icon('volume')}Listen to the example</button></div>
        ${locked ? savedFeedback(attempts[0]) + nextButton('Next phrase / step') : `<p class="fine">${draft.attemptedBeforeReveal && !draft.hintUsed ? 'Compare your own answer with the model. This is your self-rating.' : 'You saw the model before completing a memory attempt. Choose Again or Needed help.'}</p>${gradeButtons(true)}`}`}`;
    await attachRecorder();
    onClick('#show-model', async () => {
      await recording.stop(); draft.attemptedBeforeReveal = Boolean(draft.aloud || draft.recordingMs > 0 || draft.text.trim());
      draft.hintUsed = !draft.attemptedBeforeReveal; draft.revealed = true; await persist(); await ctx.refresh();
    });
    el.querySelector('#hear-model')?.addEventListener('click', event => { void say(word.example || word.de, event.currentTarget); });
    bindGrades(); bindNext();
  }

  if (task.kind === 'shadow') {
    body.innerHTML = `${copy('Höre einmal zu. Sprich die Zeile nach und vergleiche dann Rhythmus und Betonung.', 'Listen once, repeat the line, then compare rhythm and stress.')}
      <div class="shadow-line" lang="de">${esc(task.model)}</div>${meaning(task.modelEn)}
      <div class="btn-row"><button class="btn secondary" id="shadow-listen">${icon('volume')}Listen</button><button class="btn secondary" id="shadow-slow">Listen slowly</button></div>
      <div id="response-recorder" class="section-gap"></div>${locked ? savedFeedback(attempts[0]) + nextButton() : '<p class="fine">Repetition is unscored practice, separate from independent production.</p><button class="btn" id="save-shadow">I repeated the line</button>'}`;
    await attachRecorder();
    el.querySelector('#shadow-listen').addEventListener('click', event => { void say(task.model, event.currentTarget); });
    el.querySelector('#shadow-slow').addEventListener('click', event => { void say(task.model, event.currentTarget, { slow: true }); });
    onClick('#save-shadow', () => saveGrade('unscored')); bindNext();
  }

  if (task.kind === 'speak') {
    const previousFocus = ctx.store.state.attempts.filter(attempt => attempt.sessionId === session.id && attempt.focus).at(-1)?.focus;
    body.innerHTML = `${copy(task.goalDe, task.goal)}
      ${task.retry && previousFocus ? `<div class="callout amber"><strong>Your chosen focus:</strong> ${esc(previousFocus)}. Try one small improvement.</div>` : ''}
      <div class="conversation-prompt"><span class="speaker-avatar">${icon(mission.icon)}</span><div><span class="fine">${mission.register.startsWith('Sie') ? 'Your conversation partner · Sie' : 'Your colleague · du'}</span>
        <p lang="de" id="current-prompt">${esc(task.prompt)}</p>${meaning(task.promptEn, { id: 'question-meaning', kind: 'question' })}
        <div class="prompt-actions"><button class="text-button" id="hear-question">${icon('volume')}Hear the question</button><button class="text-button" id="rephrase-question">Say it more simply</button></div></div></div>
      <div id="response-recorder"></div>
      ${!locked ? `<div class="help-toggle"><button class="text-button" id="show-hint">${icon('eye')}${draft.hintUsed ? 'Show the model again' : 'I’m stuck — show a hint and model'}</button></div>` : ''}
      <div class="model-answer" id="answer-hint" ${draft.hintUsed ? '' : 'hidden'}><p class="eyebrow">EXAMPLE RESPONSE · ADAPT IT TO YOU</p>
        ${copy(task.model, task.modelEn, { kind: 'answer' })}<p class="fine">This example describes a fictional speaker. Use your own facts.</p>${personalFacts(session.profile)}
        <button class="text-button" id="hear-hint">${icon('volume')}Listen to the example</button></div>
      ${locked ? savedFeedback(attempts[0]) + nextButton(task.retry ? 'Reflect on this session' : 'Next question') : `
        <section class="reflection"><p class="eyebrow">LISTEN BACK, THEN REFLECT</p><h2>Did you get your message across?</h2>
        <fieldset aria-label="Speaking self-assessment">${task.criteria.map((criterion, index) => `<label class="check-label"><input type="checkbox" data-criterion="${index}" ${draft.criteria.includes(criterion) ? 'checked' : ''}><span lang="${task.criteriaDe ? 'de' : 'en'}">${esc(task.criteriaDe?.[index] ?? criterion)}</span></label>`).join('')}</fieldset>
        ${task.criteriaDe ? meaning(task.criteria.join('\n')) : ''}
        ${task.intents ? `<fieldset class="intent-options"><legend>Which matches what you said?</legend>${task.intents.map(intent => `<label class="check-label"><input type="radio" name="reply-intent" value="${esc(intent.id)}" ${draft.intent === intent.id ? 'checked' : ''}><span>${esc(intent.labelDe ?? intent.label)}</span></label>`).join('')}${meaning(task.intents.map(intent => intent.label).join('\n'))}<p class="fine">Your choice determines the next follow-up.</p></fieldset>` : ''}
        <details id="used-phrases" ${draft.phrasesRevealed ? 'open' : ''}><summary>Phrases I actually used without reading</summary><p class="fine">Select only phrases used in your completed spoken answer. This is self-reported evidence.</p>
          ${(task.phraseIds ?? []).map(id => `<label class="check-label"><input type="checkbox" data-used-phrase="${esc(id)}" ${draft.phraseIds.includes(id) ? 'checked' : ''}><span lang="de">${esc(phrase(id).de)}</span></label>`).join('')}</details>
        <label class="focus-field">One thing to improve next time<select id="next-focus">${FOCUS_OPTIONS.map(([value, label]) => `<option value="${value}" ${draft.focus === value ? 'selected' : ''}>${label}</option>`).join('')}</select></label>
        <p class="fine" id="independence-note"></p>${gradeButtons()}<p class="fine">Your self-rating is saved once. Open-ended German is not automatically graded.</p></section>`}`;
    await attachRecorder();
    el.querySelector('#hear-question').addEventListener('click', event => { void say(el.querySelector('#current-prompt').textContent, event.currentTarget); });
    el.querySelector('#rephrase-question').addEventListener('click', event => {
      el.querySelector('#current-prompt').textContent = task.rephrase;
      const translated = el.querySelector('#question-meaning > div');
      if (translated) translated.textContent = task.rephraseEn || task.promptEn;
      void say(task.rephrase, event.currentTarget);
    });
    el.querySelector('#show-hint')?.addEventListener('click', () => { draft.hintUsed = true; if (always && task.modelEn) draft.answerTranslation = true; el.querySelector('#answer-hint').hidden = false; void changed(); });
    el.querySelector('#hear-hint').addEventListener('click', event => { void say(task.model, event.currentTarget); });
    el.querySelectorAll('[data-criterion]').forEach(input => input.addEventListener('change', () => { draft.criteria = [...el.querySelectorAll('[data-criterion]:checked')].map(item => task.criteria[Number(item.dataset.criterion)]); void changed(); }));
    el.querySelectorAll('[name="reply-intent"]').forEach(input => input.addEventListener('change', () => { draft.intent = input.value; void changed(); }));
    el.querySelectorAll('[data-used-phrase]').forEach(input => input.addEventListener('change', () => { draft.phraseIds = [...el.querySelectorAll('[data-used-phrase]:checked')].map(item => item.dataset.usedPhrase); void changed(); }));
    el.querySelector('#used-phrases')?.addEventListener('toggle', event => { if (event.currentTarget.open) { draft.phrasesRevealed = true; void changed(); } });
    el.querySelector('#next-focus')?.addEventListener('change', event => { draft.focus = event.target.value; void changed(); });
    bindGrades(); bindNext();
  }

  if (task.kind === 'wrap') {
    const own = ctx.store.state.attempts.filter(attempt => attempt.sessionId === session.id);
    const spoken = own.filter(attempt => attempt.kind === 'speaking' && attempt.inputMode !== 'typed');
    const recordingMs = own.reduce((sum, attempt) => sum + attempt.recordingMs, 0);
    const focus = own.filter(attempt => attempt.focus).at(-1)?.focus ?? '';
    body.innerHTML = `${copy('Nimm eine nützliche Wendung mit in dein nächstes Gespräch.', 'Take one useful phrase into your next conversation.')}
      <div class="session-summary"><div><strong>${minutes(activeMs())}<small> min</small></strong><span>active practice</span></div><div><strong>${duration(recordingMs)}</strong><span>recorded responses</span></div>
        <div><strong>${spoken.filter(attempt => attempt.outcome === 'independent').length} / ${spoken.length}</strong><span>spoken answers rated independent</span></div></div>
      <div class="callout"><strong>${focus ? `Your next focus: ${esc(focus)}.` : 'Keep the next step small.'}</strong><p>Use a phrase from this session with a real person. Due phrases will return in your review queue.</p></div>
      <p class="small section-gap">Use Export for Gemini below to take this lesson’s phrases, model conversation, and questions into a voice conversation on your phone.</p>
      <div class="btn-row section-gap">${!session.completedAt ? `<button class="btn" id="finish-session">Finish session ${icon('check')}</button>` : '<a class="btn" href="#today">Back to Today</a>'}<a class="btn secondary" href="#progress">View my progress</a></div>`;
    side.innerHTML = `<section class="side-note"><p class="eyebrow">GUIDED RESOURCES</p>${mission.resources.map(resourceById).filter(Boolean).map(resource => `<a class="side-resource" href="#resource/${resource.id}"><h3>${esc(resource.title)}</h3><p>${esc(resource.summaryEn)}</p><span class="inline-link">View practice activity ${icon('arrow')}</span></a>`).join('')}</section>`;
    onClick('#finish-session', async () => { await clock?.flush(); await ctx.store.updateSession(session.id, saved => { saved.completedAt ??= Date.now(); saved.cursor = tasks.length - 1; }); ctx.notify('Session saved. Your daily queue and due reviews are ready on Today.'); ctx.go('today'); });
  }

  async function attachRecorder() {
    recording = await mountRecording(el.querySelector('#response-recorder'), {
      draft, key: `${session.id}:${task.id}`, store: ctx.store, ctx: { ...ctx, interact: () => clock?.interact() }, locked, onChange: changed,
      beforeRecord: () => { if ((task.kind === 'recall' && draft.revealed) || (task.kind === 'speak' && draft.phrasesRevealed)) { draft.hintUsed = true; updateControls(); } },
    });
    if (!locked) el.querySelector('#response-recorder').insertAdjacentHTML('beforeend', '<p id="draft-save-status" class="fine" aria-live="polite">Draft saved on this device</p>');
  }
  async function saveGrade(outcome) {
    if (locked) return;
    await recording?.stop(); await persist();
    await ctx.store.addAttempts([makeAttempt(session, task, draft, outcome, ctx.store.state.preferences.timeZone)]);
    await ctx.refresh();
  }
  function bindGrades() { el.querySelectorAll('[data-grade]').forEach(button => button.addEventListener('click', () => action(() => saveGrade(button.dataset.grade)))); }
  function updateControls() {
    if (!alive) return;
    const hasResponse = draft.aloud || draft.recordingMs > 0 || draft.text.trim().length > 0;
    const hasSpoken = draft.aloud || draft.recordingMs > 0;
    const allCriteria = (task.criteria ?? []).every(criterion => draft.criteria.includes(criterion));
    const intentOK = !task.intents || task.intents.some(intent => intent.id === draft.intent);
    const independent = !draft.hintUsed && hasResponse && (task.kind === 'recall' ? draft.attemptedBeforeReveal : allCriteria && hasSpoken);
    el.querySelectorAll('[data-grade]').forEach(button => { button.disabled = busy || locked || !intentOK || (button.dataset.grade === 'independent' ? !independent : button.dataset.grade === 'helped' && !hasResponse); });
    const used = el.querySelector('#used-phrases'); if (used) used.hidden = !hasSpoken;
    const note = el.querySelector('#independence-note');
    if (note) note.textContent = draft.hintUsed ? 'You used a model or answer hint. Choose Needed help for this attempt.' : !hasSpoken ? 'Speak aloud first. Recording is optional; typed notes alone are not spoken evidence.' : !allCriteria ? 'Check the statements you met before rating an independent answer.' : 'Your spoken answer is ready to self-assess.';
    const check = el.querySelector('#check-listening'); if (check) check.disabled = busy || !(draft.listened || draft.readInstead) || !task.listening.questions.every(question => Number.isInteger(draft.answers[question.id]));
    const next = el.querySelector('#next-task'); if (next) next.disabled = busy;
    const shadow = el.querySelector('#save-shadow'); if (shadow) shadow.disabled = busy || !hasSpoken;
  }
  el.addEventListener('toggle', event => {
    const kind = event.target.dataset?.meaning;
    if (!kind || !event.target.open || locked || event.target.closest('[hidden]')) return;
    if (kind === 'question') draft.questionTranslation = true;
    if (kind === 'answer') { draft.answerTranslation = true; if (task.kind === 'listen') draft.readInstead = true; else if (task.kind === 'speak') draft.hintUsed = true; }
    if (kind !== 'instruction') void changed();
  }, { capture: true, signal: ctx.signal });
  body.insertAdjacentHTML('beforeend', '<div class="section-gap" id="mission-gemini-export"></div>');
  mountGeminiExport(body.querySelector('#mission-gemini-export'), ctx, missionGeminiSource(mission, session.content), {
    level: ctx.store.state.preferences.learningPath === 'starter' ? 'starter' : ctx.store.state.preferences.aiLevel,
    beforeExport: async () => { await recording?.stop(); await persist(); await clock?.flush(); },
  });
  updateControls();
  return async () => {
    alive = false;
    await recording?.dispose(); clearTimeout(saveTimer);
    if (!locked && !['brief', 'wrap'].includes(task.kind)) await persist();
    await pendingSave; await clock?.stop();
  };
}

function gradeButtons(recall = false) {
  return `<div class="rating-buttons"><button class="btn secondary" data-grade="again">${recall ? 'Again' : 'Practise again'}</button><button class="btn secondary" data-grade="helped">Needed help</button><button class="btn" data-grade="independent">${recall ? 'Recalled independently' : 'Answered independently'}</button></div>`;
}
function titleFor(task, mission) {
  if (task.kind === 'brief') return esc(mission.titleDe || mission.goal);
  return { listen: 'First, catch the meaning.', recall: 'Can you find the words?', shadow: 'Borrow the rhythm.', speak: task.retry ? 'Same idea. A little more yours.' : 'One clear answer is enough.', wrap: 'A real step forward.' }[task.kind];
}
function savedFeedback(attempt) {
  return `<div class="saved-feedback" role="status"><span class="circle-icon">${icon('check')}</span><div><strong>${esc(outcomeLabel(attempt.outcome))}</strong><p>${attempt.source === 'self' ? 'Your self-assessment is saved.' : 'Your practice is saved.'} ${attempt.recordingMs ? `${duration(attempt.recordingMs)} recorded.` : 'No recording time added.'}</p></div></div>`;
}
function personalFacts(profile) {
  const facts = [['Your studies', profile.studies], ['Your experience', profile.experience], ['Your availability', profile.availability], ['Your start date', profile.start], ['Your motivation', profile.motivation]].filter(([, value]) => value);
  return facts.length ? `<div class="your-facts"><h3>Your own facts</h3>${facts.map(([label, value]) => `<p><span>${label}</span>${esc(value)}</p>`).join('')}</div>` : '<p class="fine">Add your studies and availability in Settings to keep your own facts at hand.</p>';
}
