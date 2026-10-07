import { createStore, LEGACY_KEY } from './store.js';
import { createSession } from './session.js';
import { recoverDrafts } from './draft-journal.js';
import { MISSIONS, allPhrases } from '../data/missions.js';
import { resourceById } from '../data/resources.js';
import { createResourceSession } from './resources.js';
import { createSpeechService } from './tts.js';
import { esc, icon } from './ui.js';
import * as Today from './v-dash.js';
import * as Practice from './v-practice.js';
import * as Phrases from './v-vocab.js';
import * as Progress from './v-progress.js';
import * as Settings from './v-settings.js';
import * as Session from './v-train1.js';
import * as Resources from './v-resources.js';
import * as AI from './v-ai.js';
import * as Lessons from './v-lessons.js';
import * as Words from './v-words.js';
import * as Gemini from './v-gemini.js';
import { loadCourse, starterSnapshot } from './starter-content.js';
import { createStarterSession, createWordSession } from './starter-state.js';

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
function applyTheme() {
  const theme = store?.state.preferences.theme ?? 'system';
  document.documentElement.dataset.theme = theme === 'system' ? (themeQuery.matches ? 'dark' : 'light') : theme;
}
themeQuery.addEventListener('change', applyTheme);

document.querySelector('#navigation').innerHTML = [
  ['today', 'home', 'Today'], ['lessons', 'messages', 'Lessons'], ['words', 'book', 'Words'], ['ai', 'mic', 'AI Talk'], ['progress', 'chart', 'Progress'],
].map(([route, symbol, label]) => `<a class="nav-link" href="#${route}" data-nav="${route}">${icon(symbol)}<span>${label}</span></a>`).join('');
document.querySelector('#settings-link').insertAdjacentHTML('afterbegin', icon('settings'));

window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); installPrompt = event; });
function updateConnection() {
  document.querySelector('#connection').textContent = navigator.onLine ? 'Saved on this device' : 'Offline · on this device';
}
window.addEventListener('online', updateConnection);
window.addEventListener('offline', updateConnection);
updateConnection();

async function boot() {
  try {
    let legacyRaw = null;
    try { legacyRaw = localStorage.getItem(LEGACY_KEY); } catch { /* IndexedDB does not require access to localStorage. */ }
    store = await createStore({ legacyRaw });
    await recoverDrafts(store);
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
      go(route) {
        if (location.hash === `#${route}`) return requestRender();
        location.hash = route;
      },
      refresh: () => requestRender(),
      async startStarter(id, { support = 'guided' } = {}) {
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
        : route === 'words' || route.startsWith('word-session/') || route === 'phrases' ? 'words'
          : route === 'practice' || route.startsWith('session/') || route.startsWith('resource') || route.startsWith('lesson') || route.startsWith('learn/') || route.startsWith('gemini/') ? 'lessons' : route;
      document.querySelectorAll('[data-nav]').forEach(link => {
        if (link.dataset.nav === nav) link.setAttribute('aria-current', 'page');
        else link.removeAttribute('aria-current');
      });
      const viewContext = { ...context, signal: routeController.signal };
      try {
        if (route.startsWith('session/')) {
          const id = route.slice(8);
          cleanup = store.state.sessions.find(session => session.id === id)?.kind === 'resource'
            ? await Resources.renderActivity(main, viewContext, id) : await Session.render(main, viewContext, id);
        }
        else if (route.startsWith('resource/')) cleanup = await Resources.renderDetail(main, viewContext, route.slice(9));
        else if (route.startsWith('ai/session/')) cleanup = await AI.renderSession(main, viewContext, route.slice(11));
        else if (route.startsWith('lesson/')) cleanup = await Lessons.renderOverview(main, viewContext, route.slice('lesson/'.length));
        else if (route.startsWith('learn/')) cleanup = await Lessons.renderSession(main, viewContext, route.slice('learn/'.length));
        else if (route.startsWith('word-session/')) cleanup = await Words.renderSession(main, viewContext, route.slice('word-session/'.length));
        else if (route.startsWith('gemini/')) cleanup = await Gemini.render(main, viewContext, route.slice('gemini/'.length));
        else {
          const view = { today: Today, lessons: Lessons, words: Words, practice: Practice, phrases: Phrases, resources: Resources, progress: Progress, settings: Settings, ai: AI }[route] ?? Today;
          cleanup = await view.render(main, viewContext);
        }
        document.title = `${main.querySelector('h1')?.textContent ?? 'German practice'} · Sprich`;
        if (!firstRender) main.querySelector('h1')?.focus({ preventScroll: true });
        window.scrollTo({ top: 0, behavior: 'instant' });
        firstRender = false;
      } catch (error) {
        main.innerHTML = `<section class="card"><h1>Let’s get your practice back.</h1><p class="section-gap">${esc(error.message)}</p><a class="btn" href="#practice">Choose a mission</a></section>`;
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
    main.innerHTML = `<section class="card"><p class="eyebrow">LOCAL PROGRESS</p><h1>Your browser storage isn’t ready.</h1><p class="section-gap">${esc(error.message)}</p><p>Allow this site to store data, then reload. Existing stored data has not been reset.</p><button class="btn" id="retry-boot">Try again</button></section>`;
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
