# Google Stitch follow-up request · Sprich

This is a standalone follow-up request for Google Stitch. It should extend the
existing Sprich screens already produced in Stitch rather than invent a new
product. Everything needed to make the design decisions is included below.

## Copy/paste request for Stitch

Design and generate the missing responsive screens, states, and production-ready
assets for **Sprich — German for your next step**.

Use the existing Sprich Stitch screens as the visual baseline. Preserve the
established Electric Slate direction: deep charcoal surfaces, electric lime,
violet, cyan, and orange semantic accents; Space Grotesk for headings and Plus
Jakarta Sans or an accessible equivalent for body and German text; large touch
targets; rounded tactile surfaces; calm, high-contrast, ADHD-friendly chunking.

This is a local-first German speaking trainer, not a social network, language
certificate, pronunciation evaluator, or subscription product.

The existing reference screens are useful visual references, but do not copy
their unsupported claims, invented metrics, remote image URLs, or hard-coded
sample data. Treat bakery copy, names, percentages, and progress numbers as
replaceable sample content unless explicitly marked as a content fixture.

This request is the complete product and interaction brief. All product,
content, trust, accessibility, and asset requirements needed for this follow-up
are stated here.

## Product scope

Sprich is a free browser-based German speaking trainer for everyday,
university, and workplace situations. It is designed for learners who need a
small, clear next action and honest feedback about the practice they completed.

The product contains:

- 48 beginner lessons across five stages and 12 modules;
- 250 useful vocabulary entries;
- 12 workplace missions across a six-stage workplace path;
- 120 curated workplace phrases;
- 36 bilingual workplace dialogues;
- 108 workplace comprehension questions;
- 15 curated third-party German resources with in-app follow-up tasks;
- 60 locally checked pilot assessment questions;
- four short writing tasks;
- graded roleplay variations for published lessons and workplace missions.

The core learning loop is:

1. Choose one small, useful situation.
2. Understand a phrase, word, pattern, or model conversation.
3. Say something aloud, with or without recording.
4. Try a guided reply and a personal variation.
5. Reflect on what happened and what to try next.
6. Optionally continue in Gemini or AI Talk.
7. Save a phrase, takeaway, recording, or review item.
8. Return later through a clear resume action.

The visual design should answer these questions immediately: What should I do
next? Why is it useful? How long will it take? What evidence will be saved? Does
it work offline? Can I resume it later? What effort have I actually completed?

## Product truths that every screen must respect

1. Core practice works without an account, subscription, API key, or AI setup.
2. Progress, drafts, and recordings remain on the learner's device.
3. Core lessons, vocabulary, recording, self-rating, and device speech can work
   offline after the app has been cached.
4. External resources and Tatoeba need a connection.
5. AI Talk needs a configured online gateway. Gemini export is generated locally,
   but the Gemini conversation occurs outside Sprich.
6. Recording is optional. A learner can practise aloud without recording, or use
   a reading alternative when microphone or voice services are unavailable.
7. Typed notes alone are not speaking evidence.
8. Revealing a model answer or translation is help and must be visible in the
   attempt conditions.
9. Regular lesson speaking is self-rated practice evidence. It is not automatic
   pronunciation, grammar, fluency, or accent scoring.
10. Assessments are task-specific. They never award a CEFR level, pronunciation
     grade, job-readiness claim, or permanent ability level.

Use these evidence labels exactly and do not replace them with invented labels:

- `Measured`
- `Checked locally`
- `Self-rated`
- `Self-reported`
- `AI estimate`
- `Imported Gemini assessment`

Do not use or imply any of the following in the UI:

- `XP`, points, leaderboards, social ranking, or competitive status;
- pronunciation match, articulation percentage, echo match, acoustic quality,
  fluency score, latency improvement, or decibel-based ability claims;
- CEFR certification, B1 readiness, simulated readiness, mastery percentage,
  job readiness, or “top 1%” language claims;
- “AI active” on core offline speaking screens;
- a simplified custom backup that looks like a complete progress export.

Effort rewards should be expressed as practice time, spoken attempts, completed
lessons, recalled words, saved milestones, and the forgiving rest-day system.

The effort rules are:

- the learner chooses a daily goal of 15, 30, 60, 90, or 120 minutes;
- a day qualifies for the streak after 15 minutes of measured in-app practice;
- six qualifying days earn one rest day;
- up to two rest days can be banked;
- one missed day may use a banked rest day;
- two consecutive missed days end the streak;
- missed days never delete earned learning evidence;
- only one next milestone should be emphasized at a time.

