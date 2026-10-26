import '../css/settings.css';
import { PROFILE_FIELDS, PLAN_LENGTHS, validTimeZone } from './model.js';
import { germanVoices } from './tts.js';
import { aiClient } from './ai-gateway.js';
import { createAISpeech } from './ai-speech.js';
import { esc, icon, pageHeading, safeAction, downloadFile } from './ui.js';

const PROFILE = [
  ['name', 'What should we call you?', 'Your first name'],
  ['studies', 'Your studies', 'e.g. Informatik, drittes Semester'],
  ['experience', 'One real skill or experience', 'e.g. Erfahrung mit Excel; ein Gruppenprojekt an der Uni'],
  ['availability', 'Your availability', 'e.g. 16 Stunden pro Woche, montags und donnerstags'],
  ['start', 'When could you start?', 'e.g. ab November'],
  ['motivation', 'What do you want to learn or contribute?', 'e.g. praktische Erfahrung sammeln und im Team arbeiten'],
];

function formatBytes(size) {
  if (size < 1024) return `${size} bytes`;
  if (size < 1_000_000) return `${(size / 1_000).toFixed(1)} KB`;
  return `${(size / 1_000_000).toFixed(1)} MB`;
}

function backupComposition(state) {
  const starterSessions = state.starter?.sessions?.length ?? 0;
  const starterReviews = state.starter?.reviews?.length ?? 0;
  const aiSessions = state.aiSessions?.length ?? 0;
  const assessmentAttempts = state.assessments?.attempts?.length ?? 0;
  return `<ul class="backup-composition-list">
    <li><strong>Profile and preferences</strong><span>Profile facts, daily goal, time zone, theme, voice, and support choices</span></li>
    <li><strong>Practice evidence · ${state.attempts.length} attempts</strong><span>${state.sessions.length} saved workplace sessions · ${state.activity.length} measured activity records</span></li>
    <li><strong>Beginner practice and saved phrases</strong><span>${starterSessions} lesson sessions · ${starterReviews} word reviews · ${state.personalPhrases.length} personal phrases</span></li>
    <li><strong>Conversations and checks</strong><span>${aiSessions} AI conversations · ${assessmentAttempts} saved checks</span></li>
    <li><strong>Audio recordings stay on this device</strong><span>Recordings and cached voice clips are not included in progress exports.</span></li>
  </ul>`;
}

