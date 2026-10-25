# Google Stitch UI brief: Sprich

Use this document as the product and experience brief for a redesigned Sprich interface.

## What to design

Sprich is a local-first German speaking trainer for people who want to speak in everyday, university, and workplace situations. Create a more welcoming, understandable, motivating, and lightly gamified experience while preserving the product’s honest learning model.

The redesign should make it immediately clear:

- what the learner should do next;
- why that activity is useful;
- how much time it will take;
- what kind of evidence the activity creates;
- whether it works offline or needs an online service;
- how the learner can resume unfinished work;
- what progress has been earned through real effort.

The product must feel encouraging without pretending that a number proves language ability. The learner should be able to start speaking within the first minute, even without an account, API key, paid subscription, or AI setup.

## Important design boundary

Describe and represent the product behavior below, but choose the visual solution yourself. Do not assume a particular card layout, color palette, font, illustration style, icon family, spacing system, navigation geometry, or animation language. Explore an appropriate responsive web experience for desktop and mobile.

Do not remove existing functionality to simplify the interface. Use progressive disclosure, clear grouping, sensible defaults, and good information hierarchy instead.

Do not invent social features, competitive rankings, CEFR certification, pronunciation scoring, or automatic claims about job readiness. Gamification must reward effort and useful practice, not intelligence, speed, spending, or unverified language ability.

---

## Product context

### Product promise

- Free browser-based German speaking practice.
- No account is required for the core experience.
- Progress, drafts, and recordings stay on the learner’s device.
- The core course works without an API key.
- Optional AI services are clearly separated from the core course.
- Learners can use device German speech, record themselves, or use a reading alternative when a microphone or voice is unavailable.
- The app can be installed as a PWA on Android and supports offline practice after content has been cached.

### Existing content

- 48 beginner lessons across 5 stages and 12 modules.
- 250 useful vocabulary entries.
- 12 workplace missions with 6 stages of practice.
- 120 workplace phrases.
- 36 bilingual workplace dialogues.
- 108 workplace comprehension questions.
- 15 curated German learning resources with guided follow-up tasks.
- 60 locally checked pilot assessment questions.
- 4 short writing tasks.
- Graded roleplay variations for published lessons and workplace missions.

### Core learning loop

The primary experience should support this loop:

1. Choose one small, useful situation.
2. Understand a phrase, word, pattern, or model conversation.
3. Say something aloud, with or without recording.
4. Try a guided reply and a personal variation.
5. Reflect on what happened and what to try next.
6. Optionally continue the situation in Gemini or AI Talk.
7. Save a phrase, takeaway, recording, or review item.
8. Return later through a clear resume action.

---

## Global application shell

The application has a persistent shell so the learner always knows where they are and how to get back to the next useful action.

### Global information and actions

The shell needs to communicate:

- Sprich identity and the promise “German for your next step”.
- Current connection state: online/local or offline/local.
- Current learner path: beginner Start speaking or Workplace course.
- A direct way to resume the most important unfinished activity.
- Primary destinations:
  - Today
  - Lessons
  - Words
  - Progress
- Secondary destinations:
  - AI Talk
  - Checks and graded roleplays
  - Workplace missions
  - Settings and profile
  - How progress works
- Access to backups and progress transfer.

### Global interaction behavior

- Navigation must work on desktop and narrow mobile layouts.
- A learner should not lose an unfinished session by navigating away.
- Returning to a route should restore saved draft and session position.
- Async saves should show a clear saved/saving/error state without blocking unrelated navigation.
- Route errors should offer a useful recovery action rather than a blank page.
- A shared phrase URL should open the phrase capture flow with the text and safe source URL prefilled.
- The app should clearly distinguish local, offline, external-resource, gateway, and AI-dependent actions.

---

## Screen and page inventory

The following pages and states are part of the product. Each should have a clear purpose, primary action, secondary actions, and a meaningful empty/loading/error state.

### 1. Today / daily practice

This is the default home screen and the most important screen for retention.

#### Beginner-path version

Show one recommended next lesson, why it was recommended, its estimated time, level, German goal, and a first action. The recommendation should be based on unfinished work, recent difficulty, and the next available lesson—not a random content carousel.

Also expose:

- today’s measured practice time against the learner’s chosen goal;
- the forgiving streak status;
- a seven-day activity strip;
- the next effort milestone;
- due or suggested word practice;
- the learner’s saved daily takeaway;
- a shortcut to the full path;
- a shortcut to export the current lesson for Gemini;
- the selected learning path and a way to change it.

