import { MISSIONS, missionById } from '../data/missions.js';
import { createAIConversation, aiPayload, aiHistory, activeAITurns, newAIDraft } from './ai-state.js';
import { STARTER_LESSONS } from '../data/starter-catalog.js';
import { geminiSource } from './v-gemini.js';
import { mountGeminiExport } from './gemini-export.js';
import { mountCompanionReflection } from './starter-ui.js';
import { createRecorder } from './recorder.js';
import { aiClient, isCancelled } from './ai-gateway.js';
import { createAISpeech } from './ai-speech.js';
import { esc, icon, pageHeading, safeAction, englishMeaning, duration } from './ui.js';

const PROFILE_LABELS = { studies: 'Studies', experience: 'Experience', availability: 'Availability', start: 'Earliest start', motivation: 'Motivation', name: 'Name' };
const operationLabel = { rephrase: 'Ask it more simply', hint: 'Give me a hint', reply: 'Send my answer' };
const always = state => state.preferences.englishSupport === 'always';

function selectedFields(state) {
  return ['studies', 'experience', 'availability'].filter(field => state.profile[field]);
}
function profileSummary(state) {
  const fields = selectedFields(state);
  if (!fields.length) return '<p class="fine">No profile facts selected yet. Open Settings and add your studies or experience so replies stay consistent with you.</p>';
  return `<dl class="fact-list">${fields.map(field => `<dt>${esc(PROFILE_LABELS[field])}</dt><dd lang="de">${esc(state.profile[field])}</dd>`).join('')}</dl>
    <p class="fine">These profile facts accompany the answers you choose to send. The name field is excluded; names you write inside an answer or selected fact are still included.</p>`;
}

function statusLine(status) {
  if (!status) return '<p class="fine">Checking the AI connection…</p>';
  const mode = status.testMode ? '<span class="pill amber">Test provider · no real AI</span>'
    : status.groqReady ? '<span class="pill">Groq configured · use Check models</span>' : '<span class="pill amber">Groq setup incomplete</span>';
  const missing = status.missing?.length ? `<ul class="setup-list">${status.missing.map(item => `<li>${esc(item)}</li>`).join('')}</ul>` : '';
  return `<div class="pills">${mode}${status.configured ? '<span class="pill">Gateway ready</span>' : '<span class="pill amber">Setup incomplete</span>'}${status.authenticated ? '<span class="pill green">Unlocked</span>' : '<span class="pill">Locked</span>'}</div>${missing}`;
}

function usageCard(usage, status) {
  if (!usage) return '';
  const bar = (label, used, limit) => `<div class="usage-row"><span>${esc(label)}</span><span>${used} / ${limit}</span></div>`;
  return `<div class="usage-block">${bar('Speaking turns today', usage.turnsUsed, status.limits.dailyTurns)}${bar('Reviews today', usage.reviewsUsed, status.limits.dailyReviews)}<p class="fine">Counts reset at 00:00 UTC. These are this app's free-use guards, not a bill.</p></div>`;
}

