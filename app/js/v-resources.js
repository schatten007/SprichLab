import { RESOURCES, resourceById } from '../data/resources.js';
import { phraseById } from '../data/phrases.js';
import { filterResources, resourceState, alternativesFor, resourceAttempt } from './resources.js';
import { draftFor } from './session.js';
import { createPracticeClock } from './clock.js';
import { mountRecording } from './recording-ui.js';
import { journalDraft, clearJournal } from './draft-journal.js';
import { phraseForm, bindPhraseForm } from './phrase-form.js';
import { esc, icon, pageHeading, lessonCopy, englishMeaning, safeAction, duration, provenance } from './ui.js';

const registrationLabel = value => ({ none: 'No account required', optional: 'Free account optional', required: 'Free registration needed' }[value]);
const transcriptLabel = value => ({ available: 'Transcript / text', vocabulary: 'Vocabulary text', exercises: 'Exercise text', 'bilingual-captions': 'DE + EN captions', none: 'No text support' }[value]);

function card(resource, state) {
  const saved = resourceState(state, resource.id);
  return `<article class="card catalog-card"><div class="card-title"><div class="catalog-provider"><span class="circle-icon">${icon(resource.formats.includes('video') ? 'play' : resource.formats.includes('audio') ? 'volume' : 'book')}</span><span class="eyebrow">${esc(resource.provider)}</span></div>
    <button class="bookmark-button" data-bookmark="${resource.id}" aria-pressed="${saved.bookmarked}" aria-label="${saved.bookmarked ? 'Unsave' : 'Save'} ${esc(resource.title)}">${icon('book')}</button></div>
    <div class="pills"><span class="pill green">${esc(resource.level)}${resource.levelBasis === 'editorial' ? ' *' : ''}</span><span class="pill">${esc(resource.formats.join(' · '))}</span><span class="pill">${resource.practiceMinutes} min practice</span></div>
    <h2><a href="#resource/${resource.id}">${esc(resource.title)}</a></h2><p lang="de">${esc(resource.summaryDe)}</p>
    ${englishMeaning(resource.summaryEn, { always: state.preferences.englishSupport === 'always' })}
    <div class="resource-meta"><span>${transcriptLabel(resource.transcript)}</span><span>${registrationLabel(resource.registration)}</span></div>
    ${saved.unavailable ? '<span class="pill amber">Reported unavailable</span>' : saved.difficulty === 'hard' ? '<span class="pill amber">You asked for more support</span>' : resource.accessCheck === 'manual' ? '<span class="pill amber">Publisher access needs a manual check</span>' : ''}
    <footer class="catalog-footer"><span class="fine">Source check · ${esc(resource.browserCheckedOn ?? resource.checkedOn)}<br>Publisher media needs internet</span><a href="#resource/${resource.id}" class="btn secondary">View guided activity ${icon('arrow')}</a></footer></article>`;
}

