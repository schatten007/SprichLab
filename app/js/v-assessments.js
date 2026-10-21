import '../css/assessments.css';
import { render as renderRun } from './v-assessment-run.js';
import { assessmentChoices, loadAssessmentDefinition } from './assessment-loader.js';
import { assessmentDefinition } from './assessment-state.js';
import { assessmentRubric } from '../../shared/assessment-rubrics.js';
import { runAssessmentJob } from './assessment-jobs.js';
import { mountAssessmentGemini } from './assessment-gemini-ui.js';
import { aiClient, isCancelled } from './ai-gateway.js';
import { esc, icon, pageHeading, safeAction, PROVENANCE } from './ui.js';

export { renderRun };
const labels = { objective: PROVENANCE.checked, writing: `${PROVENANCE.ai} · writing`, roleplay: `${PROVENANCE.ai} · roleplay` };
const sourceLabel = evaluation => evaluation.testMode ? 'Test grader · fixture result' : { 'local-key': PROVENANCE.checked, 'gateway-ai': `${PROVENANCE.ai} · in-app`, 'gemini-import': PROVENANCE.external }[evaluation.source];
const conditionLabel = value => ({ 'no-answer-help-recorded': 'No answer help recorded', 'answer-help-recorded': 'Answer help recorded', 'external-claim': 'Externally reported conditions' }[value] ?? value);

export async function startAssessment(ctx, definition, { mode = 'practice', execution = 'in_app', parentAttemptId = null } = {}) {
  const id = await ctx.store.createAssessmentAttempt(definition, { mode, execution, parentAttemptId });
  if (definition.kind === 'roleplay' && execution === 'in_app') {
    const conversationId = await ctx.store.startAssessmentConversation(id);
    ctx.go(`ai/session/${conversationId}`);
  } else ctx.go(`${execution === 'gemini_live' ? 'assessment-result' : 'assessment'}/${id}`);
  return id;
}