#### Workplace-path version

Show one daily focus sized to the selected time budget. The focus can be:

- a workplace mission;
- phrase recall;
- listening and comprehension;
- shadowing a short line;
- retrying with less help;
- a curated resource activity;
- a reflection and reuse task.

The daily queue can also include a mission, due reviews, a resource, and a reflection. It must remain understandable when the learner has only 15 minutes.

#### Main actions

- Start or resume the recommended activity.
- Review due words or learn five words.
- Start a workplace mission.
- Open a suggested resource.
- Save a takeaway.
- Adjust the daily goal or path.

#### Desired improvement

Make Today feel like a calm personal coach: one obvious next step, a small reason to do it, a visible sense of progress, and optional ways to continue. Avoid presenting every feature at equal visual weight.

### 2. Lessons / learning path

Provide two related views:

#### My path

- Five stages from first conversations to university and work.
- Current stage and stage completion progress.
- One recommended next lesson.
- A reason for the recommendation.
- Unfinished lesson resume actions.
- Guided retry suggestions after repeated difficulty.
- Advisory prerequisite links labeled “Useful first”; prerequisites never lock lessons.
- Status for each lesson: new, in progress, or practised.

#### All lessons

Allow learners to search and filter all 48 lessons by:

- level;
- topic;
- speaking skill;
- status;
- German phrase, situation, or goal.

Each lesson entry can lead to its overview, a guided session, a less-help session, and a Gemini export.

### 3. Lesson overview

For one selected beginner lesson, show:

- title, stage, module, level, register, estimated time, and practice count;
- the first German warm-up phrase with meaning and audio;
- the language focus or grammar note;
- 5–8 target words;
- whether an unfinished session exists;
- guided and less-help start options;
- a link to related checks and graded roleplays;
- Gemini export;
- an after-Gemini takeaway form.

The overview should make the lesson feel small and achievable before the learner starts.

### 4. Beginner lesson session

The session is a guided sequence with a clear step position and saved progress. It includes:

1. Say something immediately using a short model.
2. Learn a small set of useful words.
3. Build a sentence using a pattern and language note.
4. Hear a bilingual model dialogue.
5. Complete guided speaking replies.
6. Complete a personal variation.
7. Finish and reflect.

Available actions include:

- hear and replay German audio;
- slow down or stop audio;
- record up to 60 seconds;
- mark that the learner practised aloud without recording;
- add optional notes or a dictated note;
- reveal a meaning or model answer;
- move back or forward;
- mark “Try again later”, “Needed help”, or “Said it on my own”;
- finish the lesson;
- practise the same situation again with less help;
- export the lesson for Gemini;
- save a takeaway.

Important learning rules to explain clearly:

- Recording is optional.
- Typed notes alone are not speaking evidence.
- Showing a model answer counts as help and prevents an independent rating for that attempt.
- The learner’s rating is self-rated practice evidence, not automatic pronunciation or grammar scoring.

### 5. Words / vocabulary library

The Words area contains 250 entries and should support quick browsing and focused practice.

Provide:

- search by German, English, or example;
- topic filter;
- word-type filter;
- saved-words-only filter;
- incremental loading or another way to keep the full library manageable;
- word cards with German, meaning, article/plural or useful form, examples, and audio;
- save word;
- say from memory;
- learn five words;
- review due words;
- resume unfinished word practice.

Practice modes:

- recognise the meaning;
- say the German word;
- use it in a sentence.

Each mode has its own review history. The learner attempts first, then may reveal the answer or model. Outcomes should be explicit and supportive: again, with help, remembered, or used it.

### 6. Word-practice session

Present one word at a time with an attempt-first flow. Support:

- audio;
- reveal meaning or model;
- optional notes;
- recording where appropriate;
- outcome selection;
- progress through the small batch;
- pause, resume, and completion state.

The completion state should point to the next useful action, such as another short review or returning to the conversation lesson.

### 7. Phrase collection / conversation toolkit

This combines curated workplace phrases and personal phrases.

Provide:

- search by phrase, meaning, or situation;
- topic filters such as interviews, phone calls, availability, work, getting unstuck, meetings, and small talk;
- phrase cards with German, English meaning, example, language note, due status, and source attribution;
- listen to phrase;
- recall phrase aloud;
- save personal phrase;
- add a phrase from shared text;
- find a free attributed example for personal phrases;
- use a selected example;
- show spaced spoken-use status where earned.

