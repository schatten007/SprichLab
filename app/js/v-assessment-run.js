import '../css/assessments.css';
import { assessmentDefinition, emptyAssessmentDraft } from './assessment-state.js';
import { createPracticeClock } from './clock.js';
import { journalDraft, clearJournal } from './draft-journal.js';
import { esc, icon, pageHeading, duration } from './ui.js';

const domains = { vocabulary: 'Vocabulary', grammar: 'Grammar', reading: 'Reading', writing: 'Constrained writing' };
const answerAttributes = 'maxlength="500" lang="de" autocomplete="off" autocapitalize="off" spellcheck="false"';
const wordCount = text => (text.match(/\S+/gu) ?? []).length;

function controls(item, index, answer) {
  const id = `assessment-input-${index}`;
  switch (item.type) {
    case 'choice':
      return `<div class="assessment-choices">${item.options.map(option => `<label class="assessment-choice"><input type="radio" name="${esc(item.id)}" value="${esc(option.id)}" data-assessment-choice ${answer === option.id ? 'checked' : ''}><span lang="de">${esc(option.text)}</span></label>`).join('')}</div>`;
    case 'text':
      return `<label for="${id}">Your answer</label><input id="${id}" type="text" name="${esc(item.id)}" data-assessment-text ${answerAttributes} value="${esc(answer ?? '')}">`;
    case 'slots':
      return `<div class="assessment-slots">${item.parts.map((part, partIndex) => `<label for="${id}-${partIndex}">${esc(part.label)}<input id="${id}-${partIndex}" type="text" name="${esc(item.id)}.${esc(part.id)}" data-assessment-slot="${esc(part.id)}" ${answerAttributes} value="${esc(answer?.[part.id] ?? '')}"></label>`).join('')}</div><p class="field-hint">Each gap is checked separately.</p>`;
    case 'order':
      return `<p class="fine">Add tokens in your chosen order. Use every token once; Undo removes the last one.</p>
        <div class="assessment-token-bank" role="group" aria-label="Available tokens">${item.tokens.map((token, tokenIndex) => `<button class="btn secondary" type="button" data-order-token="${esc(token.id)}" aria-label="Add token ${tokenIndex + 1}: ${esc(token.text)}" aria-disabled="false"><span lang="de">${esc(token.text)}</span></button>`).join('')}</div>
        <h3 class="assessment-order-title">Your order</h3><ol class="assessment-order" data-order-answer aria-label="Your token order"></ol>
        <p class="fine" data-order-status role="status"></p><div class="btn-row"><button class="btn secondary" type="button" data-order-undo aria-disabled="true">Undo last token</button><button class="btn secondary" type="button" data-order-reset aria-disabled="true">Reset order</button></div>`;
    default:
      throw new Error('This assessment contains an unsupported question type.');
  }
}

function stimulusHTML(stimulus, index, practice) {
  return `<section class="card assessment-stimulus" data-assessment-stimulus="${esc(stimulus.id)}" aria-labelledby="assessment-reading-${index}">
    <h2 id="assessment-reading-${index}" tabindex="-1">Reading text ${index + 1}</h2><p class="assessment-reading-text" lang="de">${esc(stimulus.de)}</p>
    ${practice && stimulus.en ? `<button class="btn secondary" type="button" data-assessment-translation aria-expanded="false" aria-controls="assessment-translation-${index}">Reveal English translation</button><div class="assessment-support" id="assessment-translation-${index}" data-assessment-translation-content role="region" aria-label="English translation" hidden></div>` : ''}</section>`;
}

