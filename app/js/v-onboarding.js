import '../css/onboarding.css';
import { icon, pageHeading } from './ui.js';

export function render(el, ctx) {
  el.innerHTML = `<div class="getting-started">
    ${pageHeading('START HERE', 'Start here with Sprich.', 'Use the smallest path through the app. Everything beyond this guide can wait.')}
    <section class="card getting-started-hero"><p class="eyebrow">THE CORE LOOP</p><h2>Learn a little → say it out loud → talk to Gemini → keep one useful sentence.</h2><p class="small muted section-gap">You do not need an account, a provider key, a microphone, or a perfect answer to begin. Recording is optional and progress stays on this device.</p></section>
    <div class="getting-started-grid">
      <section class="card getting-started-step"><span class="step-number">01</span><div><p class="eyebrow">USE THE APP</p><h2>Start on Today</h2></div><p>Press <strong>Hear and repeat</strong>, then start the recommended guided lesson. Say each answer aloud before revealing the model. Choose <strong>Needed help</strong> when you needed help; honest ratings make the next review useful.</p><a class="inline-link" data-finish-onboarding href="#today">Open Today ${icon('arrow')}</a></section>
      <section class="card getting-started-step"><span class="step-number">02</span><div><p class="eyebrow">AUDIO IS OPTIONAL</p><h2>Use the free device voice first</h2></div><p>Keep <strong>German device voice</strong> selected in Settings. Add German voice data in your device settings if needed. Optional AI Talk provider keys belong to the local gateway, not browser progress or Gemini exports.</p><a class="inline-link" href="#settings">Open audio settings ${icon('arrow')}</a></section>
      <section class="card getting-started-step"><span class="step-number">03</span><div><p class="eyebrow">DAILY ROUTINE</p><h2>Make 15 minutes enough</h2></div><ul class="getting-started-mini"><li>One short lesson in Guided mode.</li><li>Learn or review five words.</li><li>Save one sentence you can use.</li><li>Close the app. Resume tomorrow; do not catch up.</li></ul><p class="fine">Change your daily goal in Settings whenever your life changes.</p><a class="inline-link" data-finish-onboarding href="#lesson/starter-hello">Open the first lesson ${icon('arrow')}</a></section>
      <section class="card getting-started-step"><span class="step-number">04</span><div><p class="eyebrow">MANUAL GEMINI</p><h2>What to send and what to get back</h2></div><p>Open a lesson and choose <strong>Export for Gemini</strong>. Copy the practice pack into a normal Gemini chat, then ask it to start the warm-up and ask one short German question at a time.</p><div class="getting-started-prompt"><p><strong>Ask Gemini to return:</strong></p><p>one sentence you said, one useful correction, one thing to practise, and one new word with its English meaning.</p></div><a class="inline-link" data-finish-onboarding href="#gemini/starter-hello">Open a Gemini pack ${icon('arrow')}</a></section>
    </div>
    <section class="card getting-started-actions"><div><button class="btn" id="getting-started-done">Start practicing ${icon('arrow')}</button><a class="btn secondary" href="#settings">Open Settings</a></div><p class="fine">You can reopen this guide any time from Settings.</p></section>
  </div>`;
  const finish = () => { ctx.finishOnboarding(); };
  el.querySelector('#getting-started-done').addEventListener('click', () => { finish(); ctx.go('today'); });
  el.querySelectorAll('[data-finish-onboarding]').forEach(link => link.addEventListener('click', finish));
}
