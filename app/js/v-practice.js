import { MISSIONS, PHRASES } from '../data/missions.js';
import { CURRICULUM } from '../data/curriculum.js';
import { tasksFor } from './session.js';
import { esc, icon, pageHeading, safeAction, englishMeaning } from './ui.js';

export function render(el, ctx) {
  const state = ctx.store.state;
  const completed = new Set(state.sessions.filter(session => session.kind === 'mission' && session.completedAt).map(session => session.missionId));
  const unfinished = state.sessions.filter(session => session.kind === 'mission' && !session.completedAt).sort((a, b) => b.updatedAt - a.updatedAt);
  el.innerHTML = `<div class="workplace-library"><header class="workspace-heading"><span class="pill">Workplace module · ${CURRICULUM.length} stages</span>
    ${pageHeading('PRACTICE THAT TRANSFERS', 'A conversation worth having.', 'A flexible six-stage path: roughly a week per stage, adjusted to your needs. Every situation is available whenever you need it.')}</header>
    <div class="practice-toolbar"><span class="pill green">${MISSIONS.length} workplace missions · ${PHRASES.length} useful phrases</span><div class="btn-row"><a class="btn secondary" href="#lessons">Start-speaking course</a><a class="btn secondary" href="#resources">German resource library ${icon('external')}</a><a class="inline-link" href="#phrases">Your phrase collection ${icon('book')}</a></div></div>
    <div class="workplace-evidence"><span class="circle-icon">${icon('messages')}</span><div><strong>Practise the whole conversation.</strong><p class="fine">Finishing a phrase review or a resource activity does not complete a mission.</p></div>
      ${unfinished.length ? `<a class="btn" href="#session/${esc(unfinished[0].id)}">Continue your mission ${icon('play')}</a>` : `<span class="pill">${completed.size} / ${MISSIONS.length} situations practised</span>`}</div>
    <section class="curriculum-strip" aria-label="Six-stage learning path"><button class="stage-card" data-stage="all" aria-pressed="true"><span class="eyebrow">Explore</span><strong>All ${CURRICULUM.length} stages</strong><span>${MISSIONS.length} missions</span></button>${CURRICULUM.map(stage => `<button class="stage-card" data-stage="${stage.number}" aria-pressed="false"><span class="eyebrow">Stage ${stage.number}</span><strong lang="de">${esc(stage.titleDe)}</strong><span>${stage.missionIds.filter(id => completed.has(id)).length} / ${stage.missionIds.length} situations practised</span></button>`).join('')}</section>
    <div class="mission-filter"><label>Show situations<select id="mission-stage"><option value="all">All stages</option>${CURRICULUM.map(stage => `<option value="${stage.number}">${stage.number}. ${esc(stage.title)}</option>`).join('')}</select></label><p class="fine" id="mission-count" aria-live="polite">${MISSIONS.length} missions · every stage is available</p></div>
    ${CURRICULUM.map(stage => `<section class="workplace-stage" data-mission-stage="${stage.number}" aria-labelledby="workplace-stage-${stage.number}"><header class="workplace-stage-heading"><span class="block-number">${String(stage.number).padStart(2, '0')}</span><div><h2 id="workplace-stage-${stage.number}">Stage ${stage.number}: ${esc(stage.title)}</h2><p lang="de">${esc(stage.titleDe)}</p></div><span class="pill">${stage.missionIds.filter(id => completed.has(id)).length} / ${stage.missionIds.length} practised</span></header>
    <div class="mission-grid">${MISSIONS.filter(mission => stage.missionIds.includes(mission.id)).map(mission => {
      const active = state.sessions.find(session => session.missionId === mission.id && session.kind === 'mission' && !session.completedAt);
      const count = state.sessions.filter(session => session.missionId === mission.id && session.kind === 'mission' && session.completedAt).length;
      const total = active ? tasksFor(active).length : 0;
      return `<article class="card mission-card" data-active="${Boolean(active)}"><div class="mission-card-top"><span class="mission-icon">${icon(mission.icon)}</span><span class="mission-number">${mission.number}</span></div>
        <div class="pills"><span class="pill">${esc(mission.level)}</span><span class="pill">${esc(mission.register)}</span>${active ? '<span class="pill">In progress</span>' : ''}${count ? `<span class="pill green">${count} completed</span>` : !active ? '<span class="pill">Not yet practised</span>' : ''}</div>
        <h3>${esc(mission.shortTitle)}</h3><p lang="de" class="mission-german-title">${esc(mission.titleDe)}</p><p class="mission-goal" lang="de">${esc(mission.goalDe)}</p>${englishMeaning(mission.goal, { always: state.preferences.englishSupport === 'always' })}
        <footer class="mission-card-footer"><p class="fine">${mission.listening.length} dialogue variants · ${mission.phraseIds.length} phrase targets${active ? `<br><strong>Step ${Math.min(active.cursor + 1, total)} of ${total} · saved on this device</strong>` : ''}</p><div class="btn-row"><button class="btn ${active || mission.id === 'first-interview' ? '' : 'secondary'}" data-mission="${mission.id}">${active ? 'Resume mission' : count ? 'Practise a new variation' : 'Start mission'} ${icon('arrow')}</button><a class="text-button" href="#gemini/${mission.id}">Export for Gemini</a></div></footer></article>`;
    }).join('')}</div></section>`).join('')}</div>`;
  el.querySelectorAll('[data-mission]').forEach(button => safeAction(button, () => ctx.startMission(button.dataset.mission), ctx.error));
  const filter = value => {
    el.querySelectorAll('[data-mission-stage]').forEach(section => { section.hidden = value !== 'all' && section.dataset.missionStage !== value; });
    el.querySelectorAll('[data-stage]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.stage === value)));
    const count = value === 'all' ? MISSIONS.length : CURRICULUM.find(stage => String(stage.number) === value).missionIds.length;
    el.querySelector('#mission-count').textContent = `${count} missions · ${value === 'all' ? 'every stage is available' : `stage ${value}`}`;
  };
  el.querySelector('#mission-stage').addEventListener('change', event => filter(event.target.value));
  el.querySelectorAll('[data-stage]').forEach(button => button.addEventListener('click', () => { el.querySelector('#mission-stage').value = button.dataset.stage; filter(button.dataset.stage); el.querySelector('.mission-filter').scrollIntoView({ block: 'start' }); }));
}