export async function render(el, ctx) {
  const state = ctx.store.state;
  const profile = state.profile;
  const preferences = state.preferences;
  const aiSpeech = createAISpeech(ctx, ctx.aiClient ?? aiClient);
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const zones = [...new Set([preferences.timeZone, 'Europe/Berlin', zone, 'UTC'])].filter(Boolean);

  el.innerHTML = `<div class="settings-page">
    ${pageHeading('SETTINGS, PROFILE & BACKUPS', 'Make it fit your life.', 'Keep your practice personal, choose a comfortable voice, and carry your progress between devices.')}

    <section class="settings-hero card" aria-label="Local-first storage">
      <div>
        <p class="eyebrow">CONFIGURATION &amp; DATA</p>
        <h2>Your practice stays close</h2>
        <p class="small muted">Sprich saves progress in this browser. Use a progress export when you want to move it to another device; there is no account sync.</p>
      </div>
      <span id="local-first-status" class="settings-status" role="status">Local-first storage · ${ctx.store.persistent ? 'this browser' : 'this session'}</span>
    </section>

    <section class="settings-card card"><div class="card-title"><div><p class="eyebrow">FIRST STEPS</p><h2>Getting started</h2></div><span class="circle-icon">${icon('arrow')}</span></div>
      <p class="small muted">Reopen the short guide for the daily routine, free device audio, optional gateway setup, and the manual Gemini conversation.</p>
      <a class="btn secondary" href="#getting-started" aria-label="Open getting started guide">Open getting started guide ${icon('arrow')}</a>
    </section>

    <section class="settings-card card" id="audio-api-setup">
      <div class="card-title"><div><p class="eyebrow">OPTIONAL LOCAL GATEWAY</p><h2>Audio API setup</h2></div><span class="pill" id="audio-api-status">Needs check</span></div>
      <p class="small muted">Use this form to save a Groq key for transcription and an optional ElevenLabs key for natural speech. Device speech works without any key.</p>
      <div id="audio-api-content"><button class="btn" id="audio-api-check" type="button">Check gateway and show key fields</button><p class="fine">For safety, you must unlock AI Talk first. Keys are saved only by your local gateway and never enter progress backups.</p></div>
    </section>

    <div class="settings-layout">
      <div class="settings-primary">
        <section class="settings-card card">
          <div class="card-title"><div><p class="eyebrow">YOUR STORY</p><h2>Your real story</h2></div><span class="pill green">Saved on this device</span></div>
          <p class="small muted">Use your own facts. Short German phrases work well; you can leave fields empty.</p>
          <form id="profile-form" class="settings-form">
            <div class="form-grid">${PROFILE.map(([key, label, placeholder]) => `<label for="profile-${key}">${label}<input id="profile-${key}" type="text" name="${key}" maxlength="500" value="${esc(profile[key])}" placeholder="${esc(placeholder)}" ${key === 'name' ? 'autocomplete="given-name"' : 'autocomplete="off"'}></label>`).join('')}</div>
            <div class="form-actions btn-row"><button class="btn" type="submit">Save my profile ${icon('check')}</button><span class="fine">New missions use the updated profile.</span></div>
          </form>
        </section>

        <section class="settings-card card">
          <div class="card-title"><div><p class="eyebrow">PRACTICE CONTROLS</p><h2>Your practice preferences</h2></div><span class="pill">Stored with progress</span></div>
          <form id="preferences-form" class="settings-form">
            <div class="form-grid">
              <label>Daily practice goal<select name="dailyMinutes" aria-label="Daily practice goal">${PLAN_LENGTHS.map(value => `<option value="${value}" ${value === preferences.dailyMinutes ? 'selected' : ''}>${value} minutes</option>`).join('')}</select></label>
              <label>Appearance<select name="theme" aria-label="Appearance">${['system', 'light', 'dark'].map(theme => `<option value="${theme}" ${theme === preferences.theme ? 'selected' : ''}>${theme[0].toUpperCase() + theme.slice(1)}</option>`).join('')}</select><span class="field-hint">Light appearance keeps the saved palette for this device. That device-only choice is not in exports.</span></label>
              <label>Study day time zone<select name="timeZone" aria-label="Study day time zone">${zones.map(value => `<option value="${esc(value)}" ${value === preferences.timeZone ? 'selected' : ''}>${esc(value)}</option>`).join('')}</select><span class="field-hint">New activity uses this local day boundary.</span></label>
              <label>German voice<select name="voiceURI" id="german-voice" aria-label="German voice"><option value="">Automatic German voice</option></select><span class="field-hint" id="voice-status"></span></label>
              <label>Read-aloud speed<select name="speechRate" aria-label="Read-aloud speed">${[0.7, 0.8, 0.9, 1, 1.1].map(value => `<option value="${value}" ${Math.abs(value - preferences.speechRate) < .01 ? 'selected' : ''}>${value.toFixed(1)}× ${value === 0.9 ? '· comfortable starting point' : value === 1 ? '· voice default' : ''}</option>`).join('')}</select></label>
              <label>English support<select name="englishSupport" aria-label="English support"><option value="on-demand" ${preferences.englishSupport === 'on-demand' ? 'selected' : ''}>German first · English on demand</option><option value="always" ${preferences.englishSupport === 'always' ? 'selected' : ''}>Show German and English together</option></select><span class="field-hint">Answer models are always recorded as help.</span></label>
              <label>Learning path<select name="learningPath" aria-label="Learning path"><option value="starter" ${preferences.learningPath === 'starter' ? 'selected' : ''}>Start speaking · near-beginner</option><option value="work" ${preferences.learningPath === 'work' ? 'selected' : ''}>Workplace course · A2–B1</option></select><span class="field-hint">This choice sets the recommendations on Today.</span></label>
              <label>AI Talk voice<select name="aiVoice" aria-label="AI Talk voice"><option value="device" ${preferences.aiVoice === 'device' ? 'selected' : ''}>German device voice · free, no API key</option><option value="natural" ${preferences.aiVoice === 'natural' ? 'selected' : ''}>ElevenLabs Free · optional, limited allowance</option></select><span class="field-hint">Natural voice needs an unlocked gateway; unavailable speech falls back to your German device voice.</span></label>
              <label>Default AI level<select name="aiLevel" aria-label="Default AI level"><option value="A2" ${preferences.aiLevel === 'A2' ? 'selected' : ''}>A2</option><option value="B1" ${preferences.aiLevel === 'B1' ? 'selected' : ''}>B1</option></select></label>
              <div class="settings-inline-control"><button class="btn secondary" type="button" id="voice-test">${icon('volume')}Test selected voice</button><p class="fine">Uses the selected German device voice when available.</p></div>
              <div class="settings-inline-control"><button class="btn secondary" type="button" id="ai-voice-test">${icon('volume')}Test AI Talk voice</button><p class="fine">Device speech needs no API key. Natural speech uses the optional gateway.</p></div>
            </div>
            <div class="form-actions btn-row"><button class="btn" type="submit">Save preferences ${icon('check')}</button></div>
          </form>
        </section>

       <section class="settings-card card" id="backup-section">
          <div class="card-title"><div><p class="eyebrow">TRANSFER YOUR STATE</p><h2>Progress backups</h2></div><span class="pill">Account-free</span></div>
          <p class="small muted">Export a Sprich progress file, send it to another device, and import it there. Imports merge evidence by its stored IDs, so repeating a file does not duplicate attempts.</p>
          <div id="backup-composition" class="backup-composition">${backupComposition(state)}</div>
          <div class="transfer-grid">
            <div class="transfer-step"><span class="step-number">1</span><div><h3>Export from this device</h3><p class="fine">The JSON file contains the state listed above. Saved audio and cached voice clips remain here.</p></div><button class="btn secondary" id="export-progress">${icon('download')}Export progress</button></div>
            <div class="transfer-step"><span class="step-number">2</span><div><h3>Import on the other device</h3><p class="fine">Choose a progress export to merge it. Profile and preferences are optional.</p></div><label class="check-label"><input type="checkbox" id="import-profile">Also use the profile and preferences in the file</label><label class="file-button btn secondary">${icon('upload')}Choose progress file<input id="import-progress" type="file" accept=".json,application/json"></label><p class="fine" id="import-status" role="status">No file selected yet. Choose a Sprich progress export.</p></div>
          </div>
        </section>
      </div>

      <aside class="settings-secondary">
        <section class="settings-card card">
          <div class="card-title"><div><p class="eyebrow">LOCAL MEDIA</p><h2>Saved audio</h2></div><span class="circle-icon">${icon('mic')}</span></div>
          <p class="small muted" id="audio-size">Checking saved recordings…</p>
          <p class="fine">Download individual recordings during a session. Removing saved audio also clears cached AI voice clips; attempts and practice history stay in the progress state.</p>
          <button class="btn secondary" id="clear-audio">Remove saved audio</button>
        </section>

        <section class="settings-card card">
          <div class="card-title"><div><p class="eyebrow">INSTALLATION</p><h2>Practise on your phone</h2></div><span class="circle-icon">${icon('home')}</span></div>
          <p class="small muted">Open the HTTPS app in Chrome on Android, then use the browser's install or add-to-home-screen action. The core app can work offline after its files are cached.</p>
          <button class="btn secondary" id="install-app">Add to home screen ${icon('arrow')}</button>
          <p class="fine" id="install-status">If no prompt appears, use your browser menu. External resources and online speech services need a connection.</p>
        </section>
      </aside>
    </div>
  </div>`;

  let previousBackup = null;
  let previousBackupError = '';
  try { previousBackup = await ctx.store.previousBackup(); }
  catch { previousBackupError = 'An earlier backup is currently unavailable. Your current progress was not changed.'; }
  if (previousBackup || previousBackupError) {
    el.querySelector('.settings-page').insertAdjacentHTML('beforeend', `<section class="settings-card card settings-upgrade-backup"><div class="card-title"><div><p class="eyebrow">MIGRATION HISTORY</p><h2>Before this course update</h2></div><span class="pill amber">Earlier data</span></div>${previousBackup ? '<p class="small muted">Your earlier Sprich progress was backed up before its lesson snapshots were migrated.</p><button class="btn secondary" id="export-before-update">Download pre-upgrade backup</button>' : `<p class="small muted">${esc(previousBackupError)}</p>`}</section>`);
    safeAction(el.querySelector('#export-before-update'), () => downloadFile(previousBackup, 'sprich-before-course-update.json'), ctx.error);
  }
  if (state.legacy) {
    el.querySelector('.settings-page').insertAdjacentHTML('beforeend', `<section class="settings-card card settings-upgrade-backup"><div class="card-title"><div><p class="eyebrow">LEGACY RECOVERY</p><h2>Previous trainer backup</h2></div><span class="pill amber">Preserved</span></div><p class="small muted">Your previous trainer data was preserved when this version first opened. Its older grades and estimated minutes remain available as history rather than being treated as new learning evidence.</p><button class="btn secondary" id="export-legacy">${icon('download')}Download previous data</button></section>`);
  }

  function fillVoices() {
    const voices = germanVoices();
    const select = el.querySelector('#german-voice');
    if (!select) return;
    const selected = select.value || preferences.voiceURI;
    select.innerHTML = `<option value="">Automatic German voice</option>${voices.map(voice => `<option value="${esc(voice.voiceURI)}">${esc(voice.name)} · ${voice.localService ? 'device voice' : 'online voice'}</option>`).join('')}`;
    if (voices.some(voice => voice.voiceURI === selected)) select.value = selected;
    el.querySelector('#voice-status').textContent = voices.length
      ? `${voices.length} German ${voices.length === 1 ? 'voice' : 'voices'} available.`
      : 'No German voice is available. Add German in your device speech settings, or use the reading alternative.';
  }
  fillVoices();
  globalThis.speechSynthesis?.addEventListener('voiceschanged', fillVoices);

  async function loadAudioSetup() {
    const host = el.querySelector('#audio-api-content');
    const badge = el.querySelector('#audio-api-status');
    if (!host || !badge) return;
    try {
      const status = await (ctx.aiClient ?? aiClient).status({ signal: ctx.signal });
      if (ctx.signal?.aborted) return;
      if (!status.audioSetupAvailable) {
        badge.textContent = 'Server-managed';
        host.innerHTML = '<p class="small muted">This gateway does not accept provider keys from the browser. Use the host’s secret manager. German device speech and Gemini Companion need no key.</p><a class="btn secondary" href="#ai">Open AI Talk</a>';
        return;
      }
      if (!status.authenticated) {
        badge.textContent = 'Unlock first';
        host.innerHTML = '<p class="small muted">Unlock the private local gateway in AI Talk, then return here. The key is sent only to that same-origin gateway and is never added to progress exports.</p><a class="btn secondary" href="#ai">Unlock AI Talk</a>';
        return;
      }
      badge.textContent = status.groqReady || status.naturalVoiceConfigured ? 'Configured' : 'Optional';
      host.innerHTML = `<p class="small muted">Save provider credentials on the local gateway for AI Talk transcription and optional natural speech. The browser never receives them back, and they are not stored in IndexedDB or progress backups.</p>
        <form id="audio-api-form" class="settings-form"><div class="form-grid">
          <label>Groq API key<input type="password" name="groqApiKey" autocomplete="off" placeholder="Paste only on your own local gateway"></label>
          <label>ElevenLabs API key <span class="fine">optional</span><input type="password" name="elevenLabsApiKey" autocomplete="off" placeholder="For natural AI Talk voice"></label>
          <label>ElevenLabs voice ID <span class="fine">optional</span><input type="text" name="elevenLabsVoiceId" autocomplete="off" placeholder="A default or Voice Design voice ID"></label>
          <label class="check-label"><input type="checkbox" name="groqFreeTierConfirmed"> <span>I confirm this is a Groq Free account with no paid upgrade.</span></label>
        </div><div class="form-actions btn-row"><button class="btn" type="submit">Save audio API settings</button><span class="fine" id="audio-api-form-status" role="status"></span></div></form>`;
      host.querySelector('#audio-api-form').addEventListener('submit', async event => {
        event.preventDefault();
        const formElement = event.currentTarget;
        const form = new FormData(formElement);
        const button = event.submitter;
        button.disabled = true;
        try {
          await (ctx.aiClient ?? aiClient).setupAudio({
            groqApiKey: String(form.get('groqApiKey') ?? ''),
            groqFreeTierConfirmed: form.get('groqFreeTierConfirmed') === 'on',
            elevenLabsApiKey: String(form.get('elevenLabsApiKey') ?? ''),
            elevenLabsVoiceId: String(form.get('elevenLabsVoiceId') ?? ''),
          }, { signal: ctx.signal });
          formElement.reset();
          host.querySelector('#audio-api-form-status').textContent = 'Audio API settings saved locally. Keys are not in this browser or its backups.';
          badge.textContent = 'Saved locally';
        } catch (error) { ctx.error(error.message); }
        finally { if (button?.isConnected) button.disabled = false; }
      });
    } catch {
      if (!ctx.signal?.aborted) {
        badge.textContent = 'Not connected';
        host.innerHTML = `<p class="small muted">The local gateway is not available. Device speech still works without it. <a href="#ai">Open AI Talk</a> to check the connection.</p>`;
      }
    }
  }
  el.querySelector('#audio-api-check').addEventListener('click', () => { void loadAudioSetup(); });

  async function savePreferences() {
    const form = new FormData(el.querySelector('#preferences-form'));
    const next = {
      dailyMinutes: Number(form.get('dailyMinutes')),
      theme: form.get('theme'),
      timeZone: form.get('timeZone'),
      voiceURI: form.get('voiceURI'),
      speechRate: Number(form.get('speechRate')),
      englishSupport: form.get('englishSupport'),
      aiVoice: form.get('aiVoice'),
      aiLevel: form.get('aiLevel'),
      learningPath: form.get('learningPath'),
    };
    if (!PLAN_LENGTHS.includes(next.dailyMinutes) || !validTimeZone(next.timeZone)) throw new Error('Choose a valid daily goal and time zone.');
    await ctx.store.update(saved => { saved.preferences = { ...saved.preferences, ...next }; });
    ctx.applyTheme();
  }

  el.querySelector('#profile-form').addEventListener('submit', async event => {
    event.preventDefault();
    const button = event.submitter;
    button.disabled = true;
    try {
      const form = new FormData(event.currentTarget);
      await ctx.store.update(saved => { saved.profile = Object.fromEntries(PROFILE_FIELDS.map(field => [field, String(form.get(field) ?? '').trim().slice(0, 500)])); });
      ctx.notify('Your profile is saved. New missions will use these facts.');
    } catch (error) { ctx.error(error.message); }
    finally { button.disabled = false; }
  });
  el.querySelector('#preferences-form').addEventListener('submit', async event => {
    event.preventDefault();
    try { await savePreferences(); ctx.notify('Preferences saved.'); }
    catch (error) { ctx.error(error.message); }
  });
  el.querySelector('#voice-test').addEventListener('click', async () => {
    try { aiSpeech.stop(); await savePreferences(); if (!ctx.signal?.aborted) await ctx.play('Guten Tag! Ich möchte praktische Erfahrung sammeln. Könnten Sie mir etwas über die Stelle erzählen?', el.querySelector('#voice-test')); }
    catch (error) { ctx.error(error.message); }
  });
  el.querySelector('#ai-voice-test').addEventListener('click', async () => {
    const button = el.querySelector('#ai-voice-test');
    if (button.dataset.playing === 'true') { aiSpeech.stop(); return; }
    try { await savePreferences(); await aiSpeech.play('Guten Tag! An welchen Tagen können Sie arbeiten?', button); }
    catch (error) { ctx.error(error.message); }
  });
  safeAction(el.querySelector('#export-progress'), async () => {
    downloadFile(await ctx.store.export(), `sprich-progress-${new Date().toISOString().slice(0, 10)}.json`);
    ctx.notify('Progress exported. Keep this file as a backup or import it on your other device.');
  }, ctx.error);
  el.querySelector('#import-progress').addEventListener('change', async event => {
    const file = event.target.files?.[0];
    if (!file) return;
    const status = el.querySelector('#import-status');
    try {
      if (file.size > 25_000_000) throw new Error('Choose a progress file smaller than 25 MB.');
      status.textContent = 'Checking and merging progress…';
      await ctx.store.import(await file.text(), el.querySelector('#import-profile').checked);
      ctx.applyTheme();
      ctx.notify('Progress merged. Existing attempts were counted only once.');
      await ctx.refresh();
    } catch (error) { status.textContent = error.message; ctx.error(error.message); }
  });
  const showAudioSize = async () => {
    try {
      const size = await ctx.store.recordingSize();
      const target = el.querySelector('#audio-size');
      if (target) target.textContent = size ? `${formatBytes(size)} of saved audio on this device.` : 'No saved audio on this device yet.';
    } catch {
      const target = el.querySelector('#audio-size');
      if (target) target.textContent = 'Saved audio size is currently unavailable.';
    }
  };
  await showAudioSize();
  safeAction(el.querySelector('#clear-audio'), async () => {
    if (!confirm('Remove all saved audio from this device? Your attempts and practice history will be kept.')) return;
    await ctx.store.deleteRecordings(); await showAudioSize(); ctx.notify('Saved audio removed.');
  }, ctx.error);
  safeAction(el.querySelector('#install-app'), async () => {
    await ctx.install();
    el.querySelector('#install-status').textContent = 'If no install prompt appeared, use your browser menu to add Sprich to your home screen.';
  }, ctx.error);
  safeAction(el.querySelector('#export-legacy'), () => downloadFile(state.legacy.raw, 'deutsch-trainer-legacy.json'), ctx.error);
  return () => { aiSpeech.dispose(); globalThis.speechSynthesis?.removeEventListener('voiceschanged', fillVoices); };
}