export function render(el, ctx) {
  const filters = { query: '', level: 'all', format: 'all', maxMinutes: 0, noRegistration: false, textSupport: false, bookmarked: false };
  const active = ctx.store.state.sessions.filter(session => session.kind === 'resource' && !session.completedAt).sort((a, b) => b.updatedAt - a.updatedAt)[0];
  el.innerHTML = `<div class="resource-page resource-library"><header class="workspace-heading"><span class="pill">German resource library</span>${pageHeading('REAL RESOURCES. YOUR OWN WORDS.', 'Listen, notice, then use it.', 'A curated library for job conversations and everyday work. Every resource has a short follow-up task inside Sprich.')}</header>
    <div class="practice-toolbar"><span class="pill green">${RESOURCES.length} guided resources · free-access material</span><a class="inline-link" href="#practice">Speaking missions ${icon('messages')}</a></div>
    <section class="card resource-filters" aria-label="Resource filters"><div class="resource-filter-grid">
      <label class="resource-search">Search resources<input type="text" id="resource-search" placeholder="Telefon, interview, office…"></label>
      <label>Level<select id="resource-level" aria-label="Level"><option value="all">All levels</option><option value="A2">A2 and supported basics</option><option value="B1">B1 and consolidation</option></select></label>
      <label>Format<select id="resource-format" aria-label="Format"><option value="all">All formats</option>${['audio', 'video', 'text', 'course', 'pronunciation', 'pdf', 'exercises'].map(format => `<option value="${format}">${format[0].toUpperCase() + format.slice(1)}</option>`).join('')}</select></label>
      <label>Practice time<select id="resource-time" aria-label="Practice time"><option value="0">Any length</option><option value="10">Up to 10 minutes</option><option value="15">Up to 15 minutes</option><option value="20">Up to 20 minutes</option></select></label></div>
      <div class="resource-checks"><label class="check-label"><input id="resource-no-account" type="checkbox">No registration required</label><label class="check-label"><input id="resource-text" type="checkbox">Text or captions available</label><label class="check-label"><input id="resource-saved" type="checkbox">Saved resources only</label><button class="text-button" id="clear-resource-filters">Clear resource filters</button></div></section>
    <div class="resource-library-layout section-gap"><section aria-label="Resource catalog"><div class="catalog-heading"><h2>Choose your source</h2><p id="resource-count" class="fine" aria-live="polite"></p></div><div id="resource-grid" class="resource-catalog-grid"></div></section>
    <aside class="stack resource-practice-rail" aria-label="Your resource practice">${active ? `<section class="card resource-resume"><p class="eyebrow">YOUR SAVED WORKSPACE</p><h2>${esc(active.content.resource.title)}</h2><p class="fine">Your response draft is ready to continue.</p><a class="btn" href="#session/${esc(active.id)}">Resume guided activity ${icon('arrow')}</a></section>` : ''}
      <section class="card"><span class="circle-icon">${icon('mic')}</span><p class="eyebrow">FROM INPUT TO CONVERSATION</p><h2>Make it your own.</h2><ol class="resource-workflow"><li><strong>Listen or read</strong><p>Choose a short section on the publisher’s site.</p></li><li><strong>Respond in German</strong><p>Return here to record or write your own response.</p></li><li><strong>Keep a useful phrase</strong><p>Save its meaning and source for your next conversation.</p></li></ol><span class="pill">Unscored practice</span></section>
      <section class="card resource-local"><h2>Ready when you return.</h2><p class="small">Guided notes and phrase capture stay available offline after the app is cached. Publisher audio and video need a connection.</p><p class="fine">Outside study time is self-reported, separate from measured in-app practice.</p><a class="inline-link" href="#phrases">Open my phrases ${icon('arrow')}</a></section></aside></div>
    <p class="fine section-gap">* Level suggested by Sprich. Times include the follow-up task. External sources need internet.</p></div>`;
  function draw() {
    const resources = filterResources(ctx.store.state, filters);
    el.querySelector('#resource-count').textContent = `${resources.length} ${resources.length === 1 ? 'resource matches' : 'resources match'} your filters`;
    el.querySelector('#resource-grid').innerHTML = resources.length ? resources.map(resource => card(resource, ctx.store.state)).join('') : '<div class="empty-state"><h2>No matching resources</h2><p>Try a shorter search or relax a filter. Your offline speaking missions are always available.</p><a class="btn secondary" href="#practice">Open missions</a></div>';
  }
  const inputs = [['#resource-search', 'query'], ['#resource-level', 'level'], ['#resource-format', 'format'], ['#resource-time', 'maxMinutes']];
  inputs.forEach(([selector, key]) => el.querySelector(selector).addEventListener(selector === '#resource-search' ? 'input' : 'change', event => { filters[key] = event.target.value; draw(); }));
  [['#resource-no-account', 'noRegistration'], ['#resource-text', 'textSupport'], ['#resource-saved', 'bookmarked']].forEach(([selector, key]) => el.querySelector(selector).addEventListener('change', event => { filters[key] = event.target.checked; draw(); }));
  el.querySelector('#clear-resource-filters').addEventListener('click', () => {
    Object.assign(filters, { query: '', level: 'all', format: 'all', maxMinutes: 0, noRegistration: false, textSupport: false, bookmarked: false });
    inputs.forEach(([selector, key]) => { el.querySelector(selector).value = filters[key]; });
    el.querySelectorAll('.resource-checks input').forEach(input => { input.checked = false; });
    draw();
    el.querySelector('#resource-search').focus();
  });
  el.querySelector('#resource-grid').addEventListener('click', async event => {
    const button = event.target.closest('[data-bookmark]');
    if (!button || button.disabled) return;
    button.disabled = true;
    try { const current = resourceState(ctx.store.state, button.dataset.bookmark); await ctx.store.setResourceState(current.id, { bookmarked: !current.bookmarked }); const id = button.dataset.bookmark; draw(); [...el.querySelectorAll('[data-bookmark]')].find(item => item.dataset.bookmark === id)?.focus(); }
    catch (error) { ctx.error(error.message); button.disabled = false; }
  });
  draw();
}