The offline and connection rules are:

- cached core lessons, vocabulary, recording, self-rating, and device speech
  remain usable offline;
- external resources and Tatoeba require a connection;
- AI Talk and AI grading require a configured online gateway;
- Gemini packs are generated inside Sprich, but the Gemini conversation is
  external;
- resource links must be disabled or clearly explained when offline;
- recording requires a secure origin such as HTTPS or localhost;
- when a microphone or German voice is unavailable, provide a reading and
  aloud-practice alternative;
- every network-sensitive action must preserve drafts and offer retry or a local
  fallback where possible.

## Global shell requirements

Create one coherent shell with desktop and narrow-mobile variants.

The shell must make these visible or reachable without ambiguity:

- Sprich identity and the promise “German for your next step”;
- current state: `On this device`, `Offline/local`, or `Online/local`;
- the selected learning path: `Start speaking` or `Workplace`;
- the most important unfinished activity and a direct `Resume` action;
- primary navigation: `Today`, `Lessons`, `Words`, and `Progress`;
- secondary navigation: `Workplace`, `Resources`, `AI Talk`, `Checks & roleplays`,
  `Settings & profile`, and `How progress works`;
- progress export/import and backup access;
- a visible saved/saving/save-error status where a draft is being edited.

On mobile, use a safe-area-aware bottom navigation for the four primary areas.
Put secondary destinations under a clearly labelled `More` or profile menu.
Do not make Workplace silently replace Progress in the primary navigation.

Provide a route-error recovery pattern with a useful action such as `Try again`,
`Return to Today`, or `Open saved work`.

## Required screen generation

Generate each item as a named desktop frame and a named mobile frame. For
interactive screens, provide the important state variants listed below rather
than only a static happy path.

### 1. Today and first visit

Create:

- beginner-path Today with one recommended next lesson;
- workplace-path Today with a 15-minute-sized daily focus;
- an unfinished-session resume state;
- first visit with no history, no streak, and the first spoken attempt;
- due-word review state;
- no-due-review state;
- saved daily takeaway state;
- offline/local state showing which actions remain available;
- connection-required state for an external resource or AI action.

The main recommendation must show its reason, time estimate, level/task target,
German goal, evidence type, and one obvious start/resume action. Also show the
chosen daily goal, measured minutes, forgiving streak, seven-day activity strip,
one next effort milestone, selected path, and optional secondary actions.

The seven-day strip represents practice activity/minutes, not speech decibels.

### 2. Lessons and lesson overview

Create:

- `My path`: five stages, current stage, completion progress, recommendation
  reason, unfinished lesson resume, guided retry, and advisory `Useful first`
  prerequisite links;
- `All lessons`: search and filters for level, topic, speaking skill, status,
  German phrase, situation, and goal;
- empty filtered-results state;
- lesson overview with title, stage, module, level, register, estimated time,
  practice count, warm-up phrase, audio, language focus, 5–8 target words,
  unfinished-session status, Guided/Less help actions, related checks,
  Gemini export, and after-Gemini takeaway.

Prerequisites are advisory links only. Nothing is locked.

### 3. Complete beginner speaking session

Generate a session frame set for all seven steps:

1. Say something immediately using a short model.
2. Learn a small set of useful words.
3. Build a sentence with a pattern and language note.
4. Hear a bilingual model dialogue.
5. Complete guided speaking replies.
6. Complete a personal variation.
7. Finish and reflect.

For the speaking states, show:

- model audio, replay, slower playback, and stop;
- optional recording up to 60 seconds;
- `Practised aloud without recording`;
- optional notes/dictated note;
- attempt-first meaning/model reveal;
- `Try again later`, `Needed help`, and `Said it on my own` outcomes;
- previous/next navigation and saved step position;
- saving, save failure, and restored draft;
- completed lesson with next action;
- `Practise again with less help`;
- Gemini export and saved takeaway.

Use `Self-rated` for the learner outcome. Do not show pronunciation evaluation.

### 4. Words and word-practice session

Create a full Words library, not only a quick-review card:

- search by German, English, or example;
- topic, word-type, and saved-only filters;
- incremental loading for the 250-entry library;
- word cards with German, meaning, article/plural or useful form, example,
  audio, save action, due status, and review provenance;