export async function render(el, ctx, lessonId = null) {
  const choices = assessmentChoices(lessonId);
  let filter = 'all'; let level = 'all'; let query = ''; let shown = 12; let starting = false;
  el.innerHTML = `<div class="assessment-page">${pageHeading('CHECK WHAT YOU CAN DO', 'Checks and graded roleplays', 'Choose supported practice or a checkpoint. Local questions use answer keys; writing and conversation grades are labelled AI estimates.')}
    <div class="assessment-hero-bar"><div><p class="eyebrow">EVIDENCE, NOT A LABEL</p><strong>Try one small task. See the conditions beside the result.</strong><p class="fine">Practice records help. Checkpoints keep answer help hidden until submission.</p></div><a class="btn secondary" href="#lessons">Back to lessons ${icon('arrow')}</a></div>
    <div class="assessment-catalog-layout section-gap"><aside class="card assessment-filters" aria-label="Assessment filters"><div class="card-title"><div><p class="eyebrow">01 · SET THE CONDITIONS</p><h2>Choose your mode</h2></div><span class="assessment-icon">${icon('settings')}</span></div>
      <label>Assessment mode<select aria-label="Assessment mode" id="assessment-mode"><option value="practice">Practice · help recorded</option><option value="checkpoint">Checkpoint · answers after submission</option></select></label>
      <label>Skill<select id="assessment-kind"><option value="all">All assessment types</option><option value="objective">Vocabulary, grammar & reading</option><option value="writing">Free writing</option><option value="roleplay">Conversation</option></select></label>
      <label>Target level<select id="assessment-level"><option value="all">All levels</option>${['starter', 'A1', 'A2', 'B1'].map(item => `<option value="${item}">${item}</option>`).join('')}</select></label>
      <label>Find an assessment<input id="assessment-search" type="text" placeholder="Café, appointment, lesson title…"></label>
      <div class="assessment-filter-note"><span class="assessment-icon">${icon('eye')}</span><p class="fine">A score describes one submitted task and its conditions. It does not certify a language level. Your lessons stay open regardless of the result.</p></div></aside>
      <section class="assessment-catalog-body" aria-label="Assessment catalog"><div class="assessment-catalog-heading"><div><p class="eyebrow">02 · PICK A TASK</p><h2>Published checks</h2></div><span class="pill">60 pilot questions · 4 writing tasks · roleplays for every lesson</span></div>
        <p class="fine" id="assessment-count" aria-live="polite"></p><div class="assessment-catalog-grid" id="assessment-list"></div><button class="btn secondary section-gap" id="assessment-more">Show more assessments</button></section></div>
    <section class="card section-gap assessment-history"><div class="card-title"><div><p class="eyebrow">03 · RETURN TO YOUR WORK</p><h2>Saved assessment attempts</h2></div><span class="pill">On this device</span></div><div id="assessment-history" class="starter-progress-list"></div></section></div>`;
  const draw = () => {
    const matching = choices.filter(item => (filter === 'all' || item.kind === filter) && (level === 'all' || item.level === level) && `${item.title} ${item.kind}`.toLowerCase().includes(query));
    const visible = matching.slice(0, shown);
    el.querySelector('#assessment-count').textContent = `${visible.length} of ${matching.length} matching assessments`;
    el.querySelector('#assessment-list').innerHTML = visible.map(item => `<article class="card assessment-card starter-lesson"><div class="assessment-card-top"><div class="pills"><span class="pill">${esc(item.level)}</span><span class="pill">${labels[item.kind]}</span></div><span class="assessment-card-icon">${icon(item.kind === 'objective' ? 'check' : item.kind === 'writing' ? 'book' : 'messages')}</span></div><h2>${esc(item.title)}</h2><p class="fine">${item.kind === 'objective' ? 'A short answer-key check across vocabulary, grammar, reading and constrained writing.' : item.kind === 'writing' ? 'Write a short practical message, then request an in-app estimate or a Gemini report.' : 'Practise the scenario and receive criterion-level feedback. Grading uses your actual submitted words.'}</p>
      <p class="assessment-card-boundary">${item.kind === 'objective' ? 'Checked locally · no gateway needed' : item.kind === 'writing' ? 'AI estimate or imported Gemini report' : 'Conversation evidence · no pronunciation score'}</p><div class="btn-row"><button class="btn" data-start-assessment="${item.id}">${item.kind === 'objective' ? 'Start check' : item.kind === 'writing' ? 'Start writing' : 'Talk in app'}</button>${item.kind === 'roleplay' ? `<button class="btn secondary" data-start-assessment="${item.id}" data-gemini-live>Use Gemini Live</button>` : ''}</div></article>`).join('') || '<p class="card assessment-empty">No matching assessments. Try another filter.</p>';
    el.querySelector('#assessment-more').hidden = visible.length === matching.length;
  };
  draw();
  const history = [...ctx.store.state.assessments.attempts].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 12);
  el.querySelector('#assessment-history').innerHTML = history.map(attempt => {
    const def = assessmentDefinition(ctx.store.state.assessments, attempt);
    const route = attempt.state === 'submitted' || attempt.execution === 'gemini_live' ? `assessment-result/${attempt.id}` : attempt.aiSessionId ? `ai/session/${attempt.aiSessionId}` : `assessment/${attempt.id}`;
    return `<a href="#${route}"><span><strong>${esc(def.title)}</strong><small>${esc(def.level)} · ${attempt.mode} · ${attempt.state}</small></span><span>Open ${icon('arrow')}</span></a>`;
  }).join('') || '<p class="fine section-gap">Your first submitted check will appear here.</p>';
  el.querySelector('#assessment-kind').addEventListener('change', event => { filter = event.target.value; shown = 12; draw(); });
  el.querySelector('#assessment-level').addEventListener('change', event => { level = event.target.value; shown = 12; draw(); });
  el.querySelector('#assessment-search').addEventListener('input', event => { query = event.target.value.trim().toLowerCase(); shown = 12; draw(); });
  el.querySelector('#assessment-more').addEventListener('click', () => { shown += 12; draw(); });
  el.addEventListener('click', async event => {
    const button = event.target.closest('[data-start-assessment]');
    if (!button || starting) return;
    starting = true; button.disabled = true;
    try {
      const definition = await loadAssessmentDefinition(ctx.store, button.dataset.startAssessment, null, { signal: ctx.signal });
      if (!ctx.signal.aborted) await startAssessment(ctx, definition, { mode: el.querySelector('#assessment-mode').value, execution: button.hasAttribute('data-gemini-live') ? 'gemini_live' : 'in_app' });
    } catch (error) { if (!ctx.signal.aborted) ctx.error(error.message); }
    finally { starting = false; if (button.isConnected) button.disabled = false; }
  }, { signal: ctx.signal });
}

