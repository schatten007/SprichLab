# Sprich 2.3 · Start speaking German

A free, local-first German trainer with a classified 48-lesson speaking course, a recommended path, 250 useful words, and workplace practice. Learn a small lesson, then export it for a natural Gemini conversation on your phone. Built for Windows and Android.

## Start on this computer

Use Node.js 22.13+ (22.x LTS) or Node.js 24+. Dependencies have been installed in this workspace.

```powershell
npm run dev
```

Open **http://localhost:8080/**. For a fresh copy of the project, run `npm install` first.

Use the server URL rather than double-clicking `app/index.html`: the app uses JavaScript modules and browser storage.

## Start practising

1. On **Today**, keep **Start speaking · near-beginner** selected and start the recommended lesson.
2. Hear and say the first short phrase, then learn the words and sentence patterns.
3. Try three guided replies and a small variation. Record if you want, or confirm you practised aloud.
4. Open **Export for Gemini**. Copy the lesson pack, download it as `.txt`, or use your phone’s share menu.
5. Paste it into a normal Gemini chat and use **Live** on your phone. Return to save one useful takeaway.
6. Open **Lessons → My path** to see your stage and what comes next, or **All lessons** to filter by level, topic, speaking skill, and status.
7. Use **Words** to learn small batches and review meanings, spoken recall, or your own sentences.
8. Choose **Workplace course · A2–B1** on Today or in Settings when you want the longer interview/workplace missions.

See the [short Start Speaking guide](docs/START_SPEAKING.md). Beginner lessons always show English support. Every lesson can be started **Guided** or with **less help**; both record support the same way. Revealing an answer model is recorded as assistance.

Beginner lessons offer a roughly 10–15-minute speaking loop, plus optional word reviews and Gemini practice. The workplace path retains the configurable daily budget and short-mission option. Time is measured from active in-app practice; Gemini minutes are separately self-reported.

## What is included

