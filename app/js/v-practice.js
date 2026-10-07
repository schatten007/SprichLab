import { MISSIONS, PHRASES } from '../data/missions.js';
import { CURRICULUM } from '../data/curriculum.js';
import { esc, icon, pageHeading, safeAction, englishMeaning } from './ui.js';

export function render(el, ctx) {
  const state = ctx.store.state;
  const completed = new Set(state.sessions.filter(session => session.kind === 'mission' && session.completedAt).map(session => session.missionId));
  el.innerHTML = `${pageHeading('PRACTICE THAT TRANSFERS', 'A conversation worth having.', 'A flexible six-stage path: roughly a week per stage, adjusted to your needs. Every situation is available whenever you need it.')}
    <div class="practice-toolbar"><span class="pill green">${MISSIONS.length} workplace missions · ${PHRASES.length} useful phrases</span><div class="btn-row"><a class="btn secondary" href="#lessons">Start-speaking course</a><a class="btn secondary" href="#resources">German resource library ${icon('external')}</a><a class="inline-link" href="#phrases">Your phrase collection ${icon('book')}</a></div></div>
    <section class="curriculum-strip" aria-label="Six-stage learning path">${CURRICULUM.map(stage => `<button class="stage-card" data-stage="${stage.number}"><span class="eyebrow">Stage ${stage.number}</span><strong>${esc(stage.titleDe)}</strong><span>${stage.missionIds.filter(id => completed.has(id)).length} / ${stage.missionIds.length} situations practised</span></button>`).join('')}</section>
    <div class="mission-filter"><label>Show situations<select id="mission-stage"><option value="all">All stages</option>${CURRICULUM.map(stage => `<option value="${stage.number}">${stage.number}. ${esc(stage.title)}</option>`).join('')}</select></label><p class="fine">Finishing a phrase review or a resource activity does not complete a mission.</p></div>
    <div class="mission-grid">${MISSIONS.map(mission => {
      const active = state.sessions.find(session => session.missionId === mission.id && session.kind === 'mission' && !session.completedAt);
      const count = state.sessions.filter(session => session.missionId === mission.id && session.kind === 'mission' && session.completedAt).length;
      const stage = CURRICULUM.find(item => item.missionIds.includes(mission.id));
      return `<article class="card mission-card" data-mission-stage="${stage.number}"><div class="mission-card-top"><span class="mission-icon">${icon(mission.icon)}</span><span class="mission-number">${mission.number}</span></div>
        <div class="pills"><span class="pill">${esc(mission.register)}</span><span class="pill">${esc(mission.level)}</span>${count ? `<span class="pill green">${count} completed</span>` : ''}</div>
        <h2>${esc(mission.shortTitle)}</h2><p lang="de" class="mission-german-title">${esc(mission.titleDe)}</p><p class="mission-goal" lang="de">${esc(mission.goalDe)}</p>${englishMeaning(mission.goal, { always: state.preferences.englishSupport === 'always' })}
        <p class="fine">${mission.listening.length} dialogue variants · ${mission.phraseIds.length} phrase targets</p><button class="btn ${mission.id === 'first-interview' ? '' : 'secondary'}" data-mission="${mission.id}">${active ? 'Resume mission' : count ? 'Practise a new variation' : 'Start mission'} ${icon('arrow')}</button><a class="text-button" href="#gemini/${mission.id}">Export for Gemini</a></article>`;
    }).join('')}</div>`;
  el.querySelectorAll('[data-mission]').forEach(button => safeAction(button, () => ctx.startMission(button.dataset.mission), ctx.error));
  const filter = value => { el.querySelectorAll('[data-mission-stage]').forEach(card => { card.hidden = value !== 'all' && card.dataset.missionStage !== value; }); };
  el.querySelector('#mission-stage').addEventListener('change', event => filter(event.target.value));
  el.querySelectorAll('[data-stage]').forEach(button => button.addEventListener('click', () => { el.querySelector('#mission-stage').value = button.dataset.stage; filter(button.dataset.stage); el.querySelector('.mission-filter').scrollIntoView({ block: 'start' }); }));
}