function answerText(item, value) {
  if (value === null || value === undefined || value === '') return 'Unanswered';
  if (item.type === 'choice') return item.options.find(option => option.id === value)?.text ?? 'Unknown option';
  if (item.type === 'slots') return item.parts.map(part => `${part.label}: ${value?.[part.id] || '—'}`).join(' · ');
  if (item.type === 'order') return value.map(id => item.tokens.find(token => token.id === id)?.text ?? '').join(' ') || 'Unanswered';
  return value;
}
function expectedText(item) {
  if (item.type === 'choice') return item.options.find(option => option.id === item.answer).text;
  if (item.type === 'text') return item.accepted.join(' / ');
  if (item.type === 'slots') return item.parts.map(part => `${part.label}: ${part.accepted.join(' / ')}`).join(' · ');
  return item.orders.map(order => order.map(id => item.tokens.find(token => token.id === id).text).join(' ')).join(' / ');
}
function resultHTML(evaluation, attempt, definition) {
  const result = evaluation.result;
  const learnerModes = attempt.submission.kind === 'roleplay' ? new Set(attempt.submission.turns.filter(turn => turn.role === 'learner').map(turn => turn.inputMode)) : null;
  const basis = attempt.submission.kind === 'external' ? 'External Live performance · reported, not verified'
    : attempt.submission.kind === 'writing' ? 'Submitted written text'
      : learnerModes ? learnerModes.has('transcribed') ? 'Conversation transcripts · no acoustic grading' : 'Typed conversation · not speaking evidence'
        : 'Submitted written/selected answers';
  const score = result.percentage === null ? 'Not enough evidence for a complete score' : `${result.percentage}%`;
  let details;
  if (result.type === 'keyed') {
    details = `<div class="assessment-breakdown">${['vocabulary', 'grammar', 'reading', 'writing'].map(domain => {
      const rows = result.items.filter(item => item.domain === domain);
      return `<span class="pill">${domain}: ${rows.reduce((sum, item) => sum + item.earned, 0)}/${rows.reduce((sum, item) => sum + item.maximum, 0)}</span>`;
    }).join('')}</div>${result.items.map(row => {
      const item = definition.items.find(item => item.id === row.itemId);
      return `<details class="card section-gap"><summary>${esc(item.promptEn)} · ${row.earned}/${row.maximum}</summary><p class="section-gap"><strong>Your answer:</strong> ${esc(answerText(item, attempt.submission.answers[item.id]))}</p><p><strong>Accepted:</strong> <span lang="de">${esc(expectedText(item))}</span></p><p lang="de">${esc(item.feedback.de)}</p><p lang="en">${esc(item.feedback.en)}</p></details>`;
    }).join('')}${definition.stimuli.map(stimulus => `<details class="card section-gap"><summary>Reading text and translation</summary><p class="section-gap" lang="de">${esc(stimulus.de)}</p><p lang="en">${esc(stimulus.en)}</p></details>`).join('')}`;
  } else {
    const rubric = assessmentRubric(definition.rubricId);
    details = `<div class="assessment-ratings">${rubric.criteria.map(([id, title]) => {
      const rating = result.raw.ratings.find(item => item.id === id);
      return `<section class="card section-gap"><h3>${title} · ${rating.score === null ? 'Not observed' : `${rating.score}/4`}</h3><p class="small section-gap">${esc(rating.reasonEn)}</p>${rating.evidence.map(quote => `<blockquote lang="de">${esc(quote.quote)}</blockquote>`).join('')}</section>`;
    }).join('')}</div>${result.raw.strengths.length ? `<h3 class="section-gap">What worked</h3><ul>${result.raw.strengths.map(strength => `<li>${esc(strength)}</li>`).join('')}</ul>` : ''}
      ${result.raw.corrections.map(correction => `<section class="card section-gap"><p lang="de"><s>${esc(correction.original)}</s> → <strong>${esc(correction.corrected)}</strong></p><p lang="en">${esc(correction.explanationEn)}</p><p class="fine" lang="de">${esc(correction.explanationDe)}</p></section>`).join('')}
      <section class="card section-gap"><p class="eyebrow">TRY NEXT</p><p lang="de">${esc(result.raw.retryDe)}</p><p lang="en">${esc(result.raw.retryEn)}</p></section>`;
  }
  const summary = `<section class="card assessment-score"><div class="pills"><span class="pill ${evaluation.testMode ? 'amber' : 'green'}">${sourceLabel(evaluation)}</span><span class="pill">${conditionLabel(evaluation.support)}</span></div><p class="eyebrow section-gap">TASK RESULT</p><h2 class="section-gap" data-assessment-score>${score}</h2><p>${result.earned}/${result.maximum} observed points · target ${esc(definition.level)} · ${attempt.mode}</p><p class="fine">${basis}</p><p class="fine">This describes one submitted task. It does not award a language level. ${evaluation.model ? `Model: ${esc(evaluation.model)}${evaluation.promptVersion ? ` · ${esc(evaluation.promptVersion)}` : ''}.` : ''}</p><div class="assessment-score-boundary">Evidence is kept with the task conditions and source. It is not a certificate.</div></section>`;
  const feedback = `<section class="card assessment-feedback"><div class="card-title"><div><p class="eyebrow">READ THE EVIDENCE</p><h2>Feedback and next step</h2></div><span class="assessment-icon">${icon('eye')}</span></div>${details}</section>`;
  return `<div class="assessment-result-workspace">${summary}${feedback}</div>${evaluation.externalNotes ? `<section class="card section-gap assessment-external-notes"><h3>Additional Gemini observations · externally reported</h3><p>${esc(evaluation.externalNotes.delivery)}</p><p>${esc(evaluation.externalNotes.assistance)}</p></section>` : ''}`;
}

