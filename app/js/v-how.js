import '../css/evidence.css';
import { esc, icon, pageHeading, provenance } from './ui.js';

const SOURCES = [
  ['measured', 'clock', 'The app timed it or recorded it',
    'Practice minutes come from an unpaused timer while the tab is visible and recently active. It pauses after a minute without interaction; recording keeps it active.',
    'Recording length includes pauses. Active practice time is not a measure of time spent speaking.'],
  ['checked', 'check', 'Compared against an answer key',
    'Listening questions and the question-and-answer parts of a check have authored answers. The browser compares your submitted answers with those keys.',
    'The result describes those questions. Any recorded help stays attached to the attempt.'],
  ['self-rated', 'messages', 'You judged your own answer',
    'Speaking replies and word recall end with your own honest rating. Revealing a model answer first keeps that attempt marked as helped.',
    'Recording is optional. Your rating is a reflection, not an automatic judgement of your German.'],
  ['reported', 'book', 'You typed a number or a note',
    'Minutes spent on a publisher site, time with Gemini, and your written takeaways are your own account of what happened.',
    'Outside minutes stay separate from measured practice and do not fill the daily goal.'],
  ['ai', 'spark', 'A model\u2019s opinion',
    'Conversation and writing grades come from a language model against a fixed rubric. They are estimates, shown with the words that earned them.',
    'A percentage belongs to one submitted task. It does not award a CEFR level or a pronunciation score.'],
  ['external', 'external', 'Reported from outside the app',
    'A grade you bring back from Gemini. Sprich checks the report structure and arithmetic, and checks quotations when it has the original submitted text.',
    'An imported Live report is an external claim. Its validation does not authenticate the conversation or who spoke.'],
];

export function render(el) {
  el.innerHTML = `<div class="evidence-page evidence-guide">
    <header class="evidence-guide-header">${pageHeading('HOW THIS WORKS', 'What your numbers actually mean.',
    'Every figure in Sprich carries a small label saying where it came from. Here is what each one means.')}
      <ul class="evidence-trust"><li>${icon('eye')}Clear sources</li><li>${icon('layers')}Separate kinds of evidence</li><li>${icon('home')}Local progress</li></ul></header>

    <section class="evidence-section"><div class="card-title"><div><p class="eyebrow">START WITH THE SOURCE</p><h2>Six kinds of evidence</h2></div><p class="fine">A timer, a self-rating, and a grade tell different stories.</p></div>
      <div class="evidence-grid">${SOURCES.map(([kind, symbol, title, body, boundary]) =>
    `<article class="evidence-card" data-source="${kind}"><div class="evidence-card-top">${provenance(kind)}${icon(symbol)}</div><h3>${esc(title)}</h3><p class="small muted">${esc(body)}</p><div class="evidence-boundary"><span class="eyebrow">WHAT TO KEEP IN MIND</span><p>${esc(boundary)}</p></div></article>`).join('')}</div></section>

    <section class="card evidence-section evidence-explainer"><div><p class="eyebrow">DIFFERENT PRACTICE, DIFFERENT RECORD</p><h2>Typed notes and spoken answers</h2><p>Writing is useful preparation and practice in its own right. A typed draft alone cannot tell Sprich that you said something aloud.</p><p class="small muted">For speaking practice, record a reply or confirm that you practised aloud. You then reflect on your answer yourself.</p></div>
      <div class="evidence-pathways"><div><span class="evidence-rule-icon">${icon('book')}</span><h3>Write and reflect</h3><p>Typed notes → saved preparation or a writing task.</p></div><div><span class="evidence-rule-icon">${icon('mic')}</span><h3>Say and reflect</h3><p>Recording or aloud confirmation → spoken practice with your own rating.</p></div></div></section>

    <section class="evidence-section"><div class="card-title"><div><p class="eyebrow">THE CONDITIONS MATTER</p><h2>Trying with and without a model</h2></div></div><div class="evidence-conditions">
      <article class="card"><span class="evidence-rule-icon">${icon('messages')}</span><h3>On your own</h3><p>Try a spoken answer before revealing an answer model. Reflect on how it went and choose the rating that fits.</p><p class="evidence-footnote">An independent rating is your own assessment of this attempt.</p></article>
      <article class="card"><span class="evidence-rule-icon">${icon('eye')}</span><h3>With help</h3><p>A model answer or answer hint can help you get started. The attempt keeps that help recorded and cannot be marked independent.</p><p class="evidence-footnote">Supported practice still belongs in your history. You can try again with less help.</p></article>
    </div></section>

    <section class="card evidence-section"><div class="card-title"><div><p class="eyebrow">A ROUTINE WITH ROOM FOR LIFE</p><h2>How the streak works</h2></div>${icon('clock')}</div>
      <p>A day counts when you reach <strong>15 minutes of measured practice</strong>.</p>
      <ol class="evidence-streak-rules"><li><span class="evidence-step">01</span><h3>Earn a rest day</h3><p>Six qualifying days earn one rest day. You can hold up to two.</p></li><li><span class="evidence-step">02</span><h3>A little breathing room</h3><p>One missed day uses a banked rest day. Missing two days in a row ends the streak.</p></li><li><span class="evidence-step">03</span><h3>Your practice stays</h3><p>A streak ending never deletes your saved answers, recordings, or earlier practice.</p></li></ol>
      <p class="evidence-footnote">Your daily goal and the streak are separate. The goal is what you chose in Settings; the streak uses the same 15-minute threshold for everyone.</p></section>

    <section class="card evidence-section"><p class="eyebrow">PRACTICE, NOT A CERTIFICATE</p><h2>What Sprich never does</h2>
      <ul class="plain-list evidence-promises">
        <li>It never says you <em>are</em> A1, A2, or B1. Lesson levels describe the task, not you.</li>
        <li>It never scores your pronunciation or accent. A transcript cannot measure how you sounded.</li>
        <li>It never turns typed answers into evidence of speaking.</li>
        <li>It never counts reading a word, bookmarking it, or exporting a lesson as practice.</li>
      </ul></section>

    <section class="card evidence-section evidence-device"><p class="eyebrow">YOUR SAVED RECORD</p><h2>These numbers describe this device</h2>
      <p>Progress lives in this browser. Moving a device clock or time zone, or importing a backup from another
      device, changes what the evidence says, because the figures are always recalculated from what is stored here.</p>
      <p class="small muted">Progress backups move saved results between devices. Audio recordings stay in the browser where they were made; download individual clips during a session to keep a copy.</p>
      <div class="btn-row section-gap"><a class="btn" href="#progress">${icon('chart')}See your progress</a>
        <a class="btn secondary" href="#today">Start daily practice ${icon('arrow')}</a><a class="inline-link" href="#settings">Settings &amp; backups</a></div></section>
    </div>`;
}