- `Learn five words`, `Review due words`, and resume unfinished practice;
- empty search and no-due-review states.

Create separate word-practice frames for:

- recognise meaning;
- say the German word;
- use it in a sentence;
- answer first, reveal second;
- optional recording and notes;
- outcomes: `Again`, `With help`, `Remembered`, `Used it`;
- pause/resume, saved draft, completion, and return-to-lesson states.

Use `Self-rated` and spaced-review language. Do not use “clear articulation”,
“local STT active”, or a mastery percentage.

### 5. Phrase collection and shared phrase capture

Create:

- curated phrase library and personal phrase library;
- search by phrase, meaning, or situation;
- filters for interviews, phone calls, availability, work, getting unstuck,
  meetings, and small talk;
- phrase card with German, English meaning, example, learning note, due status,
  source attribution, audio, and recall-aloud action;
- add-personal-phrase form;
- shared-text route with German text and safe source URL prefilled;
- edit/confirm German phrase and add English meaning;
- no-scraping explanation;
- source attribution retained after save;
- Tatoeba loading, no-result, and request-failed states.

### 6. Workplace mission library and session

Keep the mission library separate from Progress. Create:

- six-stage workplace path;
- 12 mission cards with English/German title, level, register, communication
  goal, status, dialogue variants, phrase targets, start/resume/retry action,
  Gemini export, and related resources/phrases;
- stage filter and empty state;
- explicit note that phrase review or resource activity does not complete a
  parent mission.

Create the workplace mission session with:

1. mission brief and communication goal;
2. listening and understanding;
3. phrase recall;
4. shadowing a short line;
5. contextual speaking turns;
6. retry with less help;
7. wrap-up and reflection.

Show German audio, slower playback, optional transcript and English meaning,
comprehension questions, authored answer-key feedback, recording/no-recording
practice, typed notes, replay, rephrase, prompt replay, hint/model reveal,
response intent, speaking criteria checklist, phrases actually used,
improvement focus, self-rating, saved draft, and recovery after leaving.

### 7. Resource library and guided activity

Create:

- resource library with search, level, format, practice-time, no-registration,
  transcript/captions, and saved-resource filters;
- resource cards showing provider, title, German summary, level, format,
  follow-up time, registration requirement, transcript/voice information,
  access warning, bookmark, and guided activity action;
- resource detail with open-original action, bookmark, difficulty rating,
  unavailable/available-again action, verification details, alternative source,
  and in-app fallback;
- guided activity with German steps, written response or recording, optional
  self-reported outside minutes, personal phrase capture, and completion only
  after a response is saved;
- offline external-link-disabled state;
- unavailable-source and alternative-resource state.

Mark resource work as `Unscored` and keep self-reported external time separate
from measured in-app practice.

### 8. Progress and evidence

Create Progress as its own route, not as a continuation of Workplace missions.

Include:

- this week's measured active minutes;
- selected daily-goal progress;
- forgiving streak and banked rest days;
- seven-day activity strip;
- recorded minutes;
- beginner lessons practised;
- words recalled;
- spoken answers;
- earned milestones and one next milestone;
- saved assessment results;
- workplace evidence;
- first-versus-most-recent recording comparison with replay;
- recent completed and unfinished sessions;
- saved Gemini and daily takeaways;
- replay of saved beginner responses;
- export-progress shortcut.

Every metric must carry one of the six exact evidence labels. Do not show
“readiness”, “mastery percentage”, “echo match”, “fluency”, or acoustic quality
claims. Recording comparison should show the saved phrase, date, duration, and
self-rated outcome, not an inferred pronunciation improvement.

Provide first-use/no-history and no-recordings states.

### 9. Settings, profile, backup, and device support

Create a responsive settings/profile screen with:

- name, studies, skill/experience, availability, start date, and motivation;
- daily goal: 15, 30, 60, 90, or 120 minutes;
- system/light/dark appearance;
- Paper, Contrast, and Night theme examples;
- time zone, German device voice, read-aloud speed, English support preference;
- Start speaking/Workplace path;
- AI Talk voice and A2/B1 preference;
- export progress and import progress;
- optional profile/preferences import consent;
- remove saved audio while retaining history;
- add to home screen;
- legacy/pre-upgrade backup download where present;
- explanatory note that audio is not included in progress exports.

Show voice unavailable, storage unavailable, import conflict, import success,
audio deletion confirmation, and install-not-available states.