Shared text flow:

- A shared text or URL can open the phrase form.
- The text and safe source URL are prefilled.
- The learner confirms or edits the German phrase and adds the English meaning.
- The app does not scrape or fetch the source page.
- The saved phrase keeps its source attribution.

### 8. Workplace mission library

The Workplace area contains 12 realistic situations across a six-stage path. Examples include:

- first interview;
- calling about a vacancy;
- appointments and changes;
- availability and university scheduling;
- understanding instructions;
- work updates and deadlines;
- explaining problems and asking for help;
- colleague small talk;
- describing a project;
- participating in meetings;
- requests and handovers;
- a mixed mock interview.

Each mission entry should show:

- English and German title;
- level and register;
- communication goal;
- completion or practice status;
- number of dialogue variants;
- phrase targets;
- start, resume, or practise-a-new-variation action;
- Gemini export;
- related resources and phrase collection links.

Allow filtering by stage. Make clear that phrase review or resource work does not falsely complete a workplace mission.

### 9. Workplace mission and phrase-review session

Mission sessions can include:

1. Mission brief and communication goal.
2. Listening and understanding.
3. Phrase recall.
4. Shadowing a short line.
5. Contextual speaking turns.
6. Retry with less help.
7. Wrap-up and reflection.

Listening may include:

- German playback;
- normal and slower audio;
- comprehension questions;
- optional transcript;
- optional English meaning;
- authored answer-key feedback.

Speaking may include:

- recording or a no-recording aloud confirmation;
- optional typed notes;
- replay;
- rephrase the question;
- hear the prompt again;
- reveal a hint or model;
- choose a response intent;
- check speaking criteria;
- mark phrases actually used;
- choose an improvement focus;
- rate the attempt.

The session must preserve its content snapshot and draft when the learner leaves. A phrase-review session uses due phrases and a spoken reuse task but does not complete its parent mission.

### 10. German resource library

The resource library contains 15 curated third-party German resources, including video, audio, course, text, and workplace materials.

Support filters for:

- search;
- level;
- format;
- estimated practice time;
- no-registration-required;
- transcript/captions available;
- saved/bookmarked resources.

Each resource entry should communicate:

- provider and title;
- German summary;
- level;
- media format;
- estimated follow-up time;
- registration requirements;
- captions/transcript or voice information;
- access and availability warnings;
- bookmark state;
- guided activity action.

External content remains on the publisher’s site. The Sprich experience adds a short, in-app speaking follow-up.

### 11. Resource detail and guided activity

Resource detail should include:

- provider, title, English title, level, and estimated time;
- source summary;
- open original resource;
- start guided activity;
- bookmark;
- difficulty rating: easy, about right, or too difficult;
- mark source unavailable or available again;
- access and verification details;
- alternate resource or an in-app fallback when necessary;
- related phrases and matching workplace mission.

The guided activity should let the learner:

- follow German steps;
- save a written response or recording;
- optionally record minutes spent on the publisher’s site as self-reported time;
- add a personal phrase;
- complete the activity only after saving a response;
- return to Today or practise the matching mission.

Resource work is unscored and must be labeled that way.

### 12. Progress and evidence

The Progress area should turn saved activity into an understandable story.

Include:

- this week’s measured active minutes;
- daily goal progress;
- streak and banked rest days;
- seven-day practice strip;
- recorded minutes;
- beginner lessons practised;
- words recalled;
- spoken answers;
- earned milestones;
- one next milestone;
- saved assessment results;
- workplace evidence;
- first and most recent recording comparison;
- recent completed and unfinished sessions;
- saved Gemini and daily takeaways;
- replay of saved beginner responses;
- export progress shortcut.

Every metric should identify its evidence source. Use these labels consistently:

- measured;
- checked locally;
- self-rated;
- self-reported;
- AI estimate;
- imported Gemini assessment.

Progress must never imply that an assessment percentage is a CEFR level or that a number proves pronunciation quality.

### 13. Settings and learner profile

Support profile fields for:

- name;
- studies;
- one skill or experience;
- availability;
- start date;
- motivation.

Support preferences for:

- daily goal: 15, 30, 60, 90, or 120 minutes;
- system/light/dark appearance;
- light palette choice;
- time zone;
- German device voice;
- read-aloud speed;
- English support on demand or always visible;
- Start speaking or Workplace course;
- AI Talk voice;
- AI level A2 or B1.