export async function renderResult(el, ctx, id) {
  let alive = true; let busy = false; let selected = null;
  const client = ctx.aiClient ?? aiClient;
  const getAttempt = () => ctx.store.state.assessments.attempts.find(item => item.id === id);
  const initial = getAttempt();
  if (!initial) throw new Error('This assessment is not saved on this device.');
  const definition = assessmentDefinition(ctx.store.state.assessments, initial);
  el.innerHTML = `<div class="assessment-page assessment-result-page">${pageHeading('YOUR ASSESSMENT', definition.title, 'Results keep the submitted response, grading method, and support conditions together.')}
    <div class="assessment-result-banner"><div class="pills"><span class="pill">Target: ${esc(definition.level)}</span><span class="pill">${initial.mode}</span><span class="pill">${initial.execution === 'gemini_live' ? 'External handoff' : 'Saved locally'}</span></div><p class="fine">A missing or failed grade is not a zero. Re-open the task or choose a new grading action below.</p></div><div class="section-gap" id="assessment-result"></div>
    <div class="assessment-result-tools section-gap"><div id="assessment-artifact"></div><div id="assessment-job"></div></div>
    <div class="section-gap" id="assessment-evaluations"></div><div id="assessment-gemini"></div>
    <section class="card section-gap"><h2>Keep practising</h2><div class="btn-row section-gap"><button class="btn secondary" id="assessment-retake">Try a new attempt</button><a class="btn secondary" href="#assessments">All checks</a>${definition.lessonIds.map(lessonId => `<a class="inline-link" href="#${lessonId.startsWith('starter-') ? `lesson/${lessonId}` : 'practice'}">Review the related lesson ${icon('arrow')}</a>`).join('')}</div><p class="fine section-gap">A retry is saved separately from your first submission. Assessment grades do not add spoken-mastery or spaced-recall credit.</p></section>`;
  const act = action => async () => {
    if (busy || !alive) return; busy = true; draw();
    try { await action(); }
    catch (error) { if (alive && !isCancelled(error)) ctx.error(error.message); }
    finally { busy = false; if (alive) draw(); }
  };
  const draw = () => {
    if (!alive) return;
    const progress = ctx.store.state.assessments; const attempt = getAttempt();
    const evaluations = progress.evaluations.filter(item => item.attemptId === id);
    const evaluation = evaluations.find(item => item.id === selected) ?? evaluations.find(item => item.id === attempt.activeEvaluationId) ?? evaluations.at(-1);
    const job = progress.jobs.filter(item => item.attemptId === id).at(-1);
    el.querySelector('#assessment-result').innerHTML = evaluation ? resultHTML(evaluation, attempt, definition)
      : `<section class="card"><h2>${attempt.execution === 'gemini_live' ? 'Ready for your Gemini roleplay' : attempt.state === 'submitted' ? 'Response saved · awaiting a grade' : 'This attempt is not submitted yet'}</h2><p class="fine section-gap">${attempt.execution === 'gemini_live' ? 'No grade is recorded until you import a valid report. Copy your prepared pack below.' : 'There is no score yet. Missing or failed grading is not a score of zero.'}</p></section>`;
    const canGrade = attempt.state === 'submitted' && attempt.execution === 'in_app' && definition.kind !== 'objective';
    el.querySelector('#assessment-job').innerHTML = canGrade ? `<section class="card"><h2>In-app AI grading</h2>${job?.lastError ? `<p class="callout section-gap" role="status">${esc(job.lastError.message)}</p>` : ''}
      <div class="btn-row section-gap">${!job || ['failed', 'uncertain'].includes(job.state) ? `<button class="btn" id="request-assessment-grade" ${busy ? 'disabled' : ''}>${job ? 'Request a new grade' : 'Grade with in-app AI'}</button>` : ''}
      ${job && (['pending', 'sending', 'uncertain'].includes(job.state) || job.state === 'failed' && job.lastError?.code === 'locked') ? `<button class="btn secondary" id="recover-assessment-grade" ${busy ? 'disabled' : ''}>Check for my grade</button>` : ''}
      ${job?.state === 'retryable' ? `<button class="btn secondary" id="retry-assessment-grade" ${busy ? 'disabled' : ''}>Retry after cooldown</button>` : ''}
      ${job?.state === 'queued' ? `<button class="btn" id="send-assessment-grade" ${busy ? 'disabled' : ''}>Send saved response for grading</button>` : ''}
      <a class="inline-link" href="#ai">Gateway setup / unlock</a></div><p class="fine section-gap">Grading sends the sealed text to the configured gateway. The review quota also applies to assessments. A new grading request may use another provider request.</p></section>` : '';
    el.querySelector('#request-assessment-grade')?.addEventListener('click', act(async () => {
      const nextJob = await ctx.store.ensureAssessmentJob(id, { retryUncertain: Boolean(job) });
      await runAssessmentJob(ctx.store, client, nextJob.id, { signal: ctx.signal });
    }));
    el.querySelector('#recover-assessment-grade')?.addEventListener('click', act(() => runAssessmentJob(ctx.store, client, job.id, { signal: ctx.signal, recoverOnly: true })));
    el.querySelector('#retry-assessment-grade')?.addEventListener('click', act(() => runAssessmentJob(ctx.store, client, job.id, { signal: ctx.signal })));
    el.querySelector('#send-assessment-grade')?.addEventListener('click', act(() => runAssessmentJob(ctx.store, client, job.id, { signal: ctx.signal })));
    el.querySelector('#assessment-evaluations').innerHTML = evaluations.length > 1 ? `<section class="card"><h2>Saved evaluations</h2><div class="btn-row section-gap">${evaluations.map(item => `<button class="btn secondary" data-select-evaluation="${item.id}">${sourceLabel(item)} · ${item.result.percentage ?? 'partial'}${item.result.percentage === null ? '' : '%'}</button>`).join('')}</div></section>` : '';
    el.querySelectorAll('[data-select-evaluation]').forEach(button => button.addEventListener('click', () => { selected = button.dataset.selectEvaluation; draw(); }));
  };
  draw();
  const submission = initial.submission;
  if (submission?.kind === 'writing') el.querySelector('#assessment-artifact').innerHTML = `<details class="card"><summary>Your sealed writing</summary><p class="assessment-reading-text section-gap" lang="de">${esc(submission.text)}</p></details>`;
  if (submission?.kind === 'roleplay') el.querySelector('#assessment-artifact').innerHTML = `<details class="card"><summary>Your assessed conversation</summary>${submission.turns.filter(turn => turn.role !== 'control').map(turn => `<p class="section-gap"><strong>${turn.role === 'learner' ? 'You' : 'Partner'}:</strong> <span lang="de">${esc(turn.text)}</span></p>`).join('')}</details>`;
  if (definition.kind !== 'objective' && (initial.state === 'submitted' || initial.execution === 'gemini_live')) mountAssessmentGemini(el.querySelector('#assessment-gemini'), ctx, id, definition, () => { selected = ctx.store.state.assessments.evaluations.filter(item => item.attemptId === id).at(-1)?.id; draw(); });
  safeAction(el.querySelector('#assessment-retake'), async () => {
    const fresh = await loadAssessmentDefinition(ctx.store, definition.id, null, { signal: ctx.signal });
    if (!ctx.signal.aborted) await startAssessment(ctx, fresh, { mode: initial.mode, execution: initial.execution, parentAttemptId: initial.id });
  }, ctx.error);
  // Recover only an existing receipt; visiting/importing this page never POSTs another evaluation.
  const pending = ctx.store.state.assessments.jobs.filter(job => job.attemptId === id).at(-1);
  if (pending && ['sending', 'pending'].includes(pending.state)) void act(() => runAssessmentJob(ctx.store, client, pending.id, { signal: ctx.signal, recoverOnly: true }))();
  return () => { alive = false; ctx.speech.stop(); };
}