### 10. AI Talk, Gemini, and assessments

Create an AI Talk lobby showing:

- gateway configured/missing;
- provider configured/missing;
- locked/unlocked status;
- usage counters and limits;
- owner access code entry;
- lock/unlock and model-check actions;
- setup recovery guidance;
- workplace situation and A2/B1 selection;
- optional profile facts with explicit consent;
- saved conversation reopening;
- separate Gemini Companion entry that requires no gateway.

Create AI Talk conversation states for:

- partner opening, learner turn, partner reply;
- English meaning where enabled;
- local recording before sending;
- explicit `Send to partner` action;
- typed fallback labelled `Typed — not speaking evidence`;
- replay/slower/rephrase/hint;
- provider error, quota, network failure, and uncertain receipt recovery;
- end-and-review state labelled `Not a score`.

Create the Gemini lesson-pack screen with selected context, target level,
Guided/Less help, optional profile facts, editable preview, copy, text download,
share, desktop-to-phone handoff, Gemini Live instructions, takeaway form, and
self-reported Gemini minutes. Exporting must not complete or grade a lesson.

Create the Checks area with Practice/Checkpoint mode, objective checks, writing,
roleplays, search/filter, contextual lesson entry, and saved attempts. Create
objective-run, writing-run, roleplay-run, and result states covering drafts,
pause, submit/seal, empty answers, answer-help conditions, partial evidence,
local answer keys, AI estimate, Gemini import, invalid report, and receipt
recovery. A missing grade or failed provider must never appear as zero.

### 11. How progress works

Create a calm trust-building page explaining:

- the six evidence labels;
- what counts as measured practice;
- what self-rating means;
- why typed answers are not speaking evidence;
- why revealing a model changes the attempt conditions;
- what AI estimates and imported Gemini reports mean;
- how the forgiving streak and rest days work;
- why metrics describe this device and are not a language certificate.

Do not turn this page into an upsell or achievement wall.

## Cross-cutting state board

Alongside the primary screens, generate a reusable state board with component
examples for:

- app boot and course-pack loading;
- route loading;
- draft saving, saved, and save failed;
- recording loading/missing;
- microphone denied/unavailable;
- no German device voice;
- browser storage unavailable;
- no matching lessons/words/phrases/resources/assessments;
- no saved conversations, recordings, or history;
- no due reviews;
- external resource unavailable;
- Tatoeba request failed/no result;
- AI gateway unavailable, quota, cooldown, and uncertain network receipt;
- invalid Gemini report;
- conflicting progress import;
- offline/local versus online/local action availability.

Each state needs a short explanation and a useful next action. Never use a blank
error page.

## Accessibility and responsive requirements

Provide desktop frames at approximately 1440px wide and mobile frames at
390–412px wide. Also show the narrowest layout where navigation, German text,
record controls, and bottom navigation remain usable.

The designs must include:

- visible keyboard focus states;
- meaningful labels for icon-only audio, save, record, and navigation controls;
- no status communicated by color alone;
- readable German text with English support clearly secondary or on demand;
- safe-area spacing for installed Android PWA use;
- reduced-motion variants for pulse, glow, waveform, and celebration effects;
- light Paper and Contrast variants as well as Night/dark;
- no content hidden behind fixed headers or bottom navigation;
- recording state understandable without relying on sound or animation;
- large enough controls for touch and switch/keyboard navigation.

Do not use tiny decorative labels as the only explanation of an action. Keep the
main action visually dominant and progressively disclose secondary controls.

## Asset generation request

Generate and deliver an implementation-ready asset package for a local-first,
offline-capable web app. Do not leave
Google-hosted image URLs, `data-alt` placeholders, or CDN-only dependencies in
the final handoff.

### Brand and PWA assets

Create these files using the Electric Slate Sprich mark: an electric-lime
speech/soundwave `S` on a full-bleed deep obsidian background. The icon itself
must fill the canvas; do not put a white border, rounded container, shadow
container, or separate squircle around it.

- `icon.svg` — scalable browser icon;
- `favicon-32.png` — 32×32 favicon;
- `favicon-48.png` — 48×48 favicon;
- `apple-touch-icon.png` — 180×180;
- `icon-192x192.png` — Android/PWA icon;
- `icon-512x512.png` — Android/PWA icon;
- `icon-maskable-512x512.png` — maskable icon with safe-area padding;
- `shortcut-today.png` — 96×96;
- `shortcut-words.png` — 96×96;
- `shortcut-workplace.png` — 96×96.

