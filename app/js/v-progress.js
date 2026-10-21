import '../css/evidence.css';
import { MISSIONS, missionById } from '../data/missions.js';
import { esc, icon, minutes, duration, pageHeading, outcomeLabel, provenance, howLink, progressBar } from './ui.js';
import { starterLessonById, COURSE_LESSONS } from '../data/starter-catalog.js';
import { wordProgressSummary } from './starter-progress.js';
import { rewards, STREAK_FLOOR_MS } from './rewards.js';

const gradeSources = { 'local-key': 'checked', 'gateway-ai': 'ai', 'gemini-import': 'external' };
const conditions = { 'no-answer-help-recorded': 'No answer help recorded', 'answer-help-recorded': 'Answer help recorded', 'external-claim': 'Externally reported conditions' };

function sourceCard(source, symbol, title, body, note) {
  return `<article class="evidence-card" data-source="${source}"><div class="evidence-card-top">${provenance(source)}${icon(symbol)}</div><h3>${title}</h3>${body}<p class="evidence-card-note">${note}</p></article>`;
}

export function render(el, ctx) {
  const state = ctx.store.state;
  const reward = rewards(state);
  const stats = reward.stats;
  const days = reward.week;
  const recorded = stats.speaking.filter(attempt => attempt.recordingMs > 0 && ['intro', 'retry'].includes(attempt.taskId))
    .sort((a, b) => a.completedAt - b.completedAt);
  const recordedMissions = MISSIONS.filter(mission => recorded.some(attempt => attempt.missionId === mission.id));
  let compareMission = recorded.at(-1)?.missionId;
  const urls = new Set();
  const beginner = state.starter;
  const words = wordProgressSummary(beginner);
  const completedLessons = new Set(beginner.sessions.filter(session => session.completedAt).map(session => session.lessonId)).size;
  const spokenStarter = stats.starterResponses.filter(response => response.spoken).length;
  const savedStarterAudio = beginner.sessions.flatMap(session => session.responses.filter(response => response.recordingMs > 0).map(response => ({ ...response, title: session.content.lesson.title })))
    .sort((a, b) => b.completedAt - a.completedAt).slice(0, 4);
  const notes = [...state.companionNotes].sort((a, b) => b.createdAt - a.createdAt).slice(0, 8);
  const evaluations = (state.assessments?.evaluations ?? []).filter(evaluation => !evaluation.testMode);
  const grades = [...evaluations].sort((a, b) => b.createdAt - a.createdAt).slice(0, 10);
  const gradeCount = source => evaluations.filter(evaluation => evaluation.source === source).length;
  const reflections = beginner.plans.filter(plan => plan.reflection).slice(-5).reverse();
  const recent = [
    ...state.sessions.map(session => ({ session, route: 'session', title: session.kind === 'review' ? 'Phrase recall' : session.kind === 'resource' ? session.content.resource.title : session.content.mission.shortTitle })),
    ...beginner.sessions.map(session => ({ session, route: 'learn', title: session.content.lesson.title })),
    ...beginner.wordSessions.map(session => ({ session, route: 'word-session', title: `Word practice · ${{ meaning: 'Recognise the meaning', recall: 'Say the German word', sentence: 'Use it in a sentence' }[session.mode]}` })),
  ].sort((a, b) => b.session.createdAt - a.session.createdAt).slice(0, 12);
  const weekMax = Math.max(STREAK_FLOOR_MS, ...days.map(day => day.ms));

  el.innerHTML = `<div class="evidence-page">
    <header class="evidence-header">${pageHeading('PROGRESS & EVIDENCE', 'Notice what is getting easier.', 'Your practice, your recordings, and the source behind every result.')}
      <div class="evidence-local"><span class="eyebrow">ON THIS DEVICE</span><p>Audio stays in this browser. Backups carry your progress, not the clips.</p><a class="btn secondary small-btn" href="#settings">${icon('download')}Export progress</a>${howLink()}</div></header>

    <div class="evidence-overview">
      <section class="card progress-week"><div class="card-title"><div><p class="eyebrow">THIS WEEK</p><h2>Keep the small routine</h2></div>${provenance('measured')}</div>
        <div class="progress-kpis"><div><strong>${minutes(stats.weekMs)}<small> min</small></strong><span>active practice · last 7 days</span></div><div><strong>${reward.streak.streak}</strong><span>${reward.streak.streak === 1 ? 'day' : 'days'} in a row · ${reward.streak.restLeft} rest left</span></div><div><strong>${minutes(stats.recordingMs)}<small> min</small></strong><span>recorded responses · all time</span></div></div>
        <div class="evidence-rhythm">
          <div class="evidence-goal"><div class="evidence-ring" style="--goal:${reward.ring.pct}%" aria-hidden="true"><div><strong>${minutes(reward.ring.ms)}</strong><span>/ ${reward.ring.goalMs / 60_000} min</span></div></div><h3>Today's goal</h3>${progressBar(reward.ring.pct, `Today's goal: ${reward.ring.pct} per cent`)}<p class="fine">${minutes(reward.ring.ms)} of ${reward.ring.goalMs / 60_000} minutes today</p><a class="inline-link" href="#settings">Adjust your goal</a></div>
          <figure class="evidence-week"><figcaption>Last 7 days <span>Measured minutes</span></figcaption><ol>${days.map(day => `<li class="evidence-day" data-today="${day.day === stats.today}" data-qualified="${day.qualifies}"><time datetime="${day.day}" title="${day.day}">${day.day === stats.today ? 'Today' : new Date(`${day.day}T12:00:00Z`).toLocaleDateString(undefined, { weekday: 'short', timeZone: 'UTC' })}</time><div class="evidence-day-track" aria-hidden="true"><span style="height:${day.ms / weekMax * 100}%"></span></div><strong>${minutes(day.ms)} min</strong><small>${day.qualifies ? '15m+' : '—'}</small></li>`).join('')}</ol><p class="fine">${days.filter(day => day.qualifies).length} of 7 days reached 15 minutes. Rest days available: ${reward.streak.restLeft} / 2.</p></figure>
        </div><p class="evidence-footnote">A missed day never removes saved practice. The streak counts routine, not German ability.</p>
      </section>

      <section class="card evidence-milestones"><div class="card-title"><div><p class="eyebrow">MILESTONES</p><h2>Small wins worth noticing</h2></div>${icon('spark')}</div>
        ${reward.next ? `<div class="milestone-next"><p class="eyebrow">NEXT EFFORT MILESTONE</p>${provenance(reward.next.prov)}<h3>Next: ${esc(reward.next.label)}</h3><p class="evidence-target"><strong>${reward.next.value}</strong> / ${reward.next.target} ${esc(reward.next.unit)}</p>${progressBar(reward.next.value / reward.next.target * 100, `${reward.next.label}: ${reward.next.display} of ${reward.next.goal}`)}<p class="fine">${reward.next.target - reward.next.value} ${esc(reward.next.unit)} to the next milestone.</p></div>` : '<p class="small">You have reached every current effort milestone. Keep a useful practice going.</p>'}
        <div class="evidence-earned">${reward.earned.length ? reward.earned.map(item => `<div class="milestone"><span class="pill green">${icon('check')} Earned</span><div><h3>${esc(item.label)}</h3><p>${esc(item.display)}</p>${provenance(item.prov)}</div></div>`).join('') : '<p class="small muted">Your first milestone is waiting for one small practice session.</p>'}</div>
        <a class="inline-link" href="#lessons">Open your path ${icon('arrow')}</a>
      </section>
    </div>

    <section class="evidence-section"><div class="card-title"><div><p class="eyebrow">SIX SOURCES, CLEARLY LABELLED</p><h2>What you have practised</h2></div><a class="inline-link" href="#words">Open vocabulary ${icon('arrow')}</a></div>
      <div class="evidence-grid">
        ${sourceCard('measured', 'clock', 'Time you put in', `<dl class="evidence-metrics"><div><dt>Active practice · last 7 days</dt><dd>${minutes(stats.weekMs)} min</dd></div><div><dt>Recorded responses · all time</dt><dd>${minutes(stats.recordingMs)} min</dd></div></dl>`, 'Active time and recording length are different measures. Recordings include pauses.')}
        ${sourceCard('self-rated', 'messages', 'Practice you reflected on', `<dl class="evidence-metrics"><div><dt>lessons practised</dt><dd>${completedLessons} / ${COURSE_LESSONS.length}</dd></div><div><dt>German words recalled</dt><dd data-metric="recalled">${words.recalled}</dd></div><div><dt>spoken answers</dt><dd data-metric="spoken">${spokenStarter + stats.speaking.length}</dd></div></dl>`, 'Your own ratings and aloud confirmations. Typed notes do not add spoken answers.')}
        ${sourceCard('checked', 'check', 'Compared with an answer key', `<dl class="evidence-metrics"><div><dt>Saved assessment results</dt><dd data-metric="grades">${gradeCount('local-key')}</dd></div><div><dt>Listening answers checked</dt><dd>${state.attempts.filter(attempt => attempt.kind === 'listening').length}</dd></div></dl>`, 'Authored answers checked in this browser. Support conditions stay with each attempt.')}
        ${sourceCard('reported', 'book', 'Practice beyond the app', `<dl class="evidence-metrics"><div><dt>Publisher-site study</dt><dd>${stats.externalMinutes} min</dd></div><div><dt>Gemini practice</dt><dd>${state.companionNotes.reduce((total, note) => total + note.minutes, 0)} min</dd></div></dl>`, 'Minutes you entered yourself, kept separate from the measured timer.')}
        ${sourceCard('ai', 'spark', 'Feedback on a submitted task', `<dl class="evidence-metrics"><div><dt>Saved assessment results</dt><dd data-metric="grades">${gradeCount('gateway-ai')}</dd></div></dl><p class="small muted">${gradeCount('gateway-ai') ? 'Open a result below to see the rubric, quoted evidence, and corrections.' : 'No saved AI grades yet. A failed or unfinished grade is not a zero.'}</p>`, 'An in-app model estimate of that task, not a pronunciation score or a language level.')}
        ${sourceCard('external', 'external', 'Reports brought back from Gemini', `<dl class="evidence-metrics"><div><dt>Saved imported grades</dt><dd data-metric="grades">${gradeCount('gemini-import')}</dd></div></dl><p class="small muted">${gradeCount('gemini-import') ? 'Imported reports stay labelled with their external source.' : 'No imported grades yet. Saved Gemini takeaways are separate from assessments.'}</p>`, 'Report structure and arithmetic are checked locally. External performance is not authenticated.')}
      </div></section>

    <section class="card evidence-section evidence-results"><div class="card-title"><div><p class="eyebrow">TASK-SPECIFIC FEEDBACK</p><h2>Assessment results</h2></div><a href="#assessments">Checks &amp; graded roleplays</a></div>
      <p class="small muted">Scores stay attached to the submitted task, target level, support conditions, and grading source.</p>
      ${grades.length ? `<div class="starter-progress-list">${grades.map(evaluation => {
        const attempt = state.assessments.attempts.find(item => item.id === evaluation.attemptId);
        if (!attempt) return '';
        const snapshot = state.assessments.definitions.find(item => item.id === evaluation.definitionHash);
        const definition = snapshot?.definition;
        return `<a href="#assessment-result/${esc(attempt.id)}"><span><strong>${esc(definition?.title ?? 'Saved assessment')}</strong><small>Task level ${esc(definition?.level ?? '')} · ${esc(attempt.mode)} · ${esc(conditions[evaluation.support] ?? evaluation.support)}</small>${provenance(gradeSources[evaluation.source])}</span><span class="evidence-score">${evaluation.result.percentage === null ? 'Partial' : `${evaluation.result.percentage}%`}</span></a>`;
      }).join('')}</div>` : '<p class="small">Your first submitted check or imported grade will appear here.</p>'}</section>

    <section class="card evidence-section evidence-recordings"><div class="card-title"><div><p class="eyebrow">LISTEN BACK</p><h2>Compare your voice over time</h2></div><span class="pill">Your own comparison</span></div><p class="small muted">Listen to your first and most recent saved answers for the same mission. Duration measures the clip, not pronunciation or fluency.</p>${recordedMissions.length ? `<label class="comparison-select">Compare recordings for<select id="compare-mission">${recordedMissions.map(mission => `<option value="${mission.id}" ${mission.id === compareMission ? 'selected' : ''}>${esc(mission.shortTitle)}</option>`).join('')}</select></label>` : ''}<div id="recording-comparison"></div></section>

    <details class="card evidence-section progress-details"><summary>Details and saved practice</summary>
      <div class="evidence-history-grid section-gap">
        <section><div class="card-title"><div><p class="eyebrow">YOUR SESSION HISTORY</p><h2>Recent practice</h2></div></div><p class="fine">Completed and unfinished sessions · most recent first</p>${recent.length ? `<div class="history-list">${recent.map(({ session, route, title }) => `<a href="#${route}/${esc(session.id)}" class="history-item"><span class="history-icon">${icon(session.completedAt ? 'check' : 'clock')}</span><div><strong>${esc(title)}</strong><span>${new Date(session.createdAt).toLocaleDateString()} · ${session.completedAt ? 'Completed' : 'In progress'}</span></div>${icon('arrow')}</a>`).join('')}</div>` : '<div class="empty-state"><p class="muted small">Your first completed exercise will appear here.</p><a class="inline-link" href="#lessons">Choose a small lesson</a></div>'}</section>
        <section><div class="card-title"><div><p class="eyebrow">WORDS TO KEEP</p><h2>Saved takeaways</h2></div>${provenance('reported')}</div>${notes.length || reflections.length ? `${notes.map(note => `<blockquote class="takeaway"><span class="small muted">${esc(starterLessonById(note.missionId)?.title ?? missionById(note.missionId)?.shortTitle ?? note.missionId)} · ${note.minutes} min self-reported</span><p>${esc(note.text)}</p></blockquote>`).join('')}${reflections.map(plan => `<blockquote class="takeaway"><span class="small muted">${esc(plan.id)} · Today’s takeaway</span><p>${esc(plan.reflection)}</p></blockquote>`).join('')}` : '<p class="small muted">Save a Gemini or daily takeaway to revisit it here.</p>'}<a class="inline-link section-gap" href="#phrases">Keep a new phrase with its meaning ${icon('book')}</a></section>
      </div>
      ${savedStarterAudio.length ? `<section class="section-gap"><div class="card-title"><h2>Replay beginner responses</h2>${provenance('measured')}</div><div class="evidence-audio-grid">${savedStarterAudio.map(response => `<div class="comparison-item"><p class="small muted">${esc(response.title)} · ${duration(response.recordingMs)}</p><button class="btn secondary small-btn" data-recording="${esc(response.recordingKey)}">Replay my answer</button><div class="saved-audio" data-audio="${esc(response.recordingKey)}"></div></div>`).join('')}</div></section>` : ''}
      <section class="section-gap"><div class="card-title"><div><p class="eyebrow">SITUATIONS YOU CAN REVISIT</p><h2>Workplace missions</h2></div>${provenance('self-rated')}</div><div class="milestone-grid">${MISSIONS.map(mission => {
        const evidence = stats.speaking.filter(attempt => attempt.missionId === mission.id && attempt.outcome === 'independent');
        return `<div class="milestone"><span class="mission-icon">${icon(mission.icon)}</span><div><h3>${esc(mission.shortTitle)}</h3><p>${esc(mission.goal)}</p><span class="small muted">${evidence.length ? `${evidence.length} independent responses` : 'Build evidence through practice'}</span></div></div>`;
      }).join('')}</div></section>
    </details>
    <section class="card evidence-section progress-action"><div><p class="eyebrow">ONE USEFUL NEXT STEP</p><h2>Ready for one more?</h2><p class="small muted">Keep the next review short and useful.</p></div><a class="btn" href="#words">Practise due words ${icon('arrow')}</a></section>
    </div>`;

  function drawComparison() {
    const container = el.querySelector('#recording-comparison');
    container.querySelectorAll('audio').forEach(audio => { audio.pause(); URL.revokeObjectURL(audio.src); urls.delete(audio.src); });
    const sameMission = recorded.filter(attempt => attempt.missionId === compareMission);
    const compare = sameMission.length > 1 ? [sameMission[0], sameMission.at(-1)] : sameMission;
    container.innerHTML = compare.length ? `<div class="comparison-grid">${compare.map((attempt, index) => `<div class="comparison-item"><div class="evidence-card-top"><span class="pill">${index === 0 ? 'First saved answer' : 'Most recent answer'}</span>${icon('mic')}</div><h3>${esc(missionById(attempt.missionId)?.shortTitle ?? 'Speaking practice')}</h3><p class="fine">${new Date(attempt.completedAt).toLocaleDateString()}</p><div class="evidence-recording-meta"><p><strong>${duration(attempt.recordingMs)}</strong>${provenance('measured')}</p><p><span>${outcomeLabel(attempt.outcome)}</span>${provenance('self-rated')}</p></div><button class="btn secondary small-btn" data-recording="${esc(attempt.id)}">${icon('play')}Replay my answer</button><div class="saved-audio" data-audio="${esc(attempt.id)}"></div></div>`).join('')}</div>${compare.length === 1 ? '<p class="fine section-gap">One saved answer so far. Save another for this mission to compare them here.</p>' : ''}` : '<div class="empty-state"><span class="evidence-empty-icon">'+ icon('mic') +'</span><h3>Your voice is the baseline.</h3><p class="muted small">Save a recording in a mission. You will be able to compare it with a later attempt here.</p><a class="btn secondary" href="#practice">Choose a mission</a></div>';
  }
  drawComparison();
  el.querySelector('#compare-mission')?.addEventListener('change', event => { compareMission = event.target.value; drawComparison(); }, { signal: ctx.signal });
  el.addEventListener('click', async event => {
    const button = event.target.closest('[data-recording]');
    if (!button || button.disabled) return;
    button.disabled = true;
    try {
      const blob = await ctx.store.getRecording(button.dataset.recording);
      if (!button.isConnected || ctx.signal.aborted) return;
      if (!blob) { ctx.notify('This audio is not stored on this device. Progress exports transfer the result, not the audio file.'); return; }
      const container = [...el.querySelectorAll('[data-audio]')].find(item => item.dataset.audio === button.dataset.recording && item.parentElement === button.parentElement);
      if (!container) return;
      const url = URL.createObjectURL(blob);
      urls.add(url);
      container.innerHTML = `<audio controls aria-label="Your saved response"></audio>`;
      container.querySelector('audio').src = url;
      button.hidden = true;
    } catch (error) { ctx.error(error.message); }
    finally { if (button.isConnected) button.disabled = false; }
  }, { signal: ctx.signal });
  return () => { el.querySelectorAll('audio').forEach(audio => audio.pause()); urls.forEach(url => URL.revokeObjectURL(url)); };
}