function objectiveHTML(definition, draft, practice) {
  const seen = new Set();
  const readings = ids => ids.map(id => {
    if (seen.has(id)) return '';
    seen.add(id);
    const index = definition.stimuli.findIndex(stimulus => stimulus.id === id);
    return stimulusHTML(definition.stimuli[index], index, practice);
  }).join('');
  const questions = definition.items.map((item, index) => `${readings(item.stimulusIds)}<div class="card assessment-question"><fieldset data-assessment-item="${esc(item.id)}" data-assessment-type="${item.type}">
    <legend><span class="eyebrow">Question ${index + 1} · ${domains[item.domain]}</span><span class="assessment-prompt" lang="en">${esc(item.promptEn)}</span></legend>
    ${item.stimulusIds.length ? `<div class="assessment-reading-links">${item.stimulusIds.map(id => { const readingIndex = definition.stimuli.findIndex(stimulus => stimulus.id === id); return `<button type="button" class="text-button" data-reading-index="${readingIndex}" aria-label="Go to reading text ${readingIndex + 1}">Reading text ${readingIndex + 1} ${icon('book')}</button>`; }).join('')}</div>` : ''}
    ${item.promptDe ? `<p class="assessment-german" lang="de">${esc(item.promptDe)}</p>` : ''}${controls(item, index, draft.answers[item.id])}
    ${practice ? `<div class="assessment-reveal"><button class="btn secondary" type="button" data-assessment-reveal aria-expanded="false" aria-controls="assessment-answer-${index}">Reveal answer</button><div class="assessment-support" id="assessment-answer-${index}" data-assessment-answer role="region" aria-label="Revealed answer" hidden></div></div>` : ''}
    </fieldset></div>`).join('');
  return readings(definition.stimuli.map(stimulus => stimulus.id)) + questions;
}

function writingHTML(definition, practice) {
  return `${definition.stimuli.map((stimulus, index) => stimulusHTML(stimulus, index, practice)).join('')}
    <section class="card assessment-writing" aria-labelledby="assessment-writing-task"><h2 id="assessment-writing-task">Your writing task</h2><p class="assessment-task-prompt" lang="en">${esc(definition.task.prompt)}</p>
    <h3>Include these points</h3><ul class="assessment-goals" lang="en">${definition.task.goals.map(goal => `<li>${esc(goal)}</li>`).join('')}</ul>
    <label for="assessment-writing">Your German response</label><textarea id="assessment-writing" name="text" data-assessment-writing lang="de" maxlength="3000" rows="10" autocomplete="off" autocapitalize="off" spellcheck="false" aria-describedby="assessment-word-guidance assessment-word-count" required></textarea>
    <p class="field-hint" id="assessment-word-guidance">Suggested length: ${definition.task.words[0]}–${definition.task.words[1]} words. This is guidance, not a submission limit. Maximum 3,000 characters.</p>
    <p class="fine assessment-word-count" id="assessment-word-count" data-assessment-word-count role="status"></p></section>`;
}

function revealedAnswer(item) {
  let answer;
  if (item.type === 'choice') answer = `<h3>Answer</h3><p lang="de">${esc(item.options.find(option => option.id === item.answer).text)}</p>`;
  if (item.type === 'text') answer = `<h3>One accepted answer</h3><p lang="de">${esc(item.accepted[0])}</p>`;
  if (item.type === 'slots') answer = `<h3>One accepted answer for each gap</h3><dl>${item.parts.map(part => `<dt>${esc(part.label)}</dt><dd lang="de">${esc(part.accepted[0])}</dd>`).join('')}</dl>`;
  if (item.type === 'order') answer = `<h3>One accepted order</h3><p lang="de">${esc(item.orders[0].map(id => item.tokens.find(token => token.id === id).text).join(' '))}</p>`;
  return `${answer}${item.feedback.de ? `<p lang="de">${esc(item.feedback.de)}</p>` : ''}<p lang="en">${esc(item.feedback.en)}</p><p class="fine">This reveal is recorded as support for this attempt.</p>`;
}

function submittedHTML(definition, attemptId) {
  return `<div class="assessment-run" data-assessment-submitted>${pageHeading('SUBMITTED ASSESSMENT', definition.title, 'Your submitted response is sealed and saved on this device.')}<a class="btn" href="#assessment-result/${esc(attemptId)}">View assessment result ${icon('arrow')}</a></div>`;
}