function sourceHeader(resource, ctx, { start = false } = {}) {
  const saved = resourceState(ctx.store.state, resource.id);
  const always = ctx.store.state.preferences.englishSupport === 'always';
  return `<section class="card resource-source" aria-label="Publisher source"><header class="resource-panel-heading"><span class="circle-icon">${icon('external')}</span><div><p class="eyebrow">PUBLISHER SOURCE</p><h2>${esc(resource.provider)}</h2></div></header><div class="pills"><span class="pill green">${esc(resource.level)}</span><span class="pill">${resource.practiceMinutes} min estimated practice</span><span class="pill">${registrationLabel(resource.registration)}</span></div>
    ${lessonCopy(resource.summaryDe, resource.summaryEn, { always })}
    <div class="btn-row"><a class="btn secondary" id="open-resource-source" href="${esc(resource.url)}" target="_blank" rel="noopener noreferrer">Open original resource ${icon('external')}</a>
      ${start ? `<button class="btn" id="start-resource">Start guided activity ${icon('arrow')}</button>` : ''}
      <button class="btn soft" id="save-resource" aria-pressed="${saved.bookmarked}">${icon('book')}${saved.bookmarked ? 'Saved resource' : 'Save resource'}</button></div>
    <p id="resource-network" class="callout section-gap" role="status" ${navigator.onLine ? 'hidden' : ''}>You are offline. Your guided notes and phrase capture still work. Open the source when connected.</p>
    <div class="resource-access"><span>${esc(resource.provider)}</span><span>${transcriptLabel(resource.transcript)}</span><span>${resource.voice === 'mixed' ? 'Mixed human / generated voices' : resource.voice === 'human' ? 'Human voice/video source' : resource.voice === 'provider-feedback' ? 'Publisher pronunciation feedback' : 'Reading material'}</span></div>
    <details class="source-notes"><summary>Access and source details</summary><p>${esc(resource.access)}</p><p class="fine">${esc(resource.verification)} Publisher information checked ${esc(resource.checkedOn)}.</p>
      <p class="fine">Browser check ${esc(resource.browserCheckedOn ?? 'pending')}: ${resource.accessCheck === 'manual' ? 'the publisher restricted automated access; it may work in your normal browser. An alternative is available below.' : resource.playbackCheck === 'verified' ? 'page access and muted media playback were verified.' : 'the page was reachable; media may require choosing an exercise or signing in.'}</p></details>
    <div class="resource-rating"><label>How difficult was this resource?<select id="resource-difficulty">${[['unrated', 'Not rated yet'], ['easy', 'Easy'], ['right', 'About right'], ['hard', 'Too difficult right now']].map(([value, label]) => `<option value="${value}" ${saved.difficulty === value ? 'selected' : ''}>${label}</option>`).join('')}</select></label>
      <button class="text-button" id="report-resource">${saved.unavailable ? 'Mark source available again' : 'This source is unavailable / won’t play'}</button></div></section>`;
}

