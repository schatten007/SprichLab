import { createStore, LEGACY_KEY } from './store.js';
import { createSession } from './session.js';
import { recoverDrafts } from './draft-journal.js';
import { MISSIONS, allPhrases } from '../data/missions.js';
import { resourceById } from '../data/resources.js';
import { createResourceSession } from './resources.js';
import { createSpeechService } from './tts.js';
import { esc, icon } from './ui.js';
import { hasSharedCaptureIntent, sharedCapture } from './phrase-form.js';
import * as Lessons from './v-lessons.js';
import * as Words from './v-words.js';
import { finishOnboarding, shouldOfferOnboarding } from './onboarding.js';

// Only the beginner path is in the core bundle. Every other screen is a
// separate chunk, so the default route never downloads the workplace course UI.
const views = {
  today: () => import('./v-dash.js'),
  practice: () => import('./v-practice.js'),
  phrases: () => import('./v-vocab.js'),
  progress: () => import('./v-progress.js'),
  settings: () => import('./v-settings.js'),
  resources: () => import('./v-resources.js'),
  session: () => import('./v-train1.js'),
  gemini: () => import('./v-gemini.js'),
  ai: () => import('./v-ai.js'),
  assessments: () => import('./v-assessments.js'),
  how: () => import('./v-how.js'),
  'getting-started': () => import('./v-onboarding.js'),
};
const SIMPLE_ROUTES = new Set(['today', 'lessons', 'words', 'practice', 'phrases', 'resources', 'progress', 'settings', 'how']);
import { loadCourse, starterSnapshot } from './starter-content.js';
import { createStarterSession, createWordSession } from './starter-state.js';
import { warmAssessmentShell } from './assessment-offline.js';

const main = document.querySelector('#main');
const toast = document.querySelector('#toast');
let toastTimer = null;
let installPrompt = null;
let cleanup = null;
let routeController = null;
let renderQueue = Promise.resolve();
let store = null;
let firstRender = true;
const themeQuery = matchMedia('(prefers-color-scheme: dark)');
document.querySelector('.skip-link').addEventListener('click', event => {
  event.preventDefault();
  main.focus();
  main.scrollIntoView({ block: 'start' });
});

function notify(message, error = false) {
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.toggle('error', error);
  toast.setAttribute('role', error ? 'alert' : 'status');
  toast.hidden = false;
  toastTimer = setTimeout(() => { toast.hidden = true; }, error ? 12_000 : 6500);
}
const showError = message => notify(message, true);
export const LIGHT_PALETTES = ['paper', 'contrast'];
/** The light palette is per-device, so one browser can stay high-contrast without changing the other. */
function readPalette() {
  try { return LIGHT_PALETTES.includes(localStorage.getItem('sprich.palette')) ? localStorage.getItem('sprich.palette') : 'paper'; }
  catch { return 'paper'; }
}
function applyTheme() {
  let mirrored = null;
  try { mirrored = localStorage.getItem('sprich.mode'); } catch { /* Theme still applies from IndexedDB. */ }
  const saved = store?.state.preferences.theme ?? 'dark';
  // Keep older device-local light/system choices working while new state defaults to Night.
  const mode = saved === 'dark' && ['system', 'light'].includes(mirrored) ? mirrored : saved;
  const dark = mode === 'dark' || (mode === 'system' && themeQuery.matches);
  const root = document.documentElement;
  root.dataset.theme = dark ? 'dark' : 'light';
  root.dataset.palette = dark ? 'night' : readPalette();
  // Mirrored for the pre-paint script in index.html, which cannot read IndexedDB.
  try { localStorage.setItem('sprich.mode', mode); } catch { /* Appearance still applies this session. */ }
}
themeQuery.addEventListener('change', applyTheme);

const PRIMARY_NAV = [['today', 'home', 'Today'], ['lessons', 'messages', 'Lessons'], ['words', 'book', 'Words'], ['progress', 'chart', 'Progress']];
const MORE_NAV = [['ai', 'mic', 'AI Talk'], ['assessments', 'check', 'Checks & roleplays'], ['practice', 'briefcase', 'Workplace'], ['settings', 'settings', 'Settings'], ['how', 'eye', 'How progress works']];
const navLink = ([route, symbol, label]) => `<a class="nav-link" href="#${route}" data-nav="${route}">${icon(symbol)}<span>${label}</span></a>`;
document.querySelector('#navigation').innerHTML = `${PRIMARY_NAV.map(navLink).join('')}
  <details class="nav-more"><summary class="nav-link">${icon('layers')}<span>More</span></summary>
    <div class="nav-more-panel">${MORE_NAV.map(navLink).join('')}</div></details>`;
