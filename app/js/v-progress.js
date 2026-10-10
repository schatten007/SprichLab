import { MISSIONS, missionById } from '../data/missions.js';
import { progressStats, previousDay } from './model.js';
import { reviewStates, retained } from './srs.js';
import { esc, icon, minutes, duration, pageHeading, outcomeLabel } from './ui.js';
import { starterLessonById, COURSE_LESSONS } from '../data/starter-catalog.js';
import { wordProgressSummary } from './starter-progress.js';

export function render(el, ctx) {
  const state = ctx.store.state;
  const stats = progressStats(state);
  const retention = [...reviewStates(state.attempts).values()].filter(retained).length;
  const independent = stats.speaking.filter(attempt => attempt.outcome === 'independent').length;
  const days = Array.from({ length: 7 }, (_, index) => previousDay(stats.today, 6 - index));
  const maxMs = Math.max(15 * 60_000, ...days.map(day => stats.days.get(day) ?? 0));
  const recent = [...state.sessions].sort((a, b) => b.createdAt - a.createdAt).slice(0, 12);
  const recorded = stats.speaking.filter(attempt => attempt.recordingMs > 0 && ['intro', 'retry'].includes(attempt.taskId))
    .sort((a, b) => a.completedAt - b.completedAt);
  const recordedMissions = MISSIONS.filter(mission => recorded.some(attempt => attempt.missionId === mission.id));
  let compareMission = recorded.at(-1)?.missionId;
  const urls = [];
  el.innerHTML = `${pageHeading('PRACTICE & ASSESSMENT', 'Notice what is getting easier.', 'Measured practice, checked answers, self-ratings, and clearly labelled AI estimates. Task scores are not a CEFR certificate.')}
    <div class="progress-kpis"><div class="card"><span class="fine">Active practice · last 7 days</span><strong>${minutes(stats.weekMs)}<small> min</small></strong><span class="fine">Visible, recently active sessions</span></div><div class="card"><span class="fine">Recorded responses · all time</span><strong>${minutes(stats.recordingMs)}<small> min</small></strong><span class="fine">Recording length includes pauses</span></div><div class="card"><span class="fine">Listening · without transcript</span><strong>${stats.listeningPct === null ? '—' : `${stats.listeningPct}<small>%</small>`}</strong><span class="fine">${stats.listening.length} checked ${stats.listening.length === 1 ? 'question' : 'questions'}</span></div></div>
    <div class="grid-2 section-gap"><section class="card"><div class="card-title"><h2>A little practice adds up</h2><span class="pill">${stats.streak} ${stats.streak === 1 ? 'day' : 'days'} ≥ 15 min</span></div><div class="week-chart" role="img" aria-label="Practice over the last seven days: ${days.map(day => `${day}: ${minutes(stats.days.get(day) ?? 0)} minutes`).join(', ')}">${days.map(day => `<div class="day-column"><span>${minutes(stats.days.get(day) ?? 0)}</span><div class="day-track"><div style="height:${Math.max(2, (stats.days.get(day) ?? 0) / maxMs * 100)}%" class="${day === stats.today ? 'today' : ''}"></div></div><span>${esc(new Date(`${day}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short' }))}</span></div>`).join('')}</div><p class="fine">Local day boundary: ${esc(state.preferences.timeZone)}. A missed day resets the streak; your practice history remains useful.</p></section>
    <section class="card"><div class="card-title"><h2>What your evidence says</h2><span class="pill green">Self-assessed</span></div><div class="evidence-row"><strong>${independent} / ${stats.speaking.length}</strong><span>spoken responses rated independent</span></div><div class="evidence-row"><strong>${retention}</strong><span>phrases used independently on at least two spaced days</span></div><div class="evidence-row"><strong>${stats.completed.length}</strong><span>completed practice sessions</span></div><p class="fine">Typed drafts and copied answers do not count as independent spoken use. Repeating a phrase immediately does not establish retention.</p></section></div>
    <section class="card section-gap"><div class="card-title"><div><p class="eyebrow">LISTEN FOR THE DIFFERENCE</p><h2>Your first and most recent recordings</h2></div></div><p class="small muted">Compare the same situation over time. Listen for clearer ideas, fewer restarts, and less reliance on the model.</p>${recordedMissions.length ? `<label class="comparison-select">Compare recordings for<select id="compare-mission">${recordedMissions.map(mission => `<option value="${mission.id}" ${mission.id === compareMission ? 'selected' : ''}>${esc(mission.shortTitle)}</option>`).join('')}</select></label>` : ''}<div id="recording-comparison"></div></section>
    <section class="section-gap"><div class="section-heading"><div><p class="eyebrow">PRACTICAL MILESTONES</p><h2>Can you do it in a conversation?</h2></div></div><div class="milestone-grid">${MISSIONS.map(mission => {
      const evidence = stats.speaking.filter(attempt => attempt.missionId === mission.id && attempt.outcome === 'independent');
      return `<div class="milestone"><span class="mission-icon">${icon(mission.icon)}</span><div><h3>${esc(mission.shortTitle)}</h3><p>${esc(mission.goal)}</p><span class="fine">${evidence.length ? `${evidence.length} independent responses · self-rated` : 'Build evidence through practice'}</span></div></div>`;
    }).join('')}</div></section>
    <section class="card section-gap"><div class="card-title"><h2>Resource practice &amp; your own phrases</h2><a href="#resources">Open resource library</a></div><div class="resource-progress">
      <div><strong>${stats.resourceActivities.length}</strong><span>saved resource responses · unscored</span></div><div><strong>${stats.externalMinutes} min</strong><span>outside study · self-reported, all time</span></div><div><strong>${state.personalPhrases.length}</strong><span>personal phrases collected</span></div></div>
      <p class="fine">Outside study is separate from measured active time. Opening a link does not award language success.</p></section>
    <section class="card section-gap"><div class="card-title"><h2>Recent practice</h2><a href="#settings">Export progress</a></div>${recent.length ? `<div class="history-list">${recent.map(session => `<a href="#session/${esc(session.id)}" class="history-item"><span class="history-icon">${icon(session.completedAt ? 'check' : 'clock')}</span><div><strong>${session.kind === 'review' ? 'Phrase recall' : session.kind === 'resource' ? esc(session.content.resource.title) : esc(session.content.mission.shortTitle)}</strong><span>${new Date(session.createdAt).toLocaleDateString()} · ${session.completedAt ? 'Completed' : 'In progress'}</span></div>${icon('arrow')}</a>`).join('')}</div>` : '<p class="muted small">Your first completed exercise will appear here.</p>'}</section>
    ${(state.dailyPlans ?? []).some(plan => plan.reflectionAt) ? `<section class="card section-gap"><h2>Your recent takeaways</h2>${state.dailyPlans.filter(plan => plan.reflectionAt).sort((a, b) => b.reflectionAt - a.reflectionAt).slice(0, 5).map(plan => `<blockquote class="takeaway"><span class="fine">${esc(plan.id)}</span><p lang="de">${esc(plan.reflection)}</p></blockquote>`).join('')}</section>` : ''}`;
  const beginner = state.starter;
  const words = wordProgressSummary(beginner);
  const recentLessons = [...beginner.sessions].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 8);
  const completedLessons = new Set(beginner.sessions.filter(session => session.completedAt).map(session => session.lessonId)).size;
  const spokenStarter = stats.starterResponses.filter(response => response.spoken).length;
  const savedStarterAudio = beginner.sessions.flatMap(session => session.responses.filter(response => response.recordingMs > 0).map(response => ({ ...response, title: session.content.lesson.title })))
    .sort((a, b) => b.completedAt - a.completedAt).slice(0, 4);
  el.querySelector('.page-heading').insertAdjacentHTML('afterend', `<section class="card section-gap"><div class="card-title"><div><p class="eyebrow">START SPEAKING</p><h2>Your beginner practice</h2></div><a href="#lessons">Open lessons</a></div>
    <div class="resource-progress"><div><strong>${completedLessons} / ${COURSE_LESSONS.length}</strong><span>lessons practised</span></div><div><strong>${spokenStarter}</strong><span>spoken tasks · recorded or self-reported</span></div><div><strong>${beginner.wordMarks.filter(mark => mark.saved).length}</strong><span>words saved</span></div></div>
    <div class="resource-progress"><div><strong>${words.recognition}</strong><span>word meanings recalled</span></div><div><strong>${words.recalled}</strong><span>German words said from memory</span></div><div><strong>${words.used}</strong><span>words used in an aloud sentence</span></div></div>
    <p class="fine">Word results are self-rated and each count is for distinct words. Recognition, supported repetition, and spoken recall are kept separate; these counts do not award a proficiency level.</p>
    ${recentLessons.length ? `<div class="starter-progress-list">${recentLessons.map(session => `<a href="#learn/${session.id}"><span><strong>${esc(session.content.lesson.title)}</strong><small>${session.responses.filter(response => response.spoken).length} spoken tasks · ${session.completedAt ? 'sequence finished' : 'in progress'}</small></span><span>Open ${icon('arrow')}</span></a>`).join('')}</div>` : '<a class="btn secondary" href="#lesson/starter-hello">Start with greetings and names</a>'}
    ${savedStarterAudio.length ? `<h3 class="section-gap">Replay your beginner responses</h3>${savedStarterAudio.map(response => `<div class="section-gap"><p class="fine">${esc(response.title)} · ${duration(response.recordingMs)}</p><button class="btn secondary small-btn" data-recording="${esc(response.recordingKey)}">Replay my answer</button><div data-audio="${esc(response.recordingKey)}"></div></div>`).join('')}` : ''}</section>`);
  const notes = [...state.companionNotes].sort((a, b) => b.createdAt - a.createdAt).slice(0, 8);
  const grades = state.assessments.evaluations.filter(evaluation => !evaluation.testMode).sort((a, b) => b.createdAt - a.createdAt).slice(0, 10);
  el.querySelector('.page-heading').insertAdjacentHTML('afterend', `<section class="card section-gap"><div class="card-title"><h2>Assessment results</h2><a href="#assessments">Checks &amp; graded roleplays</a></div>
    <p class="fine">Scores stay attached to the task, level, support conditions, and grading source. Test-provider fixtures are excluded. Assessment scores do not add SRS or independent-speaking credit.</p>
    ${grades.length ? `<div class="starter-progress-list">${grades.map(evaluation => {
      const attempt = state.assessments.attempts.find(item => item.id === evaluation.attemptId);
      const definition = state.assessments.definitions.find(item => item.id === evaluation.definitionHash).definition;
      const label = { 'local-key': 'Checked locally', 'gateway-ai': 'AI estimate', 'gemini-import': 'Gemini report' }[evaluation.source];
      return `<a href="#assessment-result/${attempt.id}"><span><strong>${esc(definition.title)}</strong><small>${esc(definition.level)} · ${attempt.mode} · ${label}</small></span><span>${evaluation.result.percentage === null ? 'Partial' : `${evaluation.result.percentage}%`}</span></a>`;
    }).join('')}</div>` : '<p class="small">Your first submitted check or imported grade will appear here.</p>'}</section>`);
  if (notes.length || beginner.plans.some(plan => plan.reflection)) el.insertAdjacentHTML('beforeend', `<section class="card section-gap"><h2>Gemini practice &amp; beginner takeaways</h2><p class="fine section-gap">Gemini minutes are self-reported outside practice. These notes do not add word recall or independent-speaking grades.</p>
    ${notes.map(note => `<blockquote class="takeaway"><span class="fine">${esc(starterLessonById(note.missionId)?.title ?? missionById(note.missionId)?.shortTitle ?? note.missionId)} · ${note.minutes} min self-reported</span><p>${esc(note.text)}</p></blockquote>`).join('')}
    ${beginner.plans.filter(plan => plan.reflection).slice(-5).reverse().map(plan => `<blockquote class="takeaway"><span class="fine">${esc(plan.id)} · Today’s takeaway</span><p>${esc(plan.reflection)}</p></blockquote>`).join('')}
    <a class="inline-link section-gap" href="#phrases">Keep a new phrase with its meaning ${icon('book')}</a></section>`);
  function drawComparison() {
    el.querySelectorAll('audio').forEach(audio => audio.pause());
    urls.splice(0).forEach(url => URL.revokeObjectURL(url));
    const sameMission = recorded.filter(attempt => attempt.missionId === compareMission);
    const compare = sameMission.length > 1 ? [sameMission[0], sameMission.at(-1)] : sameMission;
    el.querySelector('#recording-comparison').innerHTML = compare.length ? `<div class="comparison-grid">${compare.map((attempt, index) => `<div class="comparison-item"><span class="pill">${index === 0 ? 'First saved answer' : 'Most recent answer'}</span><h3>${esc(missionById(attempt.missionId)?.shortTitle ?? 'Speaking practice')}</h3><p class="fine">${new Date(attempt.completedAt).toLocaleDateString()} · ${duration(attempt.recordingMs)} · ${outcomeLabel(attempt.outcome)}</p><button class="btn secondary small-btn" data-recording="${esc(attempt.id)}">${icon('play')}Replay my answer</button><div class="saved-audio" data-audio="${esc(attempt.id)}"></div></div>`).join('')}</div>` : '<div class="empty-state"><h3>Your voice is the baseline.</h3><p class="muted small">Save a recording in a mission. You will be able to compare it with a later attempt here.</p><a class="btn secondary" href="#practice">Choose a mission</a></div>';
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
      container.innerHTML = `<audio controls aria-label="Your saved response"></audio>`;
      container.querySelector('audio').src = url;
      button.hidden = true;
    } catch (error) { ctx.error(error.message); }
    finally { if (button.isConnected) button.disabled = false; }
  }, { signal: ctx.signal });
  return () => { el.querySelectorAll('audio').forEach(audio => audio.pause()); urls.forEach(url => URL.revokeObjectURL(url)); };
}