function alternatives(resource, state) {
  const flag = resourceState(state, resource.id);
  if (!flag.unavailable && flag.difficulty !== 'hard' && resource.accessCheck !== 'manual') return '';
  const options = alternativesFor(state, resource);
  return `<section class="callout amber section-gap"><h2>Try a more accessible next step.</h2><p>${flag.unavailable ? 'This source is marked unavailable on this device.' : flag.difficulty === 'hard' ? 'You marked this resource too difficult for now.' : 'This publisher restricted automated access during our check. You can try it in your browser or choose an alternative.'} Your draft and previous practice remain saved.</p>
    <div class="alternative-list">${options.map(item => `<div><span>${esc(item.title)} <small>· ${esc(item.level)}</small></span><button class="btn secondary small-btn" data-alternative="${item.id}">Use this activity</button></div>`).join('')}</div>
    <button class="btn secondary" id="resource-fallback">Practise the in-app situation instead ${icon('arrow')}</button></section>`;
}

function bindSource(el, resource, ctx, { onOpen = () => {}, onBeforeRefresh = async () => {}, missionId = resource.missionIds[0] } = {}) {
  const link = el.querySelector('#open-resource-source');
  const updateNetwork = () => { if (!link.isConnected) return; link.setAttribute('aria-disabled', String(!navigator.onLine)); el.querySelector('#resource-network').hidden = navigator.onLine; };
  updateNetwork();
  window.addEventListener('online', updateNetwork, { signal: ctx.signal });
  window.addEventListener('offline', updateNetwork, { signal: ctx.signal });
  link.addEventListener('click', event => { if (!navigator.onLine) { event.preventDefault(); ctx.notify('The publisher needs a connection. Your in-app lessons still work offline.'); } else onOpen(); });
  safeAction(el.querySelector('#save-resource'), async () => {
    const current = resourceState(ctx.store.state, resource.id);
    await ctx.store.setResourceState(resource.id, { bookmarked: !current.bookmarked });
    const button = el.querySelector('#save-resource');
    button.setAttribute('aria-pressed', String(!current.bookmarked));
    button.innerHTML = `${icon('book')}${!current.bookmarked ? 'Saved resource' : 'Save resource'}`;
  }, ctx.error);
  el.querySelector('#resource-difficulty').addEventListener('change', async event => {
    try { await onBeforeRefresh(); await ctx.store.setResourceState(resource.id, { difficulty: event.target.value }); await ctx.refresh(); }
    catch (error) { ctx.error(error.message); }
  });
  safeAction(el.querySelector('#report-resource'), async () => {
    await onBeforeRefresh();
    await ctx.store.setResourceState(resource.id, { unavailable: !resourceState(ctx.store.state, resource.id).unavailable });
    await ctx.refresh();
  }, ctx.error);
  el.querySelectorAll('[data-alternative]').forEach(button => safeAction(button, () => ctx.startResource(button.dataset.alternative, { missionId, replacePlan: true }), ctx.error));
  safeAction(el.querySelector('#resource-fallback'), () => ctx.startMission(missionId), ctx.error);
}

export function renderDetail(el, ctx, id) {
  const resource = resourceById(id);
  if (!resource) throw new Error('This resource is not in the current catalog. Open the resource library to choose another.');
  const always = ctx.store.state.preferences.englishSupport === 'always';
  const words = resource.phraseIds.map(phraseId => phraseById(phraseId, ctx.store.state)).filter(Boolean);
  el.innerHTML = `<div class="resource-page resource-detail"><a class="inline-link" href="#resources">${icon('back')}All German resources</a>
    ${pageHeading(resource.provider, resource.title, resource.titleEn)}<div class="resource-detail-layout">${sourceHeader(resource, ctx, { start: true })}
    <section class="card resource-followup" aria-label="Guided follow-up"><div class="workspace-task-meta"><p class="eyebrow">YOUR FOLLOW-UP TASK</p><span class="pill">Unscored practice</span></div>
      ${lessonCopy(resource.taskDe, resource.taskEn, { always })}<ol class="guided-steps" lang="de">${resource.stepsDe.map(step => `<li>${esc(step)}</li>`).join('')}</ol>
      ${englishMeaning(resource.stepsEn.join('\n'), { always })}<p class="fine">Opening the source does not complete the activity. Save your own response in the guided workspace.</p>
    <div class="resource-phrase-bench"><p class="eyebrow">PHRASES TO NOTICE</p>${words.map(word => `<div class="resource-phrase"><strong lang="de">${esc(word.de)}</strong>${englishMeaning(word.en, { always })}</div>`).join('')}
      <a href="#phrases" class="inline-link">Your complete phrase collection ${icon('arrow')}</a></div></section></div>${alternatives(resource, ctx.store.state)}</div>`;
  safeAction(el.querySelector('#start-resource'), () => ctx.startResource(resource.id), ctx.error);
  bindSource(el, resource, ctx);
}