Support local data actions for:

- export progress;
- import progress;
- optionally import profile and preferences;
- remove saved audio while retaining history;
- add the app to the home screen;
- download legacy or pre-upgrade backups where present.

Explain that audio recordings stay on the device and are not included in progress exports.

### 14. AI Talk lobby

AI Talk is optional and must never make the core course feel unavailable.

The lobby should separate:

#### Setup

- gateway configured or missing;
- provider configured or missing;
- locked or unlocked state;
- usage counters and limits;
- owner access code entry;
- unlock and lock actions;
- model/connection check;
- setup recovery guidance.

#### Conversation start

- choose a workplace situation;
- choose A2 or B1;
- see which optional profile facts may be sent;
- start only when setup is ready;
- reopen saved conversations.

#### Gemini Companion

This requires no gateway. It creates a lesson- or mission-specific pack for a normal Gemini chat or Gemini Live conversation, with vocabulary, examples, patterns, dialogue, level target, and help setting.

### 15. AI Talk conversation

Show a partner conversation with:

- partner opening;
- learner turns;
- partner replies;
- English meaning where enabled;
- local recording status;
- typed fallback;
- send-to-partner control;
- replay and slower controls;
- rephrase or simplify request;
- hint request;
- receipt recovery after uncertain network outcomes;
- end and get a review.

Important privacy and trust behavior:

- Recording is saved locally before sending.
- Audio is not sent until the learner explicitly chooses Send.
- Typed turns are labeled as typed and are not speaking evidence.
- Provider errors, quotas, and network failures preserve the draft.
- The qualitative review is labeled “not a score”.
- AI Talk does not award mastery, CEFR level, or pronunciation grade.

### 16. Gemini lesson-pack screen

For a selected lesson or mission, provide:

- selected context;
- target level;
- Guided or Less help setting;
- optional profile facts with explicit consent;
- editable pack preview;
- copy;
- download as text;
- share where supported;
- instructions for desktop-to-phone handoff and Gemini Live;
- after-Gemini takeaway form;
- self-reported Gemini minutes.

Exporting a pack does not complete or grade a lesson.

### 17. Checks and graded roleplays

The Checks area should include:

- Practice mode, where help is recorded;
- Checkpoint mode, where answer help stays hidden until submission;
- objective checks;
- free writing;
- conversation roleplays;
- search and filters by type and level;
- contextual entry from a lesson;
- saved assessment attempts.

The product currently includes 60 keyed questions, 4 writing tasks, and roleplay variations for published lessons and missions.

### 18. Objective assessment run

Support:

- multiple choice;
- short text;
- labeled slots;
- token ordering with Undo and Reset;
- optional English instructions;
- Practice-mode answer and translation reveals;
- Checkpoint-mode hidden answer help;
- draft saving;
- active timer and pause;
- submit and seal.

Empty answers score zero for local checks. Word variants and accepted answers are authored by the content model.

### 19. Writing assessment run

Support:

- task prompt;
- required points;
- German writing area;
- suggested word range as guidance, not a semantic score;
- character and word count;
- draft save and retry;
- Save for grading;
- immutable submission.

### 20. Assessment result

Show the submitted artifact together with:

- score or partial/insufficient evidence;
- earned and maximum points;
- target level;
- mode and support conditions;
- grading source;
- detailed accepted answers and explanations for local checks;
- rubric ratings, evidence, strengths, corrections, and retry task for writing/roleplay;
- saved evaluations if more than one exists;
- retry as a separate attempt.

Available grading paths:

- local answer-key result;
- in-app AI estimate through the configured gateway;
- Gemini grading pack and imported report.

Imported reports must show that they are externally reported and locally validated, not authenticated proof of performance. Failed grading or missing credentials must not appear as a zero.

### 21. How progress works

Explain in plain language:

- the six evidence labels;
- what counts as measured practice;
- what self-rating means;
- why typed answers do not become speaking evidence;
- why showing a model changes the conditions;
- what AI estimates and imported reports mean;
- how the forgiving streak works;
- that metrics describe this device and are not a language certificate.

This is a trust-building screen, not an upsell or achievement wall.

---

## Gamification and motivation requirements

Make the experience more gamified, but keep the tone calm, honest, and useful.

### Existing effort-based mechanics to preserve