/** A failed send keeps its request ID when it may already have reached the gateway. */
function rotate(draft, status, error, operation = draft.operation) {
  return { ...newAIDraft(draft.createdAt), operation, text: draft.text, recordingMs: draft.recordingMs,
    audioKey: draft.audioKey, supersedes: draft.supersedes, status, error };
}
function uncertainSend(error) {
  return ['network', 'timeout', 'uncertain', 'pending', 'provider_timeout'].includes(error?.code)
    || error?.status === 504 || (error?.status === 409 && error?.code !== 'request_changed');
}
function draftAfterError(draft, error) {
  const message = String(error?.message ?? 'The AI connection could not finish. Your draft is still available.');
  if (uncertainSend(error)) return { ...draft, status: 'sending', error: message };
  if (error?.code === 'request_changed') return rotate(draft, 'error', message, 'reply');
  return rotate(draft, 'error', message, 'reply');
}
/** Recovery knows the outcome, so an unresolved request can always be started again. */
function draftAfterRecovery(draft, error) {
  const message = String(error?.message ?? 'The AI connection could not finish. Your draft is still available.');
  if (error?.code === 'request_missing') return rotate(draft, 'draft', 'That answer never reached the partner. Send it again.', 'reply');
  if (['network', 'timeout'].includes(error?.code)) return { ...draft, status: 'sending', error: 'Still checking for your reply. Reconnect, then choose “Check for my reply”.' };
  if (uncertainSend(error)) return rotate(draft, 'error', 'We could not confirm that your last answer reached the partner, so nothing new was generated. Send it again when you are ready to start a fresh attempt.');
  return rotate(draft, 'error', message, 'reply');
}
function draftAfterReceipt(draft, result) {
  if (result.inputStatus === 'unclear') {
    return { ...rotate(draft, 'draft', 'We could not make out a German answer. Try a shorter sentence, or type your reply instead.', 'reply'),
      recordingMs: 0, audioKey: '' };
  }
  return draft;
}