// Settings is in the menu now, so the sidebar footer link is desktop decoration only.
document.querySelector('#settings-link').insertAdjacentHTML('afterbegin', icon('settings'));
const moreMenu = document.querySelector('.nav-more');
// The sidebar shows every entry at once; the bottom bar needs a real menu.
const wideNav = matchMedia('(min-width: 761px)');
const syncMoreMenu = () => {
  if (!wideNav.matches) { moreMenu.open = false; return; }
  const route = location.hash.slice(1).split('/')[0];
  moreMenu.open = MORE_NAV.some(([entry]) => entry === route);
};
wideNav.addEventListener('change', syncMoreMenu);
syncMoreMenu();
document.addEventListener('click', event => {
  if (!wideNav.matches && moreMenu.open && !moreMenu.contains(event.target)) moreMenu.open = false;
});
moreMenu.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !wideNav.matches && moreMenu.open) { moreMenu.open = false; moreMenu.querySelector('summary').focus(); }
});

window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); installPrompt = event; });
function updateConnection() {
  document.querySelector('#connection').textContent = navigator.onLine ? 'Device ready · local' : 'Offline · local';
}

function captureSharedIntent() {
  const href = location.href;
  const params = new globalThis.URLSearchParams(location.search);
  const hasKnownParams = ['title', 'text', 'url'].some(key => params.has(key));
  if (!hasKnownParams) return null;
  const capture = hasSharedCaptureIntent(href) ? sharedCapture(href) : null;
  const clean = new URL(href);
  ['title', 'text', 'url'].forEach(key => clean.searchParams.delete(key));
  const requestedRoute = clean.hash.slice(1);
  if (capture && (!requestedRoute || requestedRoute === 'today')) clean.hash = '#phrases';
  globalThis.history.replaceState(null, document.title, `${clean.pathname}${clean.search}${clean.hash}`);
  return capture;
}
const bootSharedCapture = captureSharedIntent();
window.addEventListener('online', updateConnection);
window.addEventListener('offline', updateConnection);
updateConnection();