- learner-selected daily goal: 15, 30, 60, 90, or 120 minutes;
- a day qualifies after 15 minutes of measured in-app practice;
- six qualifying days earn one rest day;
- up to two rest days can be banked;
- one missed day can use a rest day;
- two consecutive missed days end the streak;
- seven-day activity strip;
- one next milestone at a time;
- deduplicated effort milestones for lessons, words, spoken answers, recorded minutes, and total practice time;
- spaced review for recognition, spoken recall, and sentence use.

### Improve the motivation loop

The redesign should make the following moments more satisfying and more legible:

- first visit and first spoken attempt;
- completing a small task;
- finishing a lesson or mission;
- returning to an unfinished activity;
- completing a due review;
- reaching a milestone;
- saving a phrase or takeaway;
- returning after a missed day without shame;
- comparing a first recording with a later recording;
- completing a weekly practice routine.

Choose appropriate mechanics and presentation, such as progress feedback, unlockable context, meaningful completion states, gentle celebrations, collections, quests, or a visible personal journey. Keep the number of simultaneous goals small so the learner does not feel managed by the interface.

### Gamification guardrails

- Reward showing up, attempting, speaking, reviewing, and reflecting.
- Never reward guessing that an answer was correct when the learner used help.
- Never convert AI estimates into a permanent ability level.
- Never use public leaderboards or social comparison as the default.
- Never punish a missed day with loss of earned learning evidence.
- Make rewards optional or quiet enough for learners who prefer a calm study tool.
- Keep accessibility and reduced-motion behavior intact.
- Make it possible to understand why a reward was earned.

---

## Cross-cutting states and behavior

The redesigned UI must describe and support all of these states, not only the happy path.

### Loading

- initial app boot;
- course pack loading;
- route-level lazy content loading;
- saving a draft;
- saving a response;
- loading recordings;
- checking AI gateway;
- looking up an attributed example;
- submitting a local check;
- waiting for AI grading;
- recovering an uncertain AI receipt.

### Empty

- no matching lessons, words, phrases, resources, or assessments;
- no saved AI conversations;
- no saved recordings yet;
- no saved progress history yet;
- no due reviews;
- no Tatoeba result;
- no previous backup.

Every empty state should explain what it means and offer the next useful action.

### Error and recovery

- browser storage unavailable;
- failed local save;
- missing course pack;
- missing recording;
- microphone denied or unavailable;
- no German voice installed;
- external resource unavailable;
- Tatoeba request failed;
- AI gateway unavailable;
- provider quota or cooldown;
- ambiguous network result;
- invalid Gemini report;
- conflicting progress import.

Errors should preserve learner drafts and offer retry, fallback, or a clear offline alternative whenever possible.

### Offline and local-first behavior

- core lessons, vocabulary, recordings, self-assessment, and device speech can work offline after setup;
- external resources require a connection;
- Tatoeba lookup requires a connection;
- AI Talk and AI grading require a configured online gateway;
- Gemini export is generated locally, but the Gemini conversation itself is external;
- assessment packs and optional assessment code can be cached after first use;
- resource links should be disabled or explained when offline;
- recording requires localhost or HTTPS;
- the connection indicator must be visible without making offline learners feel blocked.

---

## Accessibility, responsiveness, and trust

- Support desktop and narrow mobile layouts, including Android installed-app use.
- Keep keyboard navigation usable.
- Provide visible focus states and meaningful labels.
- Do not rely on color alone for status, level, due state, or provenance.
- Respect reduced-motion preferences.
- Keep audio controls and recording status understandable without sound.
- Provide reading alternatives when microphone or speech services are unavailable.
- Keep German and English language roles clear.
- Use plain language for errors, privacy, grading conditions, and evidence provenance.
- Avoid hidden destructive actions; removing audio must explain that progress history remains.
- Keep profile facts and AI sharing choices explicit and optional.
- Make saving and offline availability visible at the moment they matter.

## Desired Stitch output

Create a coherent responsive product concept covering the full journey:

1. first visit and first recommended activity;
2. beginner lesson path;
3. beginner speaking session;
4. vocabulary practice;
5. phrase capture and collection;
6. workplace mission practice;
7. resource-guided practice;
8. progress and effort rewards;
9. AI Talk and Gemini handoff;
10. checks, writing, roleplays, and results;
11. settings, backups, offline states, and recovery.

Show how a learner moves from “What should I do?” to “I said something useful” to “I know what to do next.” Preserve all existing capabilities while making the experience easier to understand, more motivating, more forgiving, and more rewarding to return to.
