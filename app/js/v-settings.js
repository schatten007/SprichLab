import { PROFILE_FIELDS, PLAN_LENGTHS, validTimeZone } from './model.js';
import { germanVoices } from './tts.js';
import { aiClient } from './ai-gateway.js';
import { createAISpeech } from './ai-speech.js';
import { esc, icon, pageHeading, safeAction, downloadFile } from './ui.js';

export const LIGHT_PALETTES = ['paper', 'contrast'];
function readPalette() {
  try { const saved = localStorage.getItem('sprich.palette'); return LIGHT_PALETTES.includes(saved) ? saved : 'paper'; }
  catch { return 'paper'; }
}

export async function render(el, ctx) {
  const state = ctx.store.state;
  const profile = state.profile;
  const preferences = state.preferences;
  const aiSpeech = createAISpeech(ctx, ctx.aiClient ?? aiClient);
  const fields = [
    ['name', 'What should we call you?', 'Your first name'],
    ['studies', 'Your studies', 'e.g. Informatik, drittes Semester'],
    ['experience', 'One real skill or experience', 'e.g. Erfahrung mit Excel; ein Gruppenprojekt an der Uni'],
    ['availability', 'Your availability', 'e.g. 16 Stunden pro Woche, montags und donnerstags'],
    ['start', 'When could you start?', 'e.g. ab November'],
    ['motivation', 'What do you want to learn or contribute?', 'e.g. praktische Erfahrung sammeln und im Team arbeiten'],
  ];
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const zones = [...new Set([preferences.timeZone, 'Europe/Berlin', zone, 'UTC'])].filter(Boolean);
  el.innerHTML = `${pageHeading('YOUR OWN LEARNING SPACE', 'Make it fit your life.', 'Keep your practice personal, choose a comfortable voice, and carry your progress between devices.')}
    <section class="card"><div class="card-title"><div><h2>Your real story</h2><p class="fine">Use your own facts. Short German phrases work well; you can leave fields empty.</p></div><span class="pill green">Saved on this device</span></div><form id="profile-form"><div class="form-grid">${fields.map(([key, label, placeholder]) => `<label>${label}<input type="text" name="${key}" maxlength="500" value="${esc(profile[key])}" placeholder="${esc(placeholder)}" ${key === 'name' ? 'autocomplete="given-name"' : 'autocomplete="off"'}></label>`).join('')}</div><div class="form-actions btn-row"><button class="btn" type="submit">Save my profile ${icon('check')}</button><span class="fine">New missions use the updated profile.</span></div></form></section>
    <section class="card section-gap"><div class="card-title"><h2>Your practice preferences</h2></div><form id="preferences-form"><div class="form-grid"><label>Daily practice goal<select name="dailyMinutes">${PLAN_LENGTHS.map(value => `<option value="${value}" ${value === preferences.dailyMinutes ? 'selected' : ''}>${value} minutes</option>`).join('')}</select></label><label>Appearance<select name="theme">${['system', 'light', 'dark'].map(theme => `<option value="${theme}" ${theme === preferences.theme ? 'selected' : ''}>${theme[0].toUpperCase() + theme.slice(1)}</option>`).join('')}</select></label><label>Light theme<select name="palette">${[['paper', 'Paper · warm and low glare'], ['contrast', 'Contrast · strongest legibility']].map(([value, label]) => `<option value="${value}" ${value === readPalette() ? 'selected' : ''}>${label}</option>`).join('')}</select><span class="field-hint">Chosen whenever a light theme is showing. Saved for this device only, so another browser can differ. Contrast also removes background texture.</span></label><label>Study day time zone<select name="timeZone">${zones.map(value => `<option ${value === preferences.timeZone ? 'selected' : ''}>${esc(value)}</option>`).join('')}</select><span class="field-hint">New activity uses this local day boundary.</span></label><label>German voice<select name="voiceURI" id="german-voice"><option value="">Automatic German voice</option></select></label><label>Read-aloud speed<select name="speechRate">${[0.7, 0.8, 0.9, 1, 1.1].map(value => `<option value="${value}" ${Math.abs(value - preferences.speechRate) < .01 ? 'selected' : ''}>${value.toFixed(1)}× ${value === 0.9 ? '· comfortable starting point' : value === 1 ? '· voice default' : ''}</option>`).join('')}</select></label><div class="voice-test"><button class="btn secondary" type="button" id="voice-test">${icon('volume')}Test selected voice</button><p class="fine" id="voice-status"></p></div></div><div class="form-actions"><button class="btn" type="submit">Save preferences ${icon('check')}</button></div></form><div class="divider"></div><p class="fine">Recordings are saved locally. Optional browser dictation may send audio to your browser provider and usually needs internet. A transcript is an aid, not a pronunciation score. German voice availability depends on your device.</p></section>
    <section class="card section-gap"><div class="card-title"><h2>Move your progress between devices</h2><span class="pill">Account-free</span></div><p class="small muted">Export a progress file, send it to your other device, and import it there. Import merges attempts by ID, so importing the same file twice does not duplicate your results.</p><div class="transfer-grid"><div><h3>1. Export from this device</h3><p class="fine">Includes your profile, attempts, review schedule evidence, and unfinished sessions. Audio files stay on the device where they were recorded.</p><button class="btn secondary" id="export-progress">${icon('download')}Export progress</button></div><div><h3>2. Import on the other device</h3><label class="check-label"><input type="checkbox" id="import-profile">Also use the profile and preferences in the file</label><label class="file-button btn secondary">${icon('upload')}Choose progress file<input id="import-progress" type="file" accept=".json,application/json"></label><p class="fine" id="import-status" role="status"></p></div></div></section>
    <div class="grid-2 section-gap"><section class="card"><div class="card-title"><h2>Saved audio</h2><span class="circle-icon">${icon('mic')}</span></div><p class="small muted" id="audio-size">Checking saved recordings…</p><p class="fine">You can download individual recordings during a session. Removing audio does not remove your attempt history.</p><button class="btn secondary" id="clear-audio">Remove saved audio</button></section><section class="card"><div class="card-title"><h2>Practise on your phone</h2><span class="circle-icon">${icon('home')}</span></div><p class="small muted">Open the HTTPS app in Chrome on Android, then add it to your home screen. Core missions work offline after the first complete load.</p><button class="btn secondary" id="install-app">Add to home screen ${icon('arrow')}</button><p class="fine section-gap">External resources and online speech services need a connection. Core exercises, recording, and self-assessment work without them.</p></section></div>
    ${state.legacy ? `<section class="card section-gap"><h2>Previous trainer backup</h2><p class="small muted section-gap">Your previous trainer data was preserved when this version first opened. Its automatic grades and estimated minutes are kept as history rather than included in the new metrics.</p><button class="btn secondary" id="export-legacy">${icon('download')}Download previous data</button></section>` : ''}`;

  el.querySelector('#preferences-form .form-grid').insertAdjacentHTML('beforeend', `<label>English support<select name="englishSupport"><option value="on-demand" ${preferences.englishSupport === 'on-demand' ? 'selected' : ''}>German first · English on demand</option><option value="always" ${preferences.englishSupport === 'always' ? 'selected' : ''}>Show German and English together</option></select><span class="field-hint">Answer models are always recorded as help.</span></label>`);
  el.querySelector('#preferences-form .form-grid').insertAdjacentHTML('beforeend', `<label>Learning path<select name="learningPath" aria-label="Learning path"><option value="starter" ${preferences.learningPath === 'starter' ? 'selected' : ''}>Start speaking · near-beginner</option><option value="work" ${preferences.learningPath === 'work' ? 'selected' : ''}>Workplace course · A2–B1</option></select><span class="field-hint">Beginner lessons always show English support. This choice sets the recommendations on Today.</span></label>`);
  el.querySelector('#preferences-form .form-grid').insertAdjacentHTML('beforeend', `<label>AI Talk voice<select name="aiVoice"><option value="device" ${preferences.aiVoice === 'device' ? 'selected' : ''}>German device voice · free, no API key</option><option value="natural" ${preferences.aiVoice === 'natural' ? 'selected' : ''}>ElevenLabs Free · optional, limited allowance</option></select><span class="field-hint">Device voice is the default. Natural voice needs an unlocked gateway with an ElevenLabs Free key and voice ID; unavailable speech falls back to your German device voice.</span></label>
    <label>Default AI level<select name="aiLevel"><option value="A2" ${preferences.aiLevel === 'A2' ? 'selected' : ''}>A2</option><option value="B1" ${preferences.aiLevel === 'B1' ? 'selected' : ''}>B1</option></select></label>
    <div class="voice-test"><button class="btn secondary" type="button" id="ai-voice-test">${icon('volume')}Test AI Talk voice</button><p class="fine">Natural speech is generated by <a href="https://elevenlabs.io/" target="_blank" rel="noopener noreferrer">ElevenLabs</a>. Replays use a local audio cache.</p></div>`);
  el.querySelector('#clear-audio').previousElementSibling.textContent = 'Download individual recordings during a session. Natural speech is cached separately for up to 30 days / 60 clips. Removing saved audio clears both, while keeping practice history.';
  el.querySelector('#export-progress').parentElement.querySelector('.fine').textContent = 'Includes your profile, beginner lessons, vocabulary reviews and saved words, Gemini takeaways, AI conversations, and workplace progress. Audio and downloaded course packs stay on this device.';
  const previousBackup = await ctx.store.previousBackup();
  if (previousBackup) {
    el.insertAdjacentHTML('beforeend', '<section class="card section-gap"><h2>Before this course update</h2><p class="fine section-gap">Your earlier Sprich progress was backed up before its lesson snapshots were migrated.</p><button class="btn secondary" id="export-before-update">Download pre-upgrade backup</button></section>');
    safeAction(el.querySelector('#export-before-update'), () => downloadFile(previousBackup, 'sprich-before-course-update.json'), ctx.error);
  }

  function fillVoices() {
    const voices = germanVoices();
    const select = el.querySelector('#german-voice');
    if (!select) return;
    const selected = select.value || preferences.voiceURI;
    select.innerHTML = `<option value="">Automatic German voice</option>${voices.map(voice => `<option value="${esc(voice.voiceURI)}">${esc(voice.name)} · ${voice.localService ? 'device voice' : 'online voice'}</option>`).join('')}`;
    if (voices.some(voice => voice.voiceURI === selected)) select.value = selected;
    el.querySelector('#voice-status').textContent = voices.length ? `${voices.length} German ${voices.length === 1 ? 'voice' : 'voices'} available.` : 'Add a German speech voice in your device language settings if none appears.';
  }
  fillVoices();
  globalThis.speechSynthesis?.addEventListener('voiceschanged', fillVoices);

  async function savePreferences() {
    const form = new FormData(el.querySelector('#preferences-form'));
    const next = { dailyMinutes: Number(form.get('dailyMinutes')), theme: form.get('theme'), timeZone: form.get('timeZone'), voiceURI: form.get('voiceURI'), speechRate: Number(form.get('speechRate')), englishSupport: form.get('englishSupport'), aiVoice: form.get('aiVoice'), aiLevel: form.get('aiLevel'), learningPath: form.get('learningPath') };
    if (!PLAN_LENGTHS.includes(next.dailyMinutes) || !validTimeZone(next.timeZone)) throw new Error('Choose a valid daily goal and time zone.');
    await ctx.store.update(saved => { saved.preferences = { ...saved.preferences, ...next }; });
    // The light palette is device-local, so it never travels in a progress backup.
    if (LIGHT_PALETTES.includes(form.get('palette'))) {
      try { localStorage.setItem('sprich.palette', form.get('palette')); } catch { /* Appearance still applies this session. */ }
    }
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
  safeAction(el.querySelector('#export-progress'), async () => { downloadFile(await ctx.store.export(), `sprich-progress-${new Date().toISOString().slice(0, 10)}.json`); ctx.notify('Progress exported. Keep this file as a backup or import it on your other device.'); }, ctx.error);
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
    try { const size = await ctx.store.recordingSize(); const target = el.querySelector('#audio-size'); if (target) target.textContent = `${(size / 1_000_000).toFixed(1)} MB of recordings on this device.`; }
    catch { const target = el.querySelector('#audio-size'); if (target) target.textContent = 'Saved audio size is currently unavailable.'; }
  };
  await showAudioSize();
  safeAction(el.querySelector('#clear-audio'), async () => {
    if (!confirm('Remove all saved audio from this device? Your attempts and practice history will be kept.')) return;
    await ctx.store.deleteRecordings(); await showAudioSize(); ctx.notify('Saved audio removed.');
  }, ctx.error);
  safeAction(el.querySelector('#install-app'), () => ctx.install(), ctx.error);
  safeAction(el.querySelector('#export-legacy'), () => downloadFile(state.legacy.raw, 'deutsch-trainer-legacy.json'), ctx.error);
  return () => { aiSpeech.dispose(); globalThis.speechSynthesis?.removeEventListener('voiceschanged', fillVoices); };
}