export async function renderLobby(el, ctx) {
  const client = ctx.aiClient ?? aiClient;
  const state = ctx.store.state;
  let status = null;
  let usage = null;
  let setupError = '';
  let loading = true;
  let refreshing = false;
  let unlocking = false;
  let alive = true;

  el.innerHTML = `${pageHeading('AI TALK', 'A private German conversation that waits for you.', 'Optional, unscored roleplay. Answers you choose to send go through your gateway to its provider; conversations are saved on this device.')}
    <div class="practice-toolbar"><span class="pill green">Push to talk · 60 seconds · send only when you choose</span><a class="inline-link" href="#practice">Offline missions ${icon('messages')}</a></div>
    <div class="grid-2 section-gap"><section class="card" id="ai-setup" aria-live="polite"></section><section class="card" id="ai-start"></section></div>
    <div id="ai-conversations"></div>
    <section class="card section-gap" id="ai-companion"></section>`;

  function setupCard() {
    if (!alive) return;
    const host = el.querySelector('#ai-setup');
    if (!status) {
      host.innerHTML = `<p class="eyebrow">PRIVATE CONNECTION</p><h2>${loading ? 'Checking the gateway…' : 'AI gateway unavailable'}</h2>
        ${setupError ? `<p class="small section-gap" role="alert">${esc(setupError)}</p>` : ''}
        <p class="fine section-gap">Start <code>npm run ai:gateway</code> in a second terminal, then check again. German device voices and Gemini Companion need no gateway.</p>
        <button class="btn secondary" id="ai-retry" ${loading ? 'disabled' : ''}>Check connection again</button>`;
      safeAction(host.querySelector('#ai-retry'), refresh, ctx.error);
      return;
    }
    const missingSetup = !status.configured || !status.groqReady;
    host.innerHTML = `<div class="card-title"><div><p class="eyebrow">PRIVATE CONNECTION</p><h2>Your own AI connection</h2></div></div>
      ${statusLine(status)}
      <p class="small">${!missingSetup
        ? 'Provider keys stay on your server. This app only sends the words you chose to send.'
        : 'The gateway needs an owner access code, a request database, and a confirmed Groq Free key before AI Talk opens. Everything else in Sprich works without it.'}</p>
      ${setupError ? `<div class="callout error" role="alert">${esc(setupError)}</div>` : ''}
      ${status.authenticated
        ? `<div class="btn-row"><button class="btn secondary" id="ai-lock">Lock AI Talk</button><button class="btn secondary" id="ai-capabilities" ${status.groqReady ? '' : 'disabled'}>Check models</button></div>`
        : `<form id="ai-unlock" class="inline-form"><label for="ai-token">Owner access code<input id="ai-token" name="token" type="password" autocomplete="one-time-code" minlength="43" maxlength="43" required placeholder="43 characters" ${status.configured ? '' : 'disabled'}></label><button class="btn" type="submit" ${status.configured ? '' : 'disabled'}>Unlock AI Talk</button></form><p class="fine">The generated owner code is sent only to this gateway to unlock it. Provider API keys stay on the server. No Sprich account is needed.</p>`}
      <p class="fine section-gap">${status.naturalVoiceConfigured ? 'ElevenLabs is configured; its Free tier and remaining credits are checked before each new synthesis.' : 'German device speech needs no TTS API key. Add a German voice in your device settings if needed.'} <a href="#settings">Voice settings</a></p>
      ${status.authenticated ? usageCard(usage, status) : ''}
      ${missingSetup ? '<p class="fine">Gemini Companion below needs no gateway at all.</p>' : ''}
      <button class="text-button" id="ai-retry" ${loading ? 'disabled' : ''}>Check connection again</button>`;
    safeAction(host.querySelector('#ai-retry'), refresh, ctx.error);
    host.querySelector('#ai-unlock')?.addEventListener('submit', async event => {
      event.preventDefault();
      if (unlocking || !status.configured) return;
      const token = new FormData(event.target).get('token').trim();
      const button = event.submitter;
      unlocking = true;
      if (button) button.disabled = true;
      try {
        await client.unlock(token, { signal: ctx.signal });
        setupError = '';
        await refresh();
      } catch (error) { if (!isCancelled(error)) { setupError = error.message; setupCard(); } }
      finally { unlocking = false; if (button?.isConnected) button.disabled = false; }
    });
    safeAction(host.querySelector('#ai-lock'), async () => { await client.lock({ signal: ctx.signal }); await refresh(); }, message => { setupError = message; setupCard(); });
    safeAction(host.querySelector('#ai-capabilities'), async () => {
      const result = await client.capabilities({ signal: ctx.signal });
      if (!alive) return;
      const available = result.chatAvailable && result.transcriptionAvailable;
      ctx.notify(available ? 'Both required models are available on your key.' : 'A required model is missing from your key.', !available);
    }, message => { setupError = message; setupCard(); });
  }

  function startCard() {
    const current = state.preferences.aiLevel;
    el.querySelector('#ai-start').innerHTML = `<div class="card-title"><div><p class="eyebrow">CHOOSE A SITUATION</p><h2>Start a conversation</h2></div><span class="pill">${esc(current)}</span></div>
      <div class="form-grid"><label>Situation<select id="ai-mission">${MISSIONS.map(mission => `<option value="${mission.id}">${esc(mission.shortTitle)}</option>`).join('')}</select></label>
      <label>Level<select id="ai-level">${['A2', 'B1'].map(level => `<option value="${level}" ${level === current ? 'selected' : ''}>${level} · ${level === 'A2' ? 'short, supported answers' : 'longer, more detail'}</option>`).join('')}</select></label></div>
      <p class="fine">What the partner may know about you:</p>${profileSummary(state)}
      <div class="btn-row"><button class="btn" id="ai-start-button" ${status?.configured && status?.groqReady && status?.authenticated ? '' : 'disabled'}>Start conversation ${icon('arrow')}</button></div>`;
    safeAction(el.querySelector('#ai-start-button'), async () => {
      if (!status?.authenticated || !status?.groqReady) throw new Error('Configure and unlock the private AI connection first, or use Gemini Companion below.');
      const missionId = el.querySelector('#ai-mission').value;
      const level = el.querySelector('#ai-level').value;
      const session = createAIConversation(ctx.store.state, missionId, { fields: selectedFields(state), level });
      await ctx.store.addAIConversation(session);
      ctx.go(`ai/session/${session.id}`);
    }, ctx.error);
  }

  function conversations() {
    const host = el.querySelector('#ai-conversations');
    const sessions = [...state.aiSessions].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 8);
    if (!sessions.length) { host.innerHTML = ''; return; }
    host.innerHTML = `<section class="card section-gap"><div class="card-title"><div><p class="eyebrow">SAVED ON THIS DEVICE</p><h2>Continue a conversation</h2></div></div>
      <div class="stack-list">${sessions.map(session => {
        const mission = missionById(session.missionId);
        const turns = activeAITurns(session).length;
        return `<div class="stack-row"><span><strong>${esc(mission?.shortTitle ?? session.missionId)}</strong><small>${turns} exchanges · ${esc(session.level)} · ${session.review ? 'reviewed' : session.endedAt ? 'closed' : 'in progress'}</small></span><a class="btn secondary small-btn" href="#ai/session/${session.id}">Open ${icon('arrow')}</a></div>`;
      }).join('')}</div></section>`;
  }

  function companion() {
    const host = el.querySelector('#ai-companion');
    host.innerHTML = `<div class="card-title"><div><p class="eyebrow">NO GATEWAY NEEDED</p><h2>Gemini Companion on your phone</h2></div><span class="pill green">Uses your own Gemini app</span></div>
      <p class="small">Choose the lesson you want to practise. Its vocabulary, examples, and roleplay instructions travel together.</p>
      <label>Lesson for Gemini<select id="companion-lesson" aria-label="Lesson for Gemini"><optgroup label="Start speaking">${STARTER_LESSONS.map(lesson => `<option value="${lesson.id}">${lesson.number}. ${esc(lesson.title)}</option>`).join('')}</optgroup><optgroup label="Workplace course">${MISSIONS.map(mission => `<option value="${mission.id}">${esc(mission.shortTitle)}</option>`).join('')}</optgroup></select></label>
      <div class="section-gap" id="companion-pack"></div><div class="section-gap" id="companion-note"></div>`;
    const select = host.querySelector('#companion-lesson');
    if (state.preferences.learningPath === 'work') select.value = MISSIONS[0].id;
    let selection = 0;
    const show = async () => {
      const current = ++selection; const id = select.value;
      try {
        const source = await geminiSource(ctx, id);
        if (!alive || current !== selection) return;
        mountGeminiExport(host.querySelector('#companion-pack'), ctx, source, { open: true });
        mountCompanionReflection(host.querySelector('#companion-note'), ctx, id);
      } catch (error) { if (alive && current === selection) host.querySelector('#companion-pack').innerHTML = `<p class="callout" role="alert">${esc(error.message)}</p>`; }
    };
    select.addEventListener('change', () => { void show(); });
    void show();
  }

  async function refresh() {
    if (refreshing || !alive) return;
    refreshing = true; loading = true; setupError = ''; setupCard();
    try {
      status = await client.status({ signal: ctx.signal });
      usage = status.authenticated ? await client.usage({ signal: ctx.signal }).catch(() => null) : null;
    } catch (error) {
      if (!isCancelled(error)) { setupError = error.message; status = null; usage = null; }
    } finally {
      loading = false; refreshing = false;
      if (alive) { setupCard(); startCard(); conversations(); }
    }
  }
  setupCard(); startCard(); conversations(); companion();
  void refresh();
  return () => { alive = false; ctx.speech.stop(); };
}

