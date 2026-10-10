import { MISSIONS, allPhrases, missionById } from '../data/missions.js';
import { RESOURCES } from '../data/resources.js';
import { progressStats } from './model.js';
import { recommendation } from './adaptive.js';
import { curriculumStage, dailyQueue } from './daily.js';
import { duePhrases } from './srs.js';
import { tasksFor } from './session.js';
import { esc, icon, minutes, progressBar, safeAction, provenance, howLink } from './ui.js';
import { renderToday as renderStarterToday } from './v-lessons.js';
import { pathPicker, bindPathPicker } from './starter-ui.js';

export async function render(el, ctx) {
  if (ctx.store.state.preferences.learningPath === 'starter') return renderStarterToday(el, ctx);
  const plan = await ctx.store.ensureDailyPlan();
  const state = ctx.store.state;
  const stats = progressStats(state);
  const next = recommendation(state);
  const session = next.active;
  const mission = session ? next.mission : missionById(plan.missionId) ?? next.mission;
  const due = duePhrases(allPhrases(state), state.attempts);
  const queue = dailyQueue(state, plan);
  const stage = curriculumStage(state);
  const position = session ? Math.min(session.cursor + 1, tasksFor(session).length) : null;
  const greeting = state.profile.name ? `A little more confident, ${state.profile.name}.` : 'A little more confident, every day.';
  const goalPct = stats.todayMs / (state.preferences.dailyMinutes * 60_000) * 100;
  const heroTitle = session?.kind === 'review' ? 'Bring your phrases back.' : session?.kind === 'resource' ? session.content.resource.title : mission.title;
  const heroDescription = session?.kind === 'review' ? 'Recall your phrases, compare with a model, and choose an honest rating.' : session?.kind === 'resource' ? 'Return to the source activity and save your own German response.' : mission.subtitle;
  el.innerHTML = `
    <div class="dashboard-heading"><div><p class="eyebrow">${esc(new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', timeZone: state.preferences.timeZone }))}</p>
      <h1>${esc(greeting)}</h1><p class="lede">Useful German for your next interview, your next colleague, your next step.</p></div><span class="pill green">Stage ${stage.number} of 6 · your pace</span></div>
    ${pathPicker(state)}
    ${state.legacy && !state.attempts.length ? '<div class="callout amber section-gap"><strong>A fresh, reliable baseline.</strong> Previous trainer data is preserved in your progress backup.</div>' : ''}
    <section class="hero section-gap" aria-labelledby="mission-title"><div class="hero-main"><div class="pills"><span class="pill">${session ? 'CONTINUE YOUR PRACTICE' : 'YOUR DAILY FOCUS'}</span><span class="hero-number">${mission.number} / ${MISSIONS.length}</span></div>
      <h2 id="mission-title">${esc(heroTitle)}</h2><p>${esc(heroDescription)}</p>
      <div class="hero-meta"><span>${icon('messages')} ${esc(mission.register)}</span><span>${icon('mic')} Record, replay, try again</span></div>
      <div class="btn-row"><button class="btn hero-cta" id="start-mission">${icon(session ? 'play' : 'arrow')}${session ? `Resume · step ${position}` : 'Start this mission'}</button><a class="hero-more" href="#practice">Explore all missions ${icon('arrow')}</a></div>
      <span class="hero-caption">${session ? 'Pick up exactly where you left off.' : 'Follow the queue below, or choose another focus.'}</span></div>
      <div class="hero-scene" aria-hidden="true"><div class="scene-orbit"></div><span class="scene-tag">A SMALL CONVERSATION. A REAL STEP.</span>
        <div class="scene-bubble">${esc(mission.turns[0].prompts[0])}<span lang="de">Du bist dran.</span></div><div class="scene-reply"><span class="scene-wave">${[8, 15, 23, 12, 19, 9, 17, 25, 15, 8, 18, 12].map(height => `<i style="height:${height}px"></i>`).join('')}</span><span>Your voice belongs here.</span></div><span class="scene-spark">✳</span></div></section>
    <section class="quick-stats" aria-label="Your practice at a glance">
      <div><span class="stat-icon">${icon('clock')}</span><div><strong>${minutes(stats.todayMs)} <small>min</small></strong><span>Measured practice today</span></div></div>
      <div><span class="stat-icon">${icon('refresh')}</span><div><strong>${due.length} <small>phrases</small></strong><span>Ready to recall</span></div></div>
      <div><span class="stat-icon">${icon('mic')}</span><div><strong>${minutes(stats.recordingMs)} <small>min</small></strong><span>Saved response recordings</span></div></div>
      <div><span class="stat-icon">${icon('check')}</span><div><strong>${stats.completed.length} <small>sessions</small></strong><span>Completed, at your pace</span></div></div></section>
    <div class="dashboard-lower daily-layout"><section class="card daily-card"><div class="card-title"><h2>Your actual work for today</h2>
      <label class="goal-select"><span class="sr-only">Daily practice goal</span><select id="daily-goal" aria-label="Daily practice goal">${[15, 30, 60, 90, 120].map(value => `<option value="${value}" ${value === state.preferences.dailyMinutes ? 'selected' : ''}>${value} min</option>`).join('')}</select></label></div>
      <label class="daily-focus-label">Today’s focus<select id="daily-focus">${MISSIONS.map(item => `<option value="${item.id}" ${item.id === plan.missionId ? 'selected' : ''}>${esc(item.shortTitle)}</option>`).join('')}</select></label>
      <div class="goal-line"><span>${minutes(stats.todayMs)} measured minutes / ${state.preferences.dailyMinutes}-minute budget</span><span>${Math.min(100, Math.floor(goalPct))}%</span></div>${progressBar(goalPct, 'Daily practice goal')}
      <ol class="daily-queue">${queue.map((item, index) => `<li data-queue-item="${item.id}" class="${item.done ? 'queue-done' : ''}"><span class="block-number">${item.done ? icon('check') : String(index + 1).padStart(2, '0')}</span>
        <div><div class="queue-heading"><strong>${esc(item.title)}</strong><span>${item.minutes} min</span></div><p>${esc(item.detail)}</p>
        <div class="queue-actions"><span class="pill ${item.done ? 'green' : ''}">${item.done ? 'Saved' : item.optional ? 'Optional for this short session' : 'Ready'}</span>
          <button class="text-button" data-queue-action="${item.id}">${item.done ? 'Review saved work' : { review: 'Start due review', resource: 'Open resource activity', mission: 'Start / resume mission', phrases: 'Open phrase models', reflection: 'Add reflection' }[item.action]} ${icon('arrow')}</button></div></div></li>`).join('')}</ol>
      ${provenance('measured')} ${howLink()}</section>
    <div class="stack"><section class="card"><p class="eyebrow">${RESOURCES.length} CURATED RESOURCES</p><h2>Hear German in real situations.</h2><p class="small muted section-gap">Short lessons, workplace audio, pronunciation practice, and a speaking task to bring back here.</p><a class="btn secondary" href="#resources">Browse German resources ${icon('arrow')}</a></section>
      <section class="card review-card"><div class="card-title"><h2>Make it easier to remember</h2><span class="circle-icon">${icon('refresh')}</span></div><p class="small muted">${due.length ? `${due.length} phrases are due. Recall before revealing the model.` : 'Your phrases return when they are due. You can also collect your own useful expressions.'}</p><button class="btn secondary" id="review-now">${due.length ? 'Review due phrases' : 'Explore useful phrases'} ${icon('arrow')}</button></section>
      <section class="card personal-card"><p class="eyebrow">MAKE IT YOURS</p><h2>${state.profile.studies ? 'Practise with your own story.' : 'Your story makes better practice.'}</h2><p class="small muted section-gap">${state.profile.studies ? `Your studies: ${esc(state.profile.studies)}. Bring one real example into the conversation.` : 'Add your studies, experience, and availability to keep your answers true to you.'}</p><a class="inline-link" href="#settings">${state.profile.studies ? 'Edit your profile' : 'Add your background'} ${icon('arrow')}</a></section></div></div>
    <section class="card section-gap"><div class="card-title"><div><p class="eyebrow">ONE TAKEAWAY</p><h2>What can you use in real life?</h2></div>${plan.reflectionAt ? '<span class="pill green">Reflection saved</span>' : ''}</div>
      <form id="reflection-form"><label for="daily-reflection">A useful sentence and where you will use it</label><textarea id="daily-reflection" lang="de" maxlength="2000" required placeholder="Heute kann ich … Das möchte ich … benutzen.">${esc(plan.reflection)}</textarea>
      <div class="btn-row"><button class="btn" type="submit">Save today’s takeaway ${icon('check')}</button><span class="fine">${provenance('reported')}</span></div></form></section>
    <div class="daily-nudge"><span>${icon('spark')}</span><p><strong>Stage ${stage.number}: ${esc(stage.title)}.</strong> ${esc(stage.realWorld)}</p></div>`;
  safeAction(el.querySelector('#start-mission'), () => session ? ctx.go(`session/${session.id}`) : ctx.startMission(mission.id), ctx.error);
  bindPathPicker(el, ctx);
  safeAction(el.querySelector('#review-now'), () => due.length ? ctx.startReview(due.slice(0, 10).map(word => word.id)) : ctx.go('phrases'), ctx.error);
  el.querySelectorAll('[data-queue-action]').forEach(button => safeAction(button, async () => {
    const item = queue.find(entry => entry.id === button.dataset.queueAction);
    if (item.action === 'reflection') { el.querySelector('#daily-reflection').focus(); el.querySelector('#reflection-form').scrollIntoView({ block: 'center' }); return; }
    if (item.done) { ctx.go('progress'); return; }
    if (item.action === 'resource') await ctx.startResource(item.target, { missionId: plan.missionId });
    else if (item.action === 'review') await ctx.startReview(item.phraseIds);
    else if (item.action === 'phrases') ctx.go('phrases');
    else await ctx.startMission(item.target);
  }, ctx.error));
  el.querySelector('#daily-goal').addEventListener('change', async event => { try { await ctx.store.update(saved => { saved.preferences.dailyMinutes = Number(event.target.value); }); await ctx.refresh(); } catch (error) { ctx.error(error.message); } });
  el.querySelector('#daily-focus').addEventListener('change', async event => { try { await ctx.store.setDailyFocus(event.target.value); await ctx.refresh(); } catch (error) { ctx.error(error.message); } });
  el.querySelector('#reflection-form').addEventListener('submit', async event => { event.preventDefault(); try { await ctx.store.saveReflection(plan.id, el.querySelector('#daily-reflection').value); ctx.notify('Your takeaway is saved.'); await ctx.refresh(); } catch (error) { ctx.error(error.message); } });
}