export async function renderActivity(el, ctx, sessionId) {
  const session = ctx.store.state.sessions.find(item => item.id === sessionId);
  if (!session || session.kind !== 'resource') throw new Error('This resource activity could not be found.');
  const resource = session.content.resource;
  const draft = draftFor(session, 'resource-response');
  const locked = Boolean(session.completedAt);
  const always = ctx.store.state.preferences.englishSupport === 'always';
  let alive = true;
  let recorder = null;
  let clock = null;
  let pending = Promise.resolve();
  let saveTimer = null;
  let journal = null;
  let invalidNumberInput = false;
  const activeMs = () => ctx.store.state.activity.filter(item => item.sessionId === session.id).reduce((sum, item) => sum + item.ms, 0);

  async function persist() {
    clearTimeout(saveTimer);
    if (locked) return;
    const value = structuredClone(draft);
    const written = journal;
    pending = pending.catch(() => {}).then(() => ctx.store.saveDraft(session.id, 'resource-response', value));
    await pending;
    if (written) clearJournal(session.id, written);
    if (alive) el.querySelector('#resource-draft-status').textContent = 'Draft saved on this device';
  }
  function changed() {
    updateControls();
    journal = journalDraft(session.id, 'resource-response', draft);
    clearTimeout(saveTimer);
    if (alive) el.querySelector('#resource-draft-status').textContent = 'Saving your draft…';
    saveTimer = setTimeout(() => { void persist().catch(error => ctx.error(error.message)); }, 300);
    return Promise.resolve();
  }
  function updateControls() {
    if (!alive || locked) return;
    const save = el.querySelector('#finish-resource');
    const validMinutes = !invalidNumberInput && Number.isInteger(draft.externalMinutes) && draft.externalMinutes >= 0 && draft.externalMinutes <= 120;
    if (save) save.disabled = !(draft.recordingMs > 0 || draft.text.trim()) || !validMinutes;
    const note = el.querySelector('#outside-time-error');
    if (note) note.hidden = validMinutes;
    el.querySelector('#outside-minutes')?.setAttribute('aria-invalid', String(!validMinutes));
  }
  el.innerHTML = `<div class="resource-page resource-activity"><div class="session-top"><a class="inline-link" href="#resources">${icon('back')}Resource library</a><div class="session-time"><span id="resource-clock">${duration(activeMs())}</span><span class="fine" id="resource-clock-label">in-app practice</span></div></div>
    ${pageHeading(locked ? 'SAVED RESOURCE PRACTICE' : 'LISTEN. NOTICE. USE YOUR OWN WORDS.', resource.title, 'A saved response connects this source to your German practice.')}
    <div class="resource-workspace section-gap"><section class="card resource-response" aria-label="Your German response"><div class="workspace-task-meta"><h2>Your German response</h2><span class="pill">Unscored practice</span></div>
      <div class="resource-response-prompt"><p class="eyebrow">USE YOUR OWN WORDS</p>${lessonCopy(resource.taskDe, resource.taskEn, { always })}</div>
      <div id="resource-recorder"></div><p class="fine" id="resource-draft-status" aria-live="polite">Draft saved on this device</p>
      ${locked ? `<div class="callout"><strong>Practice response saved.</strong><p>This is unscored practice. ${draft.recordingMs ? `${duration(draft.recordingMs)} of recording was saved.` : 'Your written response is saved.'}</p></div>
        <div class="resource-outside">${provenance('reported')}<p>${draft.externalMinutes} minutes on the publisher’s site · kept out of the measured timer.</p></div>
        <div class="btn-row section-gap"><button class="btn" id="continue-mission">Practise the matching mission ${icon('arrow')}</button><a class="btn secondary" href="#today">Back to Today</a></div>` : `
        <div class="resource-outside"><div class="workspace-task-meta"><h3>Outside study</h3>${provenance('reported')}</div>
        <label class="outside-time">Minutes studied on the publisher’s site (optional)<input type="number" id="outside-minutes" min="0" max="120" step="1" value="${draft.externalMinutes}" aria-describedby="outside-time-error"><span class="field-hint">Self-reported, kept out of the measured timer.</span></label>
         <p class="callout error small" id="outside-time-error" role="alert" hidden>Use a whole number from 0 to 120 minutes.</p></div>
        <p class="fine">Save a recording or a written response to finish.</p>
        <button class="btn" id="finish-resource">Save response &amp; complete activity ${icon('check')}</button>`}</section>
      <aside class="stack" aria-label="Source and phrase workspace">${sourceHeader(resource, ctx)}${alternatives(resource, ctx.store.state)}<section class="card"><p class="eyebrow">A SHORT WORKFLOW</p><ol class="guided-steps" lang="de">${resource.stepsDe.map(step => `<li>${esc(step)}</li>`).join('')}</ol>${englishMeaning(resource.stepsEn.join('\n'), { always })}
        <p class="fine">The timer pauses while you are on another tab.</p></section>
      <section class="card resource-capture"><p class="eyebrow">CARRY A PHRASE FORWARD</p><h2>Keep something you can use.</h2><p class="fine">Save a short phrase and your own example. It becomes available for spoken recall.</p><p class="phrase-source fine">Source: ${esc(resource.provider)} · ${esc(resource.title)}</p><details><summary>Add a personal phrase</summary>${phraseForm(resource)}</details></section></aside></div></div>`;
  if (!locked) {
    clock = createPracticeClock({ sessionId: session.id, timeZone: ctx.store.state.preferences.timeZone,
      onSegments: async segments => { try { await ctx.store.addActivity(segments); } catch (error) { ctx.error(error.message); } },
      onTick: state => { if (alive) { el.querySelector('#resource-clock').textContent = duration(activeMs()); el.querySelector('#resource-clock-label').textContent = state.paused ? 'paused while away/idle' : 'in-app practice'; } },
    });
    clock.start();
  }
  recorder = await mountRecording(el.querySelector('#resource-recorder'), { draft, key: `${session.id}:resource-response`, store: ctx.store, ctx: { ...ctx, interact: () => clock?.interact() }, locked, onChange: changed });
  el.querySelector('#outside-minutes')?.addEventListener('input', event => {
    const value = Number(event.target.value);
    invalidNumberInput = !Number.isFinite(value) || event.target.validity.badInput;
    if (!invalidNumberInput) draft.externalMinutes = value;
    void changed();
  });
  bindSource(el, resource, ctx, {
    missionId: session.missionId,
    onOpen: () => { if (!locked) { draft.sourceOpened = true; void changed(); } },
    onBeforeRefresh: async () => { await recorder.stop(); await persist(); },
  });
  bindPhraseForm(el, ctx);
  safeAction(el.querySelector('#finish-resource'), async () => {
    await recorder.stop(); await persist(); await clock?.flush();
    const attempt = resourceAttempt(session, draft, ctx.store.state.preferences.timeZone);
    await ctx.store.finishResource(session.id, attempt);
    ctx.notify('Practice response saved. Outside study time is labelled separately.');
    await ctx.refresh();
  }, ctx.error);
  safeAction(el.querySelector('#continue-mission'), () => ctx.startMission(session.missionId), ctx.error);
  updateControls();
  return async () => {
    alive = false;
    await recorder.dispose(); clearTimeout(saveTimer);
    if (!locked) await persist();
    await pending; await clock?.stop();
  };
}