export async function renderSession(el, ctx, id) {
  const client = ctx.aiClient ?? aiClient;
  let session = ctx.store.state.aiSessions.find(item => item.id === id);
  if (!session) throw new Error('This AI conversation is not on this device. Open AI Talk to start a new one.');
  let sendError = '';
  let recorder = null;
  let audioUrl = null;
  let busy = false;
  let alive = true;

  const mission = missionById(session.missionId);
  if (!mission) throw new Error('This conversation uses a mission that is no longer available.');
  const aiSpeech = createAISpeech(ctx, client);

  el.innerHTML = `<a class="inline-link" href="#ai">${icon('back')}AI Talk</a>
    <div id="ai-session"></div>`;

  function transcriptCard() {
    const turns = activeAITurns(session);
    return `<section class="card transcript-card"><div class="card-title"><div><p class="eyebrow">${esc(mission.shortTitle)}</p><h2>${esc(session.context.title)}</h2></div><span class="pill">${esc(session.level)} · ${esc(session.context.register)}</span></div>
      <p class="fine">${esc(session.context.goal)}</p>
      <div class="transcript" role="log" aria-live="polite">
        <div class="transcript-line assistant"><span class="transcript-who">Partner</span><p lang="de">${esc(session.context.openingDe)}</p>${englishMeaning(session.context.openingEn, { always: always(ctx.store.state) })}</div>
        ${turns.map(turn => `${turn.transcript ? `<div class="transcript-line you"><span class="transcript-who">You</span><p lang="de">${esc(turn.transcript)}</p></div>` : ''}
          <div class="transcript-line assistant"><span class="transcript-who">Partner</span><p lang="de">${esc(turn.replyDe)}</p>${englishMeaning(turn.meaningEn, { always: always(ctx.store.state) })}</div>`).join('')}
      </div>
      ${sendError ? `<div class="callout ${session.draft.status === 'sending' ? 'amber' : 'error'}" role="alert">${esc(sendError)}</div>` : ''}
    </section>`;
  }

  function controlsCard() {
    const draft = session.draft;
    const sending = draft.status === 'sending';
    const ended = Boolean(session.endedAt);
    const canReview = activeAITurns(session).filter(turn => turn.operation === 'reply').length >= 2;
    const ready = Boolean(draft.recordingMs || draft.text.trim());
    const heading = ended ? 'Conversation finished' : busy ? 'Talking to your partner…' : sending ? 'Waiting for the reply…' : 'Answer out loud';
    return `<section class="card"><div class="card-title"><div><p class="eyebrow">YOUR TURN</p><h2>${esc(heading)}</h2></div><output id="ai-time" aria-label="Recording duration">${duration(draft.recordingMs)}</output></div>
      ${ended ? `<p class="small">This conversation is closed so its review stays tied to these words. Start a new one to keep practising.</p><a class="btn" href="#ai">Start another conversation ${icon('arrow')}</a>`
        : `<div class="record-controls"><button class="btn" id="ai-record">${icon('mic')}${draft.recordingMs ? 'Record again' : 'Hold a short answer'}</button>
        <button class="btn danger" id="ai-stop" hidden>${icon('stop')}Stop</button>
        <button class="btn" id="ai-send" ${sending || !ready || busy ? 'disabled' : ''}>${sending ? 'Sending…' : `${icon('arrow')}Send to partner`}</button>
        ${sending && sendError ? '<button class="btn secondary" id="ai-recover">Check for my reply</button>' : ''}</div>
        <p class="fine">Up to 60 seconds. Nothing is sent until you choose Send.</p>
        <p class="fine">${ctx.store.state.preferences.aiVoice === 'natural' ? 'Natural speech by <a href="https://elevenlabs.io/" target="_blank" rel="noopener noreferrer">ElevenLabs</a> · cached replays · device-voice fallback.' : 'German device voice · no TTS API key needed.'} <a href="#settings">Voice settings</a></p>
        <div id="ai-audio" class="audio-preview"></div>
        <details class="notes-details" ${draft.text ? 'open' : ''}><summary>Type a correction instead</summary>
          <label for="ai-text" class="fine">Use this only if recording is not possible. Typed text is never counted as speaking.</label>
          <textarea id="ai-text" maxlength="3000" placeholder="Deine Antwort …" lang="de">${esc(draft.text)}</textarea></details>
        <div class="btn-row ai-operations">
          <button class="btn soft" data-op="repeat">${icon('volume')}Hear it again</button>
          <button class="btn soft" data-op="slow">Slower</button>
          <button class="btn soft" data-op="rephrase">${esc(operationLabel.rephrase)}</button>
          <button class="btn soft" data-op="hint">${esc(operationLabel.hint)}</button>
          <button class="btn secondary" id="ai-review" ${!canReview || busy ? 'disabled' : ''}>End &amp; get a review ${icon('check')}</button>
        </div>`}
    </section>`;
  }

  function reviewCard() {
    const review = session.review;
    if (session.reviewStatus === 'error' && session.reviewError) return `<section class="card section-gap callout error" role="alert"><p>${esc(session.reviewError)}</p></section>`;
    if (!review) return '';
    const last = activeAITurns(session).filter(turn => turn.operation === 'reply').at(-1);
    return `<section class="card section-gap review-card"><div class="card-title"><div><p class="eyebrow">A SHORT REVIEW · NOT A SCORE</p><h2>What worked, and one thing to try again</h2></div><span class="pill">${esc(review.promptVersion)}</span></div>
      ${review.content.strengths.length ? `<h3>Good moments</h3><ul class="review-list">${review.content.strengths.map(item => `<li><span lang="de">${esc(item.quote)}</span>${englishMeaning(item.en, { always: true, label: 'Why it works' })}</li>`).join('')}</ul>` : ''}
      ${review.content.corrections.length ? `<h3>Worth fixing</h3><ul class="review-list corrections">${review.content.corrections.map(item => `<li><s lang="de">${esc(item.original)}</s> <span lang="de">${esc(item.corrected)}</span><p class="fine" lang="de">${esc(item.explanationDe)}</p>${englishMeaning(item.explanationEn, { always: true, label: 'Explanation' })}</li>`).join('')}</ul>` : '<p class="fine">No correction was confident enough to raise, so none was invented.</p>'}
      ${review.content.phrases.length ? `<h3>Phrases to keep</h3><ul class="review-list phrases">${review.content.phrases.map((item, index) => `<li><span lang="de">${esc(item.de)}</span>${englishMeaning(item.en, { always: true })}<button class="text-button" data-save-phrase="${index}">${icon('book')}Save to my phrases</button></li>`).join('')}</ul>` : ''}
      <div class="retry-box"><p class="eyebrow">TRY ONCE MORE</p><p lang="de">${esc(review.content.retryDe)}</p>${englishMeaning(review.content.retryEn, { always: true })}</div>
      <div class="btn-row"><a class="btn" href="#ai">Start a new conversation ${icon('arrow')}</a><button class="btn secondary" id="ai-review-replay">Hear the retry task</button></div>
      ${last ? `<p class="fine">Your conversation is saved on this device. Nothing here awards mastery or a pronunciation grade.</p>` : ''}
    </section>`;
  }

  function draw() {
    if (!alive) return;
    aiSpeech.stop();
    if (audioUrl) { URL.revokeObjectURL(audioUrl); audioUrl = null; }
    el.querySelector('#ai-session').innerHTML = `${transcriptCard()}${controlsCard()}${reviewCard()}`;
    bind();
  }

  async function saveDraft(patch = {}) {
    session.draft = { ...session.draft, ...patch };
    await ctx.store.saveAIDraft(session.id, session.draft);
  }

  function previewAudio(blob) {
    const host = el.querySelector('#ai-audio');
    if (!host) return;
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    audioUrl = URL.createObjectURL(blob);
    host.innerHTML = '<audio controls aria-label="Replay your recorded answer"></audio>';
    host.querySelector('audio').src = audioUrl;
    host.querySelector('audio').addEventListener('play', () => aiSpeech.stop());
  }

  async function loadPreview() {
    if (!session.draft.audioKey || !session.draft.recordingMs) return;
    const key = session.draft.audioKey;
    const blob = await ctx.store.getRecording(key);
    if (blob && alive && session.draft.audioKey === key) previewAudio(blob);
  }

  async function completeTurn(result, previousDraft) {
    if (result.inputStatus === 'unclear') {
      session.draft = draftAfterReceipt(previousDraft, result);
      await ctx.store.saveAIDraft(session.id, session.draft);
      sendError = session.draft.error;
      return;
    }
    await ctx.store.completeAITurn(session.id, result);
    session = ctx.store.state.aiSessions.find(item => item.id === id);
    sendError = '';
  }

  async function sendTurn(operation = 'reply') {
    if (busy || recorder.phase !== 'idle' || session.draft.status === 'sending') return;
    busy = true; sendError = ''; draw();
    const draft = session.draft;
    const wantsAudio = operation === 'reply' && draft.recordingMs > 0 && Boolean(draft.audioKey);
    const audio = wantsAudio ? await ctx.store.getRecording(draft.audioKey).catch(() => null) : null;
    try {
      await saveDraft({ status: 'sending', error: '', operation });
      const payload = { ...aiPayload(session), operation,
        text: audio ? '' : (operation === 'reply' ? draft.text : ''),
        recordingMs: audio ? draft.recordingMs : 0 };
      const result = await client.turn(payload, { audio, recordingMs: payload.recordingMs, signal: ctx.signal });
      await completeTurn(result, session.draft);
    } catch (error) {
      if (isCancelled(error)) { busy = false; draw(); return; }
      session.draft = draftAfterError(session.draft, error);
      await ctx.store.saveAIDraft(session.id, session.draft).catch(() => {});
      sendError = error.message;
      if (session.draft.status === 'sending') { busy = false; await recover(); return; }
    }
    busy = false;
    draw();
    el.querySelector('.transcript')?.scrollIntoView({ block: 'nearest' });
  }

  async function recover() {
    if (session.draft.status !== 'sending' || !session.draft.requestId) { draw(); return; }
    sendError = 'Checking whether your last answer already reached the partner…';
    draw();
    try {
      const result = await client.receipt(session.draft.requestId, { signal: ctx.signal });
      await completeTurn(result, session.draft);
    } catch (error) {
      if (isCancelled(error)) return;
      session.draft = draftAfterRecovery(session.draft, error);
      await ctx.store.saveAIDraft(session.id, session.draft).catch(() => {});
      sendError = session.draft.error || '';
    }
    draw();
  }

  async function requestReview() {
    if (busy || recorder.phase !== 'idle' || session.draft.status === 'sending') return;
    busy = true; sendError = ''; draw();
    try {
      await ctx.store.updateAIConversation(id, item => { item.reviewStatus = 'sending'; item.reviewError = ''; });
      session = ctx.store.state.aiSessions.find(item => item.id === id);
      const payload = { requestId: session.reviewRequestId, sessionId: session.id, missionId: session.missionId, operation: 'reply',
        level: session.level, profile: session.context.profile, text: '', opening: session.context.openingDe, history: aiHistory(session), recordingMs: 0 };
      const result = await client.review(payload, { signal: ctx.signal });
      await ctx.store.saveAIReview(id, result);
      session = ctx.store.state.aiSessions.find(item => item.id === id);
    } catch (error) {
      if (isCancelled(error)) { busy = false; return; }
      await ctx.store.updateAIConversation(id, item => { item.reviewStatus = 'error'; item.reviewError = error.message; }).catch(() => {});
      session = ctx.store.state.aiSessions.find(item => item.id === id);
      sendError = error.message;
    }
    busy = false;
    draw();
  }

  function syncControls() {
    if (!alive) return;
    const phase = recorder?.phase ?? 'idle';
    const blocked = busy || session.draft.status === 'sending' || phase !== 'idle';
    const start = el.querySelector('#ai-record');
    const stop = el.querySelector('#ai-stop');
    if (start) { start.hidden = phase === 'recording'; start.disabled = blocked; }
    if (stop) stop.hidden = !['recording', 'requesting'].includes(phase);
    const send = el.querySelector('#ai-send');
    if (send) send.disabled = blocked || (!session.draft.recordingMs && !session.draft.text.trim());
    const text = el.querySelector('#ai-text');
    if (text) text.disabled = blocked;
    el.querySelectorAll('[data-op]').forEach(button => { button.disabled = blocked; });
    const review = el.querySelector('#ai-review');
    if (review) review.disabled = blocked || activeAITurns(session).filter(turn => turn.operation === 'reply').length < 2;
  }

  function buildRecorder() {
    return createRecorder({
      maxMs: 60_000,
      onState: phase => {
        if (!alive) return;
        syncControls();
        const label = el.querySelector('#ai-time');
        if (label) label.textContent = phase === 'idle' ? duration(session.draft.recordingMs) : { requesting: 'Waiting for the microphone…', recording: 'Recording…', saving: 'Saving on this device…' }[phase];
      },
      onTick: ms => { const label = alive && el.querySelector('#ai-time'); if (label) label.textContent = duration(ms); },
      onComplete: async (blob, ms) => {
        const key = session.draft.audioKey || session.draft.requestId;
        await ctx.store.putRecording(key, blob);
        await saveDraft({ audioKey: key, recordingMs: ms, text: '', status: 'draft', error: '' });
        session = ctx.store.state.aiSessions.find(item => item.id === id);
        sendError = ''; draw();
      },
      onError: message => { sendError = message; draw(); },
    });
  }

  function bind() {
    const startButton = el.querySelector('#ai-record');
    const stopButton = el.querySelector('#ai-stop');
    startButton?.addEventListener('click', async () => {
      aiSpeech.stop();
      document.querySelectorAll('audio').forEach(audio => audio.pause());
      sendError = '';
      await recorder.start();
    });
    stopButton?.addEventListener('click', () => { void recorder.stop(); });
    el.querySelector('#ai-text')?.addEventListener('input', event => {
      void saveDraft({ text: event.target.value, recordingMs: 0, audioKey: '' }).catch(error => ctx.error(error.message));
      if (audioUrl) { URL.revokeObjectURL(audioUrl); audioUrl = null; }
      const host = el.querySelector('#ai-audio');
      if (host) host.innerHTML = '';
      const label = el.querySelector('#ai-time');
      if (label) label.textContent = duration(0);
      syncControls();
    });
    safeAction(el.querySelector('#ai-send'), () => sendTurn('reply'), ctx.error);
    safeAction(el.querySelector('#ai-recover'), () => recover(), ctx.error);
    safeAction(el.querySelector('#ai-review'), requestReview, ctx.error);
    el.querySelectorAll('[data-op]').forEach(button => button.addEventListener('click', async () => {
      const op = button.dataset.op;
      const last = activeAITurns(session).at(-1);
      if (op === 'repeat' || op === 'slow') {
        await aiSpeech.play(last ? last.replyDe : session.context.openingDe, button, { slow: op === 'slow' });
        return;
      }
      await sendTurn(op);
    }));
    el.querySelector('#ai-review-replay')?.addEventListener('click', event => { void aiSpeech.play(session.review?.content.retryDe ?? '', event.currentTarget); });
    el.querySelectorAll('[data-save-phrase]').forEach(button => button.addEventListener('click', async () => {
      try {
        const item = session.review.content.phrases[Number(button.dataset.savePhrase)];
        await ctx.store.addPersonalPhrase({ de: item.de, en: item.en, example: item.example, sourceTitle: `AI Talk · ${mission.shortTitle}` });
        button.disabled = true; button.textContent = 'Saved';
        ctx.notify('Saved to your phrase collection.');
      } catch (error) { ctx.error(error.message); }
    }));
    syncControls();
    void loadPreview().catch(error => { if (alive) ctx.error(error.message); });
  }

  recorder = buildRecorder();
  draw();
  void recover();

  return async () => {
    alive = false;
    aiSpeech.dispose();
    await recorder?.dispose();
    document.querySelectorAll('audio').forEach(audio => audio.pause());
    if (audioUrl) URL.revokeObjectURL(audioUrl);
  };
}

export { renderLobby as render };
export const __testing = { draftAfterError, draftAfterReceipt, draftAfterRecovery, selectedFields };
