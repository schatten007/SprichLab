import { MISSIONS, missionById } from '../data/missions.js';
import { esc, icon, minutes, duration, pageHeading, outcomeLabel, provenance, howLink, blockMeter, progressBar } from './ui.js';
import { starterLessonById, COURSE_LESSONS } from '../data/starter-catalog.js';
import { wordProgressSummary } from './starter-progress.js';
import { rewards } from './rewards.js';

export function render(el, ctx) {
  const state = ctx.store.state;
  const reward = rewards(state);
  const stats = reward.stats;
  const days = reward.week;
  const recent = [...state.sessions].sort((a, b) => b.createdAt - a.createdAt).slice(0, 12);
  const recorded = stats.speaking.filter(attempt => attempt.recordingMs > 0 && ['intro', 'retry'].includes(attempt.taskId))
    .sort((a, b) => a.completedAt - b.completedAt);
  const recordedMissions = MISSIONS.filter(mission => recorded.some(attempt => attempt.missionId === mission.id));
  let compareMission = recorded.at(-1)?.missionId;
  const urls = [];
  const beginner = state.starter;
  const words = wordProgressSummary(beginner);
  const completedLessons = new Set(beginner.sessions.filter(session => session.completedAt).map(session => session.lessonId)).size;
  const spokenStarter = stats.starterResponses.filter(response => response.spoken).length;
  const savedStarterAudio = beginner.sessions.flatMap(session => session.responses.filter(response => response.recordingMs > 0).map(response => ({ ...response, title: session.content.lesson.title })))
    .sort((a, b) => b.completedAt - a.completedAt).slice(0, 4);
  const notes = [...state.companionNotes].sort((a, b) => b.createdAt - a.createdAt).slice(0, 8);
  const grades = (state.assessments?.evaluations ?? []).filter(evaluation => !evaluation.testMode)
    .sort((a, b) => b.createdAt - a.createdAt).slice(0, 10);

  el.innerHTML = `${pageHeading('PRACTICE & ASSESSMENT', 'Notice what is getting easier.', 'A calm view of the practice you have actually recorded.')}
    <section class="card section-gap progress-week"><div class="card-title"><div><p class="eyebrow">THIS WEEK</p><h2>Keep the small routine</h2></div>${provenance('measured')}</div>
      <div class="progress-kpis"><div><strong>${minutes(stats.weekMs)}<small> min</small></strong><span>active practice · last 7 days</span></div><div><strong>${reward.streak.streak}</strong><span>${reward.streak.streak === 1 ? 'day' : 'days'} in a row · ${reward.streak.restLeft} rest left</span></div><div><strong>${minutes(stats.recordingMs)}<small> min</small></strong><span>recorded responses</span></div></div>
      ${progressBar(reward.ring.pct, `Today's goal: ${reward.ring.pct} per cent`)}<p class="small muted">${minutes(reward.ring.ms)} of ${reward.ring.goalMs / 60_000} minutes today</p>
      <div class="week-strip">${blockMeter(days.map(day => day.qualifies), `Practice on the last seven days: ${days.filter(day => day.qualifies).length} of 7 reached fifteen minutes`)}<span class="fine">Last 7 days</span></div>
      <div class="status-foot">${howLink()}</div></section>

    <section class="card section-gap"><div class="card-title"><div><p class="eyebrow">YOUR EVIDENCE</p><h2>What you have practised</h2></div>${provenance('self-rated')}</div>
      <div class="resource-progress progress-evidence"><div><strong>${completedLessons} / ${COURSE_LESSONS.length}</strong><span>lessons practised</span><small>${provenance('self-rated')}</small></div><div><strong>${words.recalled}</strong><span>German words recalled</span><small>${provenance('self-rated')}</small></div><div><strong>${spokenStarter + stats.speaking.length}</strong><span>spoken answers</span><small>${provenance('self-rated')}</small></div></div>
      <div class="btn-row section-gap"><a class="inline-link" href="#lessons">Open your path ${icon('arrow')}</a><a class="inline-link" href="#words">Open vocabulary ${icon('arrow')}</a></div></section>

    <section class="card section-gap"><div class="card-title"><div><p class="eyebrow">MILESTONES</p><h2>Small wins worth noticing</h2></div>${provenance('measured')}</div>
      <div class="milestone-grid">${reward.earned.length ? reward.earned.map(item => `<div class="milestone"><span class="pill green">${icon('check')} Earned</span><div><h3>${esc(item.label)}</h3><p>${esc(item.display)}</p><small>${provenance(item.prov)}</small></div></div>`).join('') : '<p class="small">Your first milestone is waiting for one small practice session.</p>'}</div>
      ${reward.next ? `<div class="milestone-next section-gap"><div class="card-title"><h3>Next: ${esc(reward.next.label)}</h3><span class="pill">${reward.next.value} / ${reward.next.target} ${esc(reward.next.unit)}</span></div>${progressBar(reward.next.value / reward.next.target * 100, `${reward.next.label}: ${reward.next.display} of ${reward.next.goal}`)}</div>` : ''}</section>

    <section class="card section-gap"><div class="card-title"><h2>Assessment results</h2><a href="#assessments">Checks &amp; graded roleplays</a></div>
      <p class="small muted">Scores stay attached to the submitted task, target level, support conditions, and grading source.</p>
      ${grades.length ? `<div class="starter-progress-list">${grades.map(evaluation => {
        const attempt = state.assessments.attempts.find(item => item.id === evaluation.attemptId);
        if (!attempt) return '';
        const snapshot = state.assessments.definitions.find(item => item.id === evaluation.definitionHash);
        const definition = snapshot?.definition;
        const label = { 'local-key': 'Checked locally', 'gateway-ai': 'AI estimate', 'gemini-import': 'Imported Gemini assessment' }[evaluation.source] ?? evaluation.source;
        return `<a href="#assessment-result/${attempt.id}"><span><strong>${esc(definition?.title ?? attempt.definitionId)}</strong><small>${esc(definition?.level ?? '')} · ${esc(attempt.mode)} · ${esc(label)}</small></span><span>${evaluation.result.percentage === null ? 'Partial' : `${evaluation.result.percentage}%`}</span></a>`;
      }).join('')}</div>` : '<p class="small">Your first submitted check or imported grade will appear here.</p>'}</section>

    <details class="card section-gap progress-details"><summary>Details and saved practice</summary>
      <section class="section-gap"><div class="card-title"><div><p class="eyebrow">RECORDINGS</p><h2>Compare your voice over time</h2></div></div>${recordedMissions.length ? `<label class="comparison-select">Compare recordings for<select id="compare-mission">${recordedMissions.map(mission => `<option value="${mission.id}" ${mission.id === compareMission ? 'selected' : ''}>${esc(mission.shortTitle)}</option>`).join('')}</select></label>` : ''}<div id="recording-comparison"></div></section>
      <section class="section-gap"><div class="card-title"><h2>Workplace missions</h2>${provenance('self-rated')}</div><div class="milestone-grid">${MISSIONS.map(mission => {
        const evidence = stats.speaking.filter(attempt => attempt.missionId === mission.id && attempt.outcome === 'independent');
        return `<div class="milestone"><span class="mission-icon">${icon(mission.icon)}</span><div><h3>${esc(mission.shortTitle)}</h3><p>${esc(mission.goal)}</p><span class="small muted">${evidence.length ? `${evidence.length} independent responses` : 'Build evidence through practice'}</span></div></div>`;
      }).join('')}</div></section>
      <section class="section-gap"><div class="card-title"><h2>Recent practice</h2><a href="#settings">Export progress</a></div>${recent.length ? `<div class="history-list">${recent.map(session => `<a href="#session/${esc(session.id)}" class="history-item"><span class="history-icon">${icon(session.completedAt ? 'check' : 'clock')}</span><div><strong>${session.kind === 'review' ? 'Phrase recall' : session.kind === 'resource' ? esc(session.content.resource.title) : esc(session.content.mission.shortTitle)}</strong><span>${new Date(session.createdAt).toLocaleDateString()} · ${session.completedAt ? 'Completed' : 'In progress'}</span></div>${icon('arrow')}</a>`).join('')}</div>` : '<p class="muted small">Your first completed exercise will appear here.</p>'}</section>
      ${notes.length || beginner.plans.some(plan => plan.reflection) ? `<section class="section-gap"><div class="card-title"><h2>Saved takeaways</h2>${provenance('reported')}</div>${notes.map(note => `<blockquote class="takeaway"><span class="small muted">${esc(starterLessonById(note.missionId)?.title ?? missionById(note.missionId)?.shortTitle ?? note.missionId)} · ${note.minutes} min self-reported</span><p>${esc(note.text)}</p></blockquote>`).join('')}${beginner.plans.filter(plan => plan.reflection).slice(-5).reverse().map(plan => `<blockquote class="takeaway"><span class="small muted">${esc(plan.id)} · Today’s takeaway</span><p>${esc(plan.reflection)}</p></blockquote>`).join('')}<a class="inline-link section-gap" href="#phrases">Keep a new phrase with its meaning ${icon('book')}</a></section>` : ''}
      ${savedStarterAudio.length ? `<section class="section-gap"><h2>Replay beginner responses</h2>${savedStarterAudio.map(response => `<div class="section-gap"><p class="small muted">${esc(response.title)} · ${duration(response.recordingMs)}</p><button class="btn secondary small-btn" data-recording="${esc(response.recordingKey)}">Replay my answer</button><div data-audio="${esc(response.recordingKey)}"></div></div>`).join('')}</section>` : ''}
    </details>
    <section class="card section-gap progress-action"><h2>Ready for one more?</h2><p class="small">Keep the next review short and useful.</p><a class="btn" href="#words">Practise due words ${icon('arrow')}</a></section>`;

  function drawComparison() {
    el.querySelectorAll('audio').forEach(audio => audio.pause());
    urls.splice(0).forEach(url => URL.revokeObjectURL(url));
    const sameMission = recorded.filter(attempt => attempt.missionId === compareMission);
    const compare = sameMission.length > 1 ? [sameMission[0], sameMission.at(-1)] : sameMission;
    el.querySelector('#recording-comparison').innerHTML = compare.length ? `<div class="comparison-grid">${compare.map((attempt, index) => `<div class="comparison-item"><span class="pill">${index === 0 ? 'First saved answer' : 'Most recent answer'}</span><h3>${esc(missionById(attempt.missionId)?.shortTitle ?? 'Speaking practice')}</h3><p class="small muted">${new Date(attempt.completedAt).toLocaleDateString()} · ${duration(attempt.recordingMs)} · ${outcomeLabel(attempt.outcome)}</p><button class="btn secondary small-btn" data-recording="${esc(attempt.id)}">${icon('play')}Replay my answer</button><div class="saved-audio" data-audio="${esc(attempt.id)}"></div></div>`).join('')}</div>` : '<div class="empty-state"><h3>Your voice is the baseline.</h3><p class="muted small">Save a recording in a mission. You will be able to compare it with a later attempt here.</p><a class="btn secondary" href="#practice">Choose a mission</a></div>';
  }
  drawComparison();
  el.querySelector('#compare-mission')?.addEventListener('change', event => { compareMission = event.target.value; drawComparison(); });
  el.addEventListener('click', async event => {
    const button = event.target.closest('[data-recording]');
    if (!button || button.disabled) return;
    button.disabled = true;
    try {
      const blob = await ctx.store.getRecording(button.dataset.recording);
      if (!button.isConnected || ctx.signal.aborted) return;
      if (!blob) { ctx.notify('This audio is not stored on this device. Progress exports transfer the result, not the audio file.'); return; }
      const url = URL.createObjectURL(blob);
      urls.push(url);
      const container = [...el.querySelectorAll('[data-audio]')].find(item => item.dataset.audio === button.dataset.recording && item.parentElement === button.parentElement);
      if (!container) return;
      container.innerHTML = `<audio controls aria-label="Your saved response"></audio>`;
      container.querySelector('audio').src = url;
      button.hidden = true;
    } catch (error) { ctx.error(error.message); }
    finally { if (button.isConnected) button.disabled = false; }
  }, { signal: ctx.signal });
  return () => { el.querySelectorAll('audio').forEach(audio => audio.pause()); urls.forEach(url => URL.revokeObjectURL(url)); };
}
