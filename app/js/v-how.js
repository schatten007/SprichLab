import { esc, icon, pageHeading, provenance } from './ui.js';

const SOURCES = [
  ['measured', 'The app timed it or recorded it',
    'Practice minutes come from a timer that only runs while the tab is visible and you have interacted in the last minute. Recording lengths come from the audio itself.'],
  ['checked', 'Compared against an answer key',
    'Listening questions and the question-and-answer parts of a check have authored answers. These are the only results the app marks for you.'],
  ['self-rated', 'You judged your own answer',
    'Speaking replies and word recall end with your own honest rating. Revealing a model answer first keeps that attempt marked as helped.'],
  ['reported', 'You typed a number or a note',
    'Minutes spent on a publisher site, time with Gemini, and your written takeaways are your own account of what happened.'],
  ['ai', 'A model\u2019s opinion',
    'Conversation and writing grades come from a language model against a fixed rubric. They are estimates, shown with the words that earned them.'],
  ['external', 'Reported from outside the app',
    'A grade you bring back from a Gemini conversation. Sprich checks the report is well formed and arithmetically correct, not that the conversation went as described.'],
];

export function render(el) {
  el.innerHTML = `${pageHeading('HOW THIS WORKS', 'What your numbers actually mean.',
    'Every figure in Sprich carries a small label saying where it came from. Here is what each one means.')}
    <section class="card section-gap"><h2>Six kinds of evidence</h2>
      <dl class="prov-list">${SOURCES.map(([kind, title, body]) =>
    `<dt>${provenance(kind)} ${esc(title)}</dt><dd>${esc(body)}</dd>`).join('')}</dl></section>

    <section class="card section-gap"><h2>What Sprich never does</h2>
      <ul class="plain-list">
        <li>It never says you <em>are</em> A1, A2, or B1. Lesson levels describe the task, not you.</li>
        <li>It never scores your pronunciation or accent. A transcript cannot measure how you sounded.</li>
        <li>It never turns typed answers into evidence of speaking.</li>
        <li>It never counts reading a word, bookmarking it, or exporting a lesson as practice.</li>
      </ul></section>

    <section class="card section-gap"><h2>How the streak works</h2>
      <p>A day counts when you reach <strong>15 minutes of measured practice</strong>. Six days in a row earns one
      rest day, and you can hold two. Missing a day spends a rest day instead of resetting your streak;
      missing two days in a row ends it.</p>
      <p class="fine">Your daily goal and the streak are separate. The goal is what you chose in Settings; the streak
      only asks that you turned up.</p></section>

    <section class="card section-gap"><h2>These numbers describe this device</h2>
      <p>Progress lives in this browser. Moving a device clock or time zone, or importing a backup from another
      device, changes what the evidence says, because the figures are always recalculated from what is stored here.</p>
      <div class="btn-row section-gap"><a class="btn secondary" href="#progress">${icon('chart')}See your progress</a>
        <a class="inline-link" href="#settings">Settings &amp; backups</a></div></section>`;
}