- **48 lessons** in twelve modules and five path stages: first conversations, talking about yourself, everyday needs, time and plans, getting around, shopping and services, home and administration, health and appointments, social conversations, university and people, first work conversations, and university/work bridges.
- Every lesson is classified by **level** (Starter, A1, A2, B1), **topic**, **speaking skill**, and advisory **preparation**. Levels describe the task, not a claim about you.
- **My path** shows your stage, one recommended next lesson with a plain reason, and per-stage progress. **All lessons** filters by level, topic, skill, status, and search. Nothing is locked.
- **250 starter vocabulary entries**, each with English meaning, an example and its translation, audio controls, and useful forms. Nouns include articles and plurals or a singular-only note.
- Each lesson has 5–8 word targets, 1–2 sentence patterns, a bilingual model conversation, three guided replies, and two variations. The 24 newer lessons have **two** model conversations, and practising again uses the other one.
- Eight short **language focus** notes: question words, verb position, numbers and times, negation, modal verbs, separable verbs, the perfect tense, and dative pronouns.
- Start any lesson **Guided** or with **less help**, which keeps the English meaning and model hidden until you ask.
- A **Words** section with search, topics, word types, saved words, five-word learning batches, and separate recognition/spoken-recall/sentence-use practice.
- **Lesson-specific Gemini packs** from the path, lesson overviews, active lessons, workplace missions, and the companion selector: level target, help setting, editable preview, optional selected profile facts, copy, UTF-8 `.txt` download, and native share where supported.
- Beginner progress, word reviews, and Gemini takeaways included in progress transfer. Versioned course packs are cached per pack for offline use.
- Twelve complete missions covering interviews, vacancy calls, appointments, availability, instructions, updates, problems, small talk, projects, meetings, requests, and a mixed mock interview.
- 120 distinct curated phrases, three original bilingual dialogues per mission, and 108 checked comprehension questions in total.
- A flexible six-stage path with normal and short routes for every mission.
- Contextual follow-ups for availability, job enquiries, and appointment confirmations.
- Microphone recording, replay, download, and an optional separate dictation tool.
- Model answers, explicit self-assessment, and a second speaking attempt.
- Checked listening questions with separate reading-supported results.
- Spaced recall and independently reported spoken-use evidence on different days.
- Resumable sessions, draft recovery, measured active time, and seven-day progress.
- Light/dark appearance, keyboard-accessible controls, and Android-sized layouts.
- Progress export/import for moving between devices.
- Fifteen curated German resource activities with access, level, registration, transcript, and voice-type information.
- Resource search/filtering, bookmarks, difficulty ratings, and alternatives for inaccessible or difficult sources.
- Personal phrases with English meanings, your own examples, and source links. Repeated saves merge; saving a phrase already in the course preserves your annotation without duplicating its recall identity.
- A persistent daily queue that assigns a mission, due reviews, a suitable source, a retry, and a reflection within the selected budget.
- **AI Talk**: an optional push-to-talk conversation with a real partner reply, sent only when you choose Send, plus a short grounded review that never becomes a score. See [AI Talk](#ai-talk-and-gemini-companion).
- **Gemini Companion**: a no-gateway card with a copyable practice brief for a Gemini voice conversation on your own phone, plus a manual reflection you keep in Sprich.
- An installable offline-capable production web app.
- The original vocabulary/chunk reference under **Words → Useful phrases & your own collection → More reference words**.

The lessons use authored conversations and explicit self-assessment. Checking comprehension, recalling a meaning, repeating a model, and speaking independently are different kinds of practice. There is no automatic grammar/pronunciation score or inferred CEFR level. Starter lessons, vocabulary, and Gemini export need no API key; AI Talk has its own optional gateway.

## German resources and guided activities

Open **http://localhost:8080/#resources**. The catalog includes DW Nicos Weg and Deutschtrainer, VHS Deutsch Beruf, Goethe resources, Easy German, Slow German, and the Bundesagentur für Arbeit.

1. Filter by topic/search, level, format, practice time, text support, or registration needs.
2. Open **View guided activity** to see a concrete follow-up task and access details.
3. Start the activity, visit the publisher, then return to record or write your own response.
4. Save useful phrases, with their meaning and your own example, for later spoken recall.
5. If a source is too difficult or unavailable, use a suggested alternative or the matching in-app mission.

Opening a link alone cannot complete an activity. A saved written response or recording is required. These resource artifacts are unscored practice; self-reported publisher-study minutes are separate from measured active time.

Live checks on **2 October 2026** reached ten source pages and confirmed muted media playback for five specific lessons/episodes. Four Goethe pages and the selected YouTube page restricted automated access. Their cards show the need for a manual check, and they are excluded from automatic daily assignments. They may still work in your normal browser. See [the source catalog and check results](docs/RESOURCE_CATALOG.md).

## Voice and microphone

**Start here:** [Short free setup guide: German device voices, Groq, optional ElevenLabs, and Android hosting](docs/FREE_SETUP.md).

- Recording uses `MediaRecorder` and saves audio in this browser's IndexedDB.
- Read-aloud defaults to an installed German system/browser voice. Add German in your device's speech settings if necessary. Automatic selection prefers installed voices.
- **Settings → AI Talk voice** offers optional ElevenLabs Free speech, a test button, cached replay, slower playback, and device-voice fallback.
- Some voices and browser dictation services require internet. Dictation may send audio to the browser provider.
- Microphone recording requires **HTTPS** or **localhost**. Opening a desktop LAN address over plain HTTP on your phone does not meet that requirement.
- If recording or read-aloud is unavailable, use the reading alternative and practise aloud. The app labels this evidence appropriately.

## AI Talk and Gemini Companion

Open **http://localhost:8080/#ai**.

**Gemini Companion needs no gateway.** Choose any beginner lesson or workplace mission to export its own vocabulary, examples, and roleplay instructions. On a computer, paste the pack into a normal Gemini text chat; open the same chat on your phone and tap Live. On a phone, copy/share the pack directly. Export saves and stops active lesson recording first. Return to save a takeaway, shown in Progress as self-reported outside practice.

**AI Talk needs a small gateway you run yourself.** Provider keys stay on that server, and model/provider selection is fixed there. The page calls `/api/v1/*` on its own origin. Follow the [free setup guide](docs/FREE_SETUP.md) for the account, secrets, and two-terminal setup.

```powershell
npm run ai:access
npm run ai:gateway
```

`ai:access` prints a 43-character owner code plus the `OWNER_TOKEN_HASH` and `SESSION_SECRET` values to put in `.dev.vars` (start from `.dev.vars.example`), together with a `GROQ_API_KEY` and `GROQ_FREE_TIER_CONFIRMED=true`. `ai:gateway` serves `http://127.0.0.1:8787`, and Vite proxies `/api` to it in both `npm run dev` and `npm run preview`. Paste the owner code into **Unlock AI Talk**.

- Your answer is sent only when you choose **Send**. Clips are at most 60 seconds and 1.5 MB. Optional natural-voice playback separately sends the text to speak through the gateway.
- Typed answers work as well and are labelled as never counting as speaking.
- An interrupted reply keeps its request ID and offers **Check for my reply** instead of generating the answer twice.
- The review quotes your own words or withholds a correction, and is labelled "not a score".
- With no credentials, AI Talk only reports what is missing; every offline lesson and resource is unaffected.

`npm run ai:gateway:test` runs a test-mode gateway (mock provider, in-memory database, fixed test-only code, loopback only) for the automated checks. The interface always labels it as a test provider. `npm run deploy:check` runs `wrangler deploy --dry-run` to confirm the Worker bundle without deploying anything.

## Build and use on Android

```powershell
npm run build
npm run preview
```

Preview is normally at http://127.0.0.1:4173/. The production files are in **`dist/`**. Upload that directory to an HTTPS static host such as GitHub Pages or Netlify. No application server, API key, or database service is needed.

To include AI Talk, deploy the app and gateway together on Workers Free + D1 using the [Android hosting steps](docs/FREE_SETUP.md#4-optional-free-https-hosting-for-android). A static-only upload serves the core course and Gemini Companion.

On Android, open the hosted URL in Chrome and use **Install app / Add to Home screen**. Let the first online load finish and open Today, Lessons, or Words once to save the beginner course pack. The built app caches its shell and core workplace exercises; the starter pack lives in IndexedDB. External websites and online speech services still need a connection. Offline shell caching is enabled in the production build, not the development server.

The app uses relative asset paths and hash routes, so a static-host subdirectory is supported. Hosting/deployment is not performed automatically by the development commands.

## Progress and backups

In **Settings**, choose **Export progress**. Import that JSON file on your other device. Re-importing a file merges attempts by ID without awarding duplicate results. Importing a newer checkpoint also preserves the longer measured interval instead of counting it twice.

- Exports include your profile, attempts, active-time intervals, unfinished sessions, and any migrated legacy backup.
- Exports also include personal phrases, source bookmarks/difficulty ratings, resource responses, daily assignments/reflections, AI conversations/reviews, companion notes, and the content snapshots needed to resume lessons reliably. Cached generated speech stays on the device.
- Audio blobs are device-local. Download individual recordings during a session if you want to keep or move them.
- Browser storage is tied to the exact origin: host, protocol, and port. `localhost:8080`, `127.0.0.1:4173`, and a hosted HTTPS site have separate storage. Use export/import to move between them.
- Old `deutsch-trainer-v1` data is copied into a legacy backup when present on the same origin. Its unreliable automatic grades and estimated minutes do not become new evidence. The original key is not removed.
- If the old trainer was used at `http://localhost:8080/`, the default development URL matches that origin and can migrate its data. Files opened with `file://` have browser-specific storage; export any old data from that original browser context if needed.
- Earlier progress (schemas 2/3/4) migrates to **schema 5** in the same database. Frozen lesson content, saved answers, AI conversations, and recording keys are preserved. Settings offers a pre-upgrade backup. New beginner sessions, word reviews/bookmarks, and takeaways also merge by stable IDs.

## Checks

```powershell
npm test
npm run lint
npm run build
npm run test:e2e
npm run check:openapi
npm run deploy:check
```

Browser tests run the built app in Microsoft Edge/Chromium with desktop and Pixel 7 emulation. Edge is used because it is installed on this Windows computer. For another environment, change the Playwright channel and install the corresponding browser. Microphone tests use Chromium's synthetic microphone, never your actual microphone.

The checks cover migration, duplicates, review spacing, local dates/DST, persistence, cross-tab updates, meaningful self-assessment rules, a complete mission, recording lifecycle, offline reloads, mobile overflow, and backup import/export. Android emulation checks the layout and Chromium paths; physical-device speech service availability still depends on the phone.

They also validate all 72 mission/length/dialogue combinations, personal/core phrase deduplication, German/English content coverage, daily queue stability, resource completion rules, and old-session snapshots. The build enforces a **150 KB gzip budget for core JavaScript and CSS**. Publisher media is requested only after the learner opens it.

The AI gateway has its own suite (`tests/gateway.test.js`) that runs the real handler against an in-memory database and a mock provider, covering authentication, origin and cookie tampering, quota counters, idempotent receipts, uncertain outcomes, review quote grounding, and the problem-JSON contract. `tests/v-ai.test.js` covers the client's recovery rules, and `tests/browser/ai-talk.spec.js` unlocks, records, sends, and reads a review through the production build against the test gateway.

TTS and setup also have client/voice tests and seven browser flows covering real WAV decoding, cached replay, Stop/Slower, recording handoff, late cancellation, free-tier fallback, and missing-gateway recovery. See the [TTS/setup verification report](docs/TTS_SETUP_VERIFICATION.md) for results and the live checks still pending.

Course checks validate all 48 lessons and 250 words, classification and prerequisite ordering, complete word coverage, two-dialogue alternation, path recommendations, support modes, frozen snapshots, assisted recall, schema migration, duplicate transfers, and per-pack offline loading. Eleven browser flows cover the path view and filters, prerequisite links, a lighter-support lesson, the lesson runner, word practice, correct Gemini exports, cancelled sharing, microphone handoff, and portable takeaways. See [iteration 5](docs/ITERATION_5.md).

For an optional live source check (network-dependent, separate from the tests):

```powershell
npm run check:resources
# Or only selected entries:
npm run check:resources -- nicos-interview dw-phone
```

The check uses a fresh browser context, does not sign in, and tests directly available media muted. A restricted automated request is reported as requiring manual checking, rather than treated as proof the resource is unavailable to every user.

## Code map

| File | Responsibility |
| --- | --- |
| `app/data/missions.js`, `mission-packs/` | Twelve original mission packs and bilingual teaching content |
| `app/data/phrases.js` | Core phrase bank and personal-phrase annotations |
| `app/data/resources.js`, `curriculum.js` | Curated sources, access metadata, and the six-stage path |
| `app/data/legacy-content.js`, `app/js/legacy-session.js` | Frozen 2.0 content used during migration |
| `app/data/starter-catalog.js` | Levels, topics, skills, twelve modules, five path stages, prerequisites, language notes, and the content-pack manifest |
| `app/public/course/*.json` | Versioned content packs: 48 lessons and 250 vocabulary entries |
| `app/js/starter-content.js`, `starter-state.js`, `starter-progress.js` | Course validation/downloads, snapshots, beginner evidence, and mode-specific word scheduling |
| `app/js/v-lessons.js`, `v-words.js`, `starter-ui.js` | Path and library views, lesson runner, daily routine, vocabulary, and reusable cards |
| `app/js/gemini-pack.js`, `gemini-export.js`, `v-gemini.js` | A shared lesson pack builder and copy/download/share handoff |
| `app/js/model.js` | Data validation, time boundaries, import merging, derived progress |
| `app/js/store.js` | IndexedDB transactions and recordings |
| `app/js/draft-journal.js` | Recovery of input typed just before a reload |
| `app/js/srs.js` | Recall scheduling and spaced spoken-use evidence |
| `app/js/session.js` | Resumable task sequences, branching, assessment contracts |
| `app/js/resources.js`, `daily.js` | Resource activity contracts, recommendations, and stable daily queues |
| `app/js/clock.js` | Visible/active practice timing and compact checkpoints |
| `app/js/tts.js`, `recorder.js` | Speech playback, dictation, and recording lifecycle |
| `app/js/v-*.js` | Today, practice, resource workspace, phrases, session, progress, settings, and AI Talk views |
| `app/js/ai-gateway.js`, `ai-state.js` | The only browser client for `/api/v1`, and conversation/draft/review state |
| `app/js/ai-speech.js` | Cancellable natural speech, IndexedDB audio caching, and German device-voice fallback |
| `shared/ai-contracts.js` | Limits, model IDs, JSON schemas, and validators shared by browser and gateway |
| `worker/` | The optional AI gateway: routing, auth, quotas, providers, prompts, OpenAPI contract |
| `tools/` | Owner-code generator, local/test gateways, mock provider, source checks |
| `vite.config.js` | Build, versioned/scoped offline asset cache, and the `/api` proxy |
| `practice.html` | Original standalone Ausländerbehörde trainer |

See [LEARNING_MODEL.md](LEARNING_MODEL.md), [RESEARCH.md](RESEARCH.md), [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), and [the course path release notes](docs/ITERATION_5.md).