/** Mount an objective/writing attempt; the router must await the returned cleanup before replacing it. */
export async function render(el, ctx, attemptId) {
  if (ctx.signal?.aborted) return;
  const progress = ctx.store.state.assessments;
  const attempt = progress?.attempts.find(item => item.id === attemptId);
  if (!attempt) throw new Error('This assessment attempt is not saved on this device.');
  const definition = assessmentDefinition(progress, attempt);
  if (!definition) throw new Error('The saved definition for this assessment is missing.');
  const resultRoute = `assessment-result/${attempt.id}`;
  if (attempt.state === 'submitted') {
    el.innerHTML = submittedHTML(definition, attempt.id);
    ctx.go(resultRoute);
    return;
  }
  if (!['objective', 'writing'].includes(definition.kind) || attempt.execution !== 'in_app') throw new Error('Continue this roleplay from its conversation.');
  if (!['prepared', 'in_progress'].includes(attempt.state)) throw new Error('This assessment is closed. Start a new attempt to answer it.');

  const practice = attempt.mode === 'practice';
  const writing = definition.kind === 'writing';
  const draft = structuredClone(attempt.draft ?? emptyAssessmentDraft());
  const listeners = new AbortController();
  let alive = true; let submitting = false; let sealed = false; let manuallyPaused = false;
  let version = 0; let savedVersion = 0; let queuedVersion = -1; let saving = false;
  let journal = null; let saveTimer = null; let saveError = null; let errorSource = null;
  let pendingSave = Promise.resolve(true); let submissionTask = null; let cleanupTask = null; let clockStop = null;
  let pendingReveals = 0; let clockStatus = { paused: false, manual: false };

  el.innerHTML = `<div class="assessment-run" data-assessment-run="${esc(attempt.id)}">
    <div class="assessment-toolbar"><a class="inline-link" href="#lessons">${icon('back')}Back to Lessons</a><div class="assessment-timer"><span class="fine" data-assessment-clock></span><button class="text-button" type="button" data-assessment-pause>Pause practice timer</button></div></div>
    ${pageHeading('SELF-DIRECTED ASSESSMENT', definition.title)}<div class="pills"><span class="pill">Target level: ${esc(definition.level)}</span><span class="pill ${practice ? 'green' : 'amber'}">${practice ? 'Practice' : 'Checkpoint'}</span></div>
    <p class="assessment-conditions" id="assessment-conditions">${practice ? 'Self-directed practice: try your own answers first. Answer and translation reveals are optional and recorded with this attempt.' : 'Self-directed checkpoint: work from your own knowledge, without outside answer help. Answers and reading translations become available after submission.'} Work at your own pace; the timer records active practice.</p>
    <p class="assessment-instructions" id="assessment-instructions" lang="en">${esc(definition.instructions)}</p>
    <div class="assessment-save"><p class="fine" data-assessment-save-status role="status">Draft saved on this device</p><button type="button" class="text-button" data-assessment-save-retry hidden>Retry draft save</button></div>
    <p class="callout error" data-assessment-error role="alert" hidden></p>
    <form data-assessment-form aria-label="Assessment answers" aria-describedby="assessment-conditions assessment-instructions"><fieldset class="assessment-fields" data-assessment-fields><legend class="sr-only">Your assessment responses</legend>
    ${writing ? writingHTML(definition, practice) : objectiveHTML(definition, draft, practice)}</fieldset>
    <section class="card assessment-submit"><h2>When you’re ready</h2><p class="fine" data-assessment-progress></p>
    <p id="assessment-submit-note" data-assessment-submit-note>${writing ? 'Save for grading seals this response. Its content will be evaluated from the result page; word count is only a guide.' : 'Unanswered items and empty gaps score 0. An incomplete token order scores 0. Submitting seals your answers and checks them locally.'}</p>
    <button class="btn" type="submit" data-assessment-submit aria-describedby="assessment-submit-note">${writing ? 'Save for grading' : 'Submit answers'} ${icon('arrow')}</button></section></form></div>`;

  const root = el.querySelector('[data-assessment-run]');
  const form = root.querySelector('[data-assessment-form]');
  const fields = root.querySelector('[data-assessment-fields]');
  const submitButton = root.querySelector('[data-assessment-submit]');
  const pauseButton = root.querySelector('[data-assessment-pause]');
  const saveStatus = root.querySelector('[data-assessment-save-status]');
  const retryButton = root.querySelector('[data-assessment-save-retry]');
  const errorBox = root.querySelector('[data-assessment-error]');
  const itemNodes = new Map([...root.querySelectorAll('[data-assessment-item]')].map(node => [node.dataset.assessmentItem, node]));
  const active = () => alive && !ctx.signal?.aborted && root.isConnected;
  const editable = () => active() && !submitting && !sealed;
  const listen = (node, type, action) => node.addEventListener(type, action, { signal: listeners.signal });
  function setText(node, text) { if (active() && node.textContent !== text) node.textContent = text; }
  function report(error, source) {
    if (!active()) return;
    errorSource = source; errorBox.textContent = error.message; errorBox.hidden = false;
    ctx.error(error.message);
  }
  function clearError(source = errorSource) { if (active() && source === errorSource) { errorBox.hidden = true; errorBox.textContent = ''; errorSource = null; } }
  function updateLock() {
    if (!active()) return;
    fields.disabled = submitting || sealed;
    submitButton.disabled = submitting || sealed || pendingReveals > 0;
    pauseButton.disabled = submitting || sealed;
    retryButton.disabled = submitting || sealed;
    form.setAttribute('aria-busy', String(submitting));
  }
  function updateProgress() {
    if (!active()) return;
    if (writing) {
      const count = wordCount(draft.text); const [minimum, maximum] = definition.task.words;
      const guidance = count < minimum ? 'Below the suggested range' : count > maximum ? 'Above the suggested range' : 'Within the suggested range';
      setText(root.querySelector('[data-assessment-word-count]'), `${count} ${count === 1 ? 'word' : 'words'} · ${draft.text.length}/3,000 characters · ${guidance}`);
      return;
    }
    const filled = definition.items.filter(item => {
      const answer = draft.answers[item.id];
      if (item.type === 'slots') return item.parts.every(part => answer?.[part.id]?.trim());
      if (item.type === 'order') return Array.isArray(answer) && answer.length === item.tokens.length;
      return typeof answer === 'string' && answer.trim();
    }).length;
    setText(root.querySelector('[data-assessment-progress]'), `${filled} of ${definition.items.length} items filled`);
  }

  // Every edit is journalled synchronously. Only immutable snapshots enter the save queue.
  function changed() {
    version++;
    journal = journalDraft(attempt.id, 'draft', draft, 'assessment');
    updateProgress(); setText(saveStatus, 'Saving your draft…'); retryButton.hidden = true;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => { void persist(); }, 250);
  }
  function persist() {
    clearTimeout(saveTimer); saveTimer = null;
    if (sealed || savedVersion === version || saving && queuedVersion === version) return pendingSave;
    const snapshot = structuredClone(draft); const writtenJournal = journal; const revision = version;
    queuedVersion = revision; saving = true;
    setText(saveStatus, 'Saving your draft…');
    if (active()) retryButton.hidden = true;
    // A failed save resolves false, allowing the next full snapshot (or explicit retry) to run.
    pendingSave = pendingSave.then(async () => {
      try {
        await ctx.store.saveAssessmentDraft(attempt.id, snapshot);
        clearJournal(attempt.id, writtenJournal); savedVersion = revision;
        if (revision === version) {
          saveError = null; setText(saveStatus, 'Draft saved on this device'); clearError('save');
          if (active()) retryButton.hidden = true;
        }
        return true;
      } catch (error) {
        if (revision === version) {
          saveError = error; setText(saveStatus, 'Draft not saved. Retry before leaving.');
          if (active()) retryButton.hidden = false;
          report(error, 'save');
        }
        return false;
      } finally { if (queuedVersion === revision) saving = false; }
    });
    return pendingSave;
  }

  function updateClock() {
    if (!active()) return;
    const ms = (ctx.store.state.activity ?? []).filter(segment => segment.sessionId === attempt.id).reduce((sum, segment) => sum + segment.ms, 0);
    setText(root.querySelector('[data-assessment-clock]'), `${duration(ms)} saved active practice${submitting ? ' · paused for submission' : clockStatus.paused ? ' · paused' : ''}`);
    setText(pauseButton, manuallyPaused ? 'Resume practice timer' : 'Pause practice timer');
  }
  const clock = createPracticeClock({ sessionId: attempt.id, timeZone: ctx.store.state.preferences.timeZone,
    onSegments: async segments => { try { await ctx.store.addActivity(segments); updateClock(); } catch (error) { report(error, 'clock'); } },
    onTick: status => { clockStatus = status; updateClock(); },
  });
  const stopClock = () => (clockStop ??= clock.stop());

  function bindReveal(button, host, kind, refId, content) {
    let shown = false; let pending = false;
    const recorded = () => draft.events.some(event => event.kind === kind && event.phase === 'assessment' && event.refId === refId);
    const show = () => {
      if (!editable()) return;
      host.innerHTML = content(); host.hidden = false; shown = true;
      button.textContent = kind === 'answer_reveal' ? 'Answer revealed' : 'Translation revealed';
      button.setAttribute('aria-expanded', 'true'); button.disabled = true;
    };
    if (recorded()) show();
    listen(button, 'click', async () => {
      if (!practice || !editable() || pending || shown) return;
      pending = true; pendingReveals++; button.disabled = true; updateLock();
      try {
        if (!recorded()) {
          if (draft.events.length >= 100) throw new Error('This attempt’s support history is full. Submit it before starting another supported attempt.');
          draft.events.push({ id: crypto.randomUUID(), kind, phase: 'assessment', refId, at: Date.now() });
          changed();
        }
        // Neither answer keys nor English reading text enter the DOM before this save succeeds.
        if (await persist()) show();
      } catch (error) { report(error, 'support'); }
      finally { pending = false; pendingReveals--; if (active()) { button.disabled = shown; updateLock(); } }
    });
  }

  function updateOrder(item, host) {
    if (!active()) return;
    const order = draft.answers[item.id] ?? [];
    host.querySelector('[data-order-answer]').innerHTML = order.map(id => `<li lang="de">${esc(item.tokens.find(token => token.id === id).text)}</li>`).join('');
    setText(host.querySelector('[data-order-status]'), `${order.length} of ${item.tokens.length} tokens added${order.length ? '' : ' · Choose a token to begin'}`);
    host.querySelectorAll('[data-order-token]').forEach(button => button.setAttribute('aria-disabled', String(order.includes(button.dataset.orderToken))));
    for (const selector of ['[data-order-undo]', '[data-order-reset]']) host.querySelector(selector).setAttribute('aria-disabled', String(!order.length));
  }
  for (const item of definition.items) {
    const host = itemNodes.get(item.id);
    listen(host, 'input', event => {
      if (!editable()) return;
      const input = event.target;
      if (input.matches('[data-assessment-text]')) draft.answers[item.id] = input.value;
      else if (input.matches('[data-assessment-slot]')) draft.answers[item.id] = { ...draft.answers[item.id], [input.dataset.assessmentSlot]: input.value };
      else return;
      changed();
    });
    listen(host, 'change', event => {
      if (!editable() || !event.target.matches('[data-assessment-choice]')) return;
      draft.answers[item.id] = event.target.value; changed();
    });
    if (item.type === 'order') {
      updateOrder(item, host);
      listen(host, 'click', event => {
        const button = event.target.closest('[data-order-token], [data-order-undo], [data-order-reset]');
        if (!editable() || !button || button.getAttribute('aria-disabled') === 'true') return;
        const order = draft.answers[item.id] ?? [];
        draft.answers[item.id] = button.hasAttribute('data-order-token') ? [...order, button.dataset.orderToken] : button.hasAttribute('data-order-undo') ? order.slice(0, -1) : [];
        changed(); updateOrder(item, host);
      });
    }
    if (practice) bindReveal(host.querySelector('[data-assessment-reveal]'), host.querySelector('[data-assessment-answer]'), 'answer_reveal', item.id, () => revealedAnswer(item));
  }
  if (practice) {
    root.querySelectorAll('[data-assessment-stimulus]').forEach(host => {
      const stimulus = definition.stimuli.find(item => item.id === host.dataset.assessmentStimulus);
      if (stimulus.en) bindReveal(host.querySelector('[data-assessment-translation]'), host.querySelector('[data-assessment-translation-content]'), 'question_translation', stimulus.id, () => `<p lang="en">${esc(stimulus.en)}</p><p class="fine">This translation is recorded as support for this attempt.</p>`);
    });
  }
  root.querySelectorAll('[data-reading-index]').forEach(button => listen(button, 'click', () => {
    if (!editable()) return;
    const heading = root.querySelector(`#assessment-reading-${button.dataset.readingIndex}`);
    heading.focus({ preventScroll: true }); heading.scrollIntoView({ block: 'start' });
  }));
  const textarea = root.querySelector('[data-assessment-writing]');
  if (textarea) {
    // Setting the value once also preserves a leading newline that HTML textarea parsing strips.
    textarea.value = draft.text;
    listen(textarea, 'input', () => { if (editable()) { draft.text = textarea.value; changed(); } });
  }
  listen(retryButton, 'click', () => { if (editable()) void persist(); });
  listen(pauseButton, 'click', () => {
    if (!editable()) return;
    manuallyPaused = !manuallyPaused;
    if (manuallyPaused) ctx.speech.stop();
    clock.setPaused(manuallyPaused);
  });

  async function submit() {
    if (writing && (!draft.text.trim() || draft.text.length > 3000)) {
      report(new Error('Write a response before submitting (up to 3,000 characters).'), 'submit'); textarea.focus(); return;
    }
    submitting = true; clearError(); updateLock(); ctx.speech.stop(); clock.setPaused(true);
    try {
      if (!await persist() || !active()) return;
      await clock.flush();
      if (!active()) return;
      await ctx.store.submitAssessment(attempt.id);
      sealed = true;
      await stopClock();
      if (!active()) return;
      el.innerHTML = submittedHTML(definition, attempt.id);
      // Do not await navigation: the router may be waiting for this view's cleanup.
      ctx.go(resultRoute);
    } catch (error) { report(error, 'submit'); }
    finally { submitting = false; if (active() && !sealed) { updateLock(); clock.setPaused(manuallyPaused); } }
  }
  listen(form, 'submit', event => {
    event.preventDefault();
    if (!editable() || pendingReveals) return;
    submissionTask = submit().catch(error => report(error, 'submit'));
  });

  function cleanup() {
    if (cleanupTask) return cleanupTask;
    alive = false; listeners.abort(); ctx.signal?.removeEventListener('abort', aborted);
    ctx.speech.stop();
    const finalSave = persist();
    const stopped = stopClock();
    cleanupTask = (async () => {
      const results = await Promise.allSettled([finalSave, submissionTask, stopped]);
      const failure = results.find(result => result.status === 'rejected');
      if (failure) throw failure.reason;
      if (results[0].value === false) throw saveError ?? new Error('The assessment draft could not be saved.');
    })();
    return cleanupTask;
  }
  function aborted() { void cleanup().catch(() => {}); }
  ctx.signal?.addEventListener('abort', aborted, { once: true });
  clock.start(); updateClock(); updateProgress(); updateLock();
  return cleanup;
}
