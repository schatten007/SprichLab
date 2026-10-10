import { buildAssessmentGeminiPack, buildAssessmentReportRequest, parseGeminiAssessmentReport } from './assessment-gemini.js';
import { esc, icon, downloadFile, safeAction } from './ui.js';

export function mountAssessmentGemini(host, ctx, attemptId, definition, onImported) {
  const attempt = () => ctx.store.state.assessments.attempts.find(item => item.id === attemptId);
  let prepared = null; let checkedText = '';
  host.innerHTML = `<section class="card section-gap assessment-gemini"><p class="eyebrow">GEMINI · MANUAL HANDOFF</p><h2>${attempt().execution === 'gemini_live' ? 'Practise and get a reported grade on your phone' : 'Ask Gemini to grade this saved response'}</h2>
    <p class="small section-gap">The pack contains the task, scoring rubric, and an identity for this attempt. Copy it into a normal Gemini chat. For a new Live roleplay, use Live on your phone, then return to text for the report. A saved written/transcribed response is graded as text.</p>
    <details><summary>Grading pack preview</summary><textarea data-grade-pack aria-label="Grading pack preview" rows="10" readonly></textarea></details>
    <div class="btn-row section-gap"><button class="btn secondary" data-grade-copy>${icon('book')}Copy grading pack</button><button class="btn secondary" data-grade-download>${icon('download')}Download grading pack</button><button class="btn secondary" data-grade-report>Copy report request</button><button class="btn secondary" data-grade-share ${typeof navigator.share === 'function' ? '' : 'hidden'}>Share grading pack</button></div><p class="fine" role="status" data-grade-copy-status></p>
    <label class="section-gap">Gemini assessment report<textarea data-grade-input aria-label="Gemini assessment report" maxlength="32768" rows="8" placeholder="Paste the JSON report from Gemini here…"></textarea></label>
    <div class="btn-row"><button class="btn secondary" data-grade-validate>Check report</button><button class="btn" data-grade-import hidden>Save imported grade</button><button class="text-button" data-grade-note>Keep as an ungraded note</button></div>
    <div data-grade-import-preview role="status" class="section-gap"></div><p class="fine section-gap">An imported report is not authenticated evidence from Gemini. Sprich checks the identities, quotations where available, and arithmetic; it does not verify an external Live performance. No API key is required for this handoff.</p></section>`;
  const editor = host.querySelector('[data-grade-pack]');
  const input = host.querySelector('[data-grade-input]');
  const status = host.querySelector('[data-grade-copy-status]');
  const preview = host.querySelector('[data-grade-import-preview]');
  const save = host.querySelector('[data-grade-import]');
  const currentPack = () => buildAssessmentGeminiPack(attempt(), definition);
  editor.value = currentPack();
  const copy = async value => {
    ctx.speech.stop(); editor.value = value;
    try { await navigator.clipboard.writeText(value); status.textContent = 'Copied. Paste it into the same Gemini chat.'; }
    catch { host.querySelector('details').open = true; editor.focus(); editor.select(); status.textContent = 'Copy the selected text manually, or download the pack.'; }
  };
  safeAction(host.querySelector('[data-grade-copy]'), () => copy(currentPack()), ctx.error);
  safeAction(host.querySelector('[data-grade-report]'), () => copy(buildAssessmentReportRequest(attempt(), definition)), ctx.error);
  safeAction(host.querySelector('[data-grade-download]'), () => { ctx.speech.stop(); downloadFile(currentPack(), `sprich-${definition.id}-graded.txt`, 'text/plain;charset=utf-8'); }, ctx.error);
  safeAction(host.querySelector('[data-grade-share]'), async () => {
    ctx.speech.stop();
    try { await navigator.share({ title: `Sprich · ${definition.title}`, text: currentPack() }); }
    catch (error) { if (error.name !== 'AbortError') await copy(currentPack()); }
  }, ctx.error);
  input.addEventListener('input', () => { prepared = null; save.hidden = true; preview.textContent = ''; });
  safeAction(host.querySelector('[data-grade-validate]'), async () => {
    const raw = input.value;
    const parsed = await parseGeminiAssessmentReport(raw, attempt(), definition);
    if (ctx.signal?.aborted || input.value !== raw) return;
    prepared = parsed; checkedText = raw;
    const result = parsed.evaluation.result;
    preview.innerHTML = `<strong>${result.percentage === null ? 'Partial / insufficient evidence' : `${result.percentage}% · ${result.earned}/${result.maximum} points`}</strong><p class="fine">Imported Gemini assessment · ${esc(parsed.evaluation.support)}. The percentage is calculated from the criterion marks.</p>`;
    save.hidden = false;
  }, message => { prepared = null; save.hidden = true; preview.textContent = message; ctx.error(message); });
  safeAction(save, async () => {
    if (!prepared || input.value !== checkedText) throw new Error('Check the current report before saving it.');
    await ctx.store.acceptGeminiEvaluation(attemptId, prepared);
    if (ctx.signal?.aborted) return;
    save.hidden = true; preview.textContent = 'Imported grade saved. Re-importing the same report does not add another grade.';
    onImported();
  }, ctx.error);
  safeAction(host.querySelector('[data-grade-note]'), async () => {
    if (!input.value.trim() || input.value.length > 6000) throw new Error('Use 1–6,000 characters for an ungraded note.');
    await ctx.store.addCompanionNote({ id: crypto.randomUUID(), missionId: definition.lessonIds[0], text: input.value, minutes: 0 });
    if (!ctx.signal?.aborted) preview.textContent = 'Saved as an ungraded note in Progress. No score was added.';
  }, ctx.error);
}