For each raster asset, provide the source SVG or editable vector and confirm
that it remains legible at small sizes. Supply light-background preview sheets
so transparent/edge problems are visible.

The final handoff must include a manifest-ready mapping for a production web
manifest. Include the exact relative URL for every icon, shortcut, theme color,
background color, display mode, and start destination. Do not provide only a
visual asset sheet.

### Optional contextual imagery

If imagery is retained, generate a small, consistent set rather than unrelated
stock photos:

- one bakery/counter scene;
- one friendly baker or conversation partner avatar;
- one neutral speaking-practice companion illustration;
- one vocabulary/context still-life image if needed.

For every image provide:

- WebP at 1× and 2× sizes;
- a low-bandwidth fallback or CSS-only fallback;
- a concise accessible alt-text recommendation;
- crop guidance for desktop and mobile;
- source/license/attribution information;
- confirmation that no recognisable real person, third-party logo, or publisher
  branding is embedded.

The app must remain fully understandable when all imagery is unavailable or
disabled. Do not make the bakery scene, avatar, or companion a required source
of meaning.

### Typography and icon dependencies

If Space Grotesk, Plus Jakarta Sans, or Material Symbols are used, provide an
offline-safe font/icon plan:

- local WOFF2 files and a license/source note; or
- a documented system-font and inline-SVG fallback.

Do not rely on Google Fonts, Tailwind CDN, or Material Symbols CDN for the
offline core experience.

### Do not reuse unrelated artwork

Do not use any artwork branded for another product or containing unrelated
social, subscription, competitive, or scale claims. If an external reference
image is shown during the Stitch process, label it as inspiration only and do
not include it in the Sprich handoff.

## Required output from Stitch

Return the following named deliverables:

1. `01-shell-and-today-desktop`
2. `02-shell-and-today-mobile`
3. `03-lessons-path-and-overview-desktop`
4. `04-lessons-path-and-overview-mobile`
5. `05-beginner-session-state-set`
6. `06-words-library-and-word-session`
7. `07-phrase-collection-and-shared-capture`
8. `08-workplace-library-and-session`
9. `09-resource-library-and-guided-activity`
10. `10-progress-and-evidence-desktop`
11. `11-progress-and-evidence-mobile`
12. `12-settings-profile-and-backups`
13. `13-ai-talk-and-gemini-handoff`
14. `14-checks-runs-and-results`
15. `15-how-progress-works`
16. `16-cross-cutting-state-board`
17. `17-brand-and-pwa-asset-sheet`
18. `18-contextual-asset-sheet`

For every frame, include:

- frame name and route/state name;
- desktop/mobile breakpoint assumptions;
- primary action and secondary actions;
- evidence/provenance labels;
- offline/online requirement for each network-sensitive action;
- empty/loading/error behavior;
- accessibility notes;
- which text is canonical product copy versus replaceable fixture data.

Provide the generated UI as editable Stitch frames plus a compact handoff sheet
of tokens, component variants, icon names, asset filenames, and interaction
states. Do not provide only screenshots.

## Acceptance checklist

The follow-up is complete only when:

- every required area in this request has a frame or an explicitly documented
  progressive-disclosure state: Today, Lessons, lesson overview, beginner
  session, Words, word session, phrase collection, phrase capture, Workplace,
  workplace session, Resources, resource activity, Progress, Settings, AI Talk,
  Gemini handoff, Checks, assessment runs, assessment results, and How progress
  works;
- Today, Lessons, Words, Progress, Workplace, Resources, AI Talk, Gemini,
  Checks, Settings, and How progress works are all reachable in the shell;
- Workplace and Progress are distinct screens;
- the full beginner session and workplace session are represented, not only the
  first step;
- first visit, empty, loading, error, save-failed, offline, and recovery states
  are represented;
- no frame contains pronunciation scoring, XP, social comparison, CEFR claims,
  readiness claims, echo-match claims, or unsupported mastery percentages;
- every number has a truthful evidence label;
- all external/network-dependent actions visibly communicate their requirement;
- Paper, Contrast, and Night themes are represented;
- reduced-motion and keyboard-focus behavior is documented;
- PWA icons and shortcut assets are supplied at the required sizes;
- the final asset URLs are same-origin/offline-capable and manifest-ready;
- no unrelated product artwork or unlicensed remote image URLs remain in the
  handoff.