async function boot() {
  try {
    let legacyRaw = null;
    try { legacyRaw = localStorage.getItem(LEGACY_KEY); } catch { /* IndexedDB does not require access to localStorage. */ }
    store = await createStore({ legacyRaw });
    await recoverDrafts(store);
    let offerOnboarding = shouldOfferOnboarding(store.state);
    applyTheme();
    const speech = createSpeechService(() => store.state.preferences);
    async function play(text, button, options) {
      if (button?.dataset.playing === 'true') { speech.stop(); return { status: 'cancelled' }; }
      const original = button?.innerHTML;
      if (button) { button.dataset.playing = 'true'; button.innerHTML = `${icon('stop')}Stop audio`; }
      document.querySelectorAll('audio').forEach(audio => audio.pause());
      try { return await speech.speak(text, options); }
      catch (error) { showError(error.message); return { status: 'error' }; }
      finally {
        if (button?.isConnected) { button.innerHTML = original; delete button.dataset.playing; }
      }
    }
    const context = {
      store, speech, play, notify, error: showError, applyTheme,
      get shouldOfferOnboarding() { return offerOnboarding; },
      finishOnboarding() { finishOnboarding(); offerOnboarding = false; },
      sharedCapture: bootSharedCapture,
      clearSharedCapture() { context.sharedCapture = null; },
      go(route) {
        if (location.hash === `#${route}`) return requestRender();
        location.hash = route;
      },
      refresh: () => requestRender(),
      async startStarter(id, { support = 'guided' } = {}) {
        context.finishOnboarding();
        await store.refresh();
        let session = store.state.starter.sessions.find(item => item.lessonId === id && !item.completedAt);
        if (!session) {
          const course = await loadCourse(store);
          const variant = store.state.starter.sessions.filter(item => item.lessonId === id && item.completedAt).length;
          session = createStarterSession(starterSnapshot(course, id), { variant, support });
          await store.addStarterSession(session);
        }
        context.go(`learn/${session.id}`);
      },
      async startWordPractice(ids, mode = 'recall') {
        const course = await loadCourse(store);
        const words = [...new Set(ids)].map(id => course.words.find(word => word.id === id)).filter(Boolean).slice(0, 10);
        const session = createWordSession(words, mode);
        await store.addWordSession(session);
        context.go(`word-session/${session.id}`);
      },
      async startMission(id) {
        await store.refresh();
        let session = store.state.sessions.find(item => item.missionId === id && item.kind === 'mission' && !item.completedAt);
        if (!session) { session = createSession(store.state, id); await store.addSession(session); }
        context.go(`session/${session.id}`);
      },
      async startReview(ids) {
        await store.refresh();
        const valid = [...new Set(ids)].filter(id => allPhrases(store.state).some(phrase => phrase.id === id)).slice(0, 10);
        if (!valid.length) { context.go('phrases'); return; }
        const mission = MISSIONS.find(item => item.phraseIds.includes(valid[0])) ?? MISSIONS[0];
        const session = createSession(store.state, mission.id, { phraseIds: valid });
        await store.addSession(session);
        context.go(`session/${session.id}`);
      },
      async startResource(id, { missionId = null, replacePlan = false } = {}) {
        await store.refresh();
        const resource = resourceById(id);
        if (!resource) throw new Error('Choose a resource from the catalog.');
        let session = store.state.sessions.find(item => item.kind === 'resource' && item.resourceId === resource.id && !item.completedAt);
        if (!session) {
          session = createResourceSession(store.state, resource.id, { missionId: resource.missionIds.includes(missionId) ? missionId : null });
          await store.addSession(session);
        }
        if (replacePlan) { await store.ensureDailyPlan(); await store.useDailyResource(resource.id); }
        context.go(`session/${session.id}`);
      },
      async install() {
        if (!installPrompt) { notify('In your browser menu, choose “Install app” or “Add to Home screen”. Use the HTTPS hosted version on Android.'); return; }
        await installPrompt.prompt();
        await installPrompt.userChoice;
        installPrompt = null;
      },
    };

    async function renderRoute() {
      if (cleanup) { const previous = cleanup; cleanup = null; await previous(); }
      routeController?.abort();
      speech.stop();
      routeController = new AbortController();
      await store.refresh();
      applyTheme();
      const route = location.hash.slice(1) || 'today';
      const nav = route === 'ai' || route.startsWith('ai/session/') ? 'ai'
        : route.startsWith('assessment') ? 'assessments'
          : route === 'words' || route.startsWith('word-session/') || route === 'phrases' ? 'words'
            : route === 'practice' || route.startsWith('session/') || route.startsWith('resource') ? 'practice'
              : route.startsWith('lesson') || route.startsWith('learn/') || route.startsWith('gemini/') ? 'lessons' : route;
      document.querySelectorAll('[data-nav]').forEach(link => {
        if (link.dataset.nav === nav) link.setAttribute('aria-current', 'page');
        else link.removeAttribute('aria-current');
      });
      // Mark the menu itself when one of its entries is the current screen.
      moreMenu.dataset.active = String(MORE_NAV.some(([entry]) => entry === nav));
      syncMoreMenu();
      const viewContext = { ...context, signal: routeController.signal };
      try {
        if (route.startsWith('session/')) {
          const id = route.slice(8);
          cleanup = store.state.sessions.find(session => session.id === id)?.kind === 'resource'
            ? await (await views.resources()).renderActivity(main, viewContext, id)
            : await (await views.session()).render(main, viewContext, id);
        }
        else if (route.startsWith('resource/')) cleanup = await (await views.resources()).renderDetail(main, viewContext, route.slice(9));
        else if (route.startsWith('ai/session/')) cleanup = await (await views.ai()).renderSession(main, viewContext, route.slice(11));
        else if (route === 'ai') cleanup = await (await views.ai()).render(main, viewContext);
        else if (route.startsWith('lesson/')) cleanup = await Lessons.renderOverview(main, viewContext, route.slice('lesson/'.length));
        else if (route.startsWith('learn/')) cleanup = await Lessons.renderSession(main, viewContext, route.slice('learn/'.length));
        else if (route.startsWith('word-session/')) cleanup = await Words.renderSession(main, viewContext, route.slice('word-session/'.length));
        else if (route.startsWith('gemini/')) cleanup = await (await views.gemini()).render(main, viewContext, route.slice('gemini/'.length));
        else if (route === 'getting-started') cleanup = await (await views['getting-started']()).render(main, viewContext);
        else if (route === 'assessments' || route.startsWith('assessments/lesson/')) {
          const module = await views.assessments();
          cleanup = await module.render(main, viewContext, route === 'assessments' ? null : route.slice('assessments/lesson/'.length));
        }
        else if (route.startsWith('assessment-result/')) cleanup = await (await views.assessments()).renderResult(main, viewContext, route.slice('assessment-result/'.length));
        else if (route.startsWith('assessment/')) cleanup = await (await views.assessments()).renderRun(main, viewContext, route.slice('assessment/'.length));
        else if (route === 'lessons') cleanup = await Lessons.render(main, viewContext);
        else if (route === 'words') cleanup = await Words.render(main, viewContext);
        else {
          const name = SIMPLE_ROUTES.has(route) ? route : 'today';
          // The beginner path owns Today, so the workplace dashboard stays out of the default load.
          cleanup = name === 'today' && store.state.preferences.learningPath === 'starter'
            ? await Lessons.renderToday(main, viewContext)
            : await (await views[name]()).render(main, viewContext);
        }
        document.title = `${main.querySelector('h1')?.textContent ?? 'German practice'} · Sprich`;
        // Every screen beyond the beginner path is an optional chunk. Warm them after the
        // first render so an installed app still opens them offline, unvisited.
        void warmAssessmentShell().then(ready => { document.body.dataset.assessmentOfflineReady = String(ready); });
        if (!firstRender) main.querySelector('h1')?.focus({ preventScroll: true });
        window.scrollTo({ top: 0, behavior: 'instant' });
        firstRender = false;
      } catch (error) {
        main.innerHTML = `<section class="card"><h1 tabindex="-1">Let’s get your practice back.</h1><p class="section-gap">${esc(error.message)}</p><a class="btn" href="#practice">Choose a mission</a></section>`;
        console.error(error);
      }
    }
    function requestRender() {
      // Re-render requests may come from a view; never wait for them inside the
      // render queue's own cleanup. Saves are flushed before mounting a new view.
      renderQueue = renderQueue.catch(() => {}).then(renderRoute);
      return renderQueue;
    }
    window.addEventListener('hashchange', () => { void requestRender().catch(error => showError(error.message)); });
    window.addEventListener('pagehide', () => { speech.stop(); void Promise.resolve(cleanup?.()).catch(() => {}); });
    window.addEventListener('pageshow', event => { if (event.persisted) void requestRender().catch(error => showError(error.message)); });
    await requestRender();
    void registerOffline(context);
  } catch (error) {
    main.innerHTML = `<section class="card"><p class="eyebrow">LOCAL PROGRESS</p><h1 tabindex="-1">Your browser storage isn’t ready.</h1><p class="section-gap">${esc(error.message)}</p><p>Allow this site to store data, then reload. Existing stored data has not been reset.</p><button class="btn" id="retry-boot">Try again</button></section>`;
    document.querySelector('#retry-boot').addEventListener('click', () => location.reload());
    console.error(error);
  }
}

async function registerOffline(ctx) {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  try {
    const registration = await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`);
    const offerUpdate = () => {
      if (!registration.waiting || !navigator.serviceWorker.controller) return;
      const notice = document.querySelector('#notice');
      notice.innerHTML = 'An updated practice app is ready. <button class="btn small-btn" id="update-app">Save &amp; update</button>';
      notice.hidden = false;
      notice.querySelector('button').addEventListener('click', async () => {
        try {
          if (cleanup) { await cleanup(); cleanup = null; }
          registration.waiting?.postMessage('ACTIVATE_UPDATE');
          navigator.serviceWorker.addEventListener('controllerchange', () => location.reload(), { once: true });
        } catch (error) { ctx.error(error.message); }
      });
    };
    offerUpdate();
    registration.addEventListener('updatefound', () => registration.installing?.addEventListener('statechange', offerUpdate));
  } catch {
    document.querySelector('#notice').textContent = 'Offline setup could not finish. Online practice still works; reload while connected to try again.';
    document.querySelector('#notice').hidden = false;
  }
}

void boot();
