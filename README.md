# Sprich — Start speaking German

A free German speaking trainer with a browser-based core. Short lessons, 250 useful words, workplace practice, checked exercises, and lesson packs for spoken conversations with Gemini on your phone.

No account, no subscription, no API key needed for the core app. Your progress stays on your device.

Works on Windows, macOS, Linux, and Android (install it like an app from Chrome).

---

## Quick start

You need [Node.js](https://nodejs.org) 22.13+ or 24+.

```powershell
npm install     # first time only
npm run dev
```

Then open **http://localhost:8080/** and you're in.

> **Tip:** open it through the server, don't double-click `app/index.html`. The app uses browser modules and storage, which need a real server to work.

---

## Try a lesson in 60 seconds

1. Stay on **Today** with **Start speaking · near-beginner** selected, and hit the recommended lesson.
2. Listen to the first short phrase, then say it back.
3. Learn the words and the sentence pattern behind it.
4. Try three guided replies and one variation. Record yourself if you like — or just confirm you said it out loud.
5. Open **Export for Gemini**, copy the lesson pack, and paste it into a normal Gemini chat. On your phone, use **Live** for a real spoken conversation.
6. Come back and save one phrase you liked.

That's the core loop: **learn a little → say it out loud → talk to Gemini → save what worked.**

A full walkthrough lives in [docs/START_SPEAKING.md](docs/START_SPEAKING.md).

---

## What's inside

**The course**
- **48 lessons** across 12 modules and 5 stages: first conversations, talking about yourself, everyday needs, time and plans, getting around, shopping, home and paperwork, health, social talk, university, and your first work conversations.
- Every lesson is tagged by **level** (Starter → A1 → A2 → B1), **topic**, and **speaking skill**, so you can always find something at your level. Nothing is locked — jump anywhere you like.
- Each lesson gives you a model conversation, 5–8 key words, 1–2 sentence patterns, three guided replies, and variations to practise again.
- Eight short **language notes** cover the grammar that actually matters: question words, verb position, numbers and time, negation, modals, separable verbs, past tense, and dative pronouns.

**Practice modes**
- Start any lesson **Guided** (English help always visible) or with **less help** (answers hidden until you ask).
- Record your voice, replay it, and download it. Lesson recordings stay local; AI Talk sends a clip only when you choose Send.
- A **Words** section with 250 entries: meanings, example sentences, audio, articles and plurals for nouns. Practise in small batches by recognition, spoken recall, or writing your own sentence.

**Workplace practice**
- 12 full **missions** for real situations: interviews, calling about a vacancy, making appointments, describing problems, small talk, meetings, and a mock interview.
- 120 curated phrases, 36 bilingual dialogues, and 108 comprehension questions.
- Six-stage paths for each mission, with a short version when you're short on time.

**Everyday tools**
- The quiet navigation keeps **Today · Lessons · Words · Progress** visible; less-frequent destinations live under **More**.
- **My path** tells you what to do next and why. **All lessons** lets you filter by level, topic, skill, or status.
- A daily queue that hands you one mission, your due reviews, a resource, and a reflection — sized to whatever time budget you set.
- 15 curated German learning resources (Nicos Weg, Easy German, Slow German, Goethe, VHS Deutsch Beruf, and more) with guided follow-up tasks.
- Personal phrase book, bookmarks, keyboard navigation, and progress export/import.
- Three visual choices: warm **Paper**, high-legibility **Contrast**, and low-glare **Night**. Choose them in **More → Settings**.
- Calm effort rewards: a measured daily goal, a forgiving streak, a seven-day strip, and one next milestone. Rewards count practice activity, not language ability or assessment grades.

**Checks and grades**
- Open **Lessons → Checks & grades**, or choose the graded-roleplay link on a lesson.
- **60 pilot questions** check vocabulary, grammar, reading, and constrained writing with authored answer keys. Choose practice with recorded help, or a checkpoint with answers shown afterward.
- Four short writing tasks and graded roleplay variations use a five-part rubric. The app calculates the score from the marks and shows the evidence and corrections.
- Every published lesson and workplace mission has two graded-roleplay variations. Use the in-app gateway or a Gemini pack, then import Gemini's report.
- Results clearly distinguish **Checked locally**, **AI estimate**, and **Imported Gemini assessment**. They do not award a CEFR level or pronunciation score, and do not automatically add SRS mastery.

Regular lesson speaking remains self-rated. The graded checks are a separate view of a specific submitted task. See [the assessment guide](docs/ASSESSMENTS.md).

### The forgiving streak

A day qualifies after **15 minutes of measured in-app practice**. Six qualifying days earn one rest day, with at most two rest days banked. One missed day can spend a banked rest day; two missed days in a row end the streak. A streak is a gentle routine reminder, not a measure of German ability.

---

## AI features

### Gemini Companion (no setup needed)

Pick any lesson or workplace mission, hit **Export for Gemini**, and you get a ready-made pack: vocabulary, examples, and roleplay instructions.

- On a **computer**: paste it into a Gemini chat.
- On your **phone**: share the pack directly, open the same chat, and tap **Live** to actually talk.
- Come back to Sprich and save one takeaway from the conversation.

This needs no gateway, no API key, and no configuration.

For a numerical task grade, choose **Use a graded roleplay**. The graded pack includes the target level, goals and rubric. After Live, ask Gemini for the report in text, paste it into Sprich, choose **Check report**, then **Save imported grade**. Sprich checks identities, quotations where it has the original text, and arithmetic; an imported Live report remains an external claim.

### AI Talk (optional, self-hosted)

A push-to-talk conversation with an AI partner that replies out loud. Your audio is only sent when you press **Send**. Setup takes about five minutes — see the [free setup guide](docs/FREE_SETUP.md).

```powershell
npm run ai:access     # creates your owner code and secrets
npm run ai:gateway    # starts the local gateway on port 8787
```

Paste the owner code into **Unlock AI Talk** in the app. Your provider key stays on your own machine, and everything that doesn't involve AI keeps working even without it.

---

## Using the microphone

- Recording needs **HTTPS or localhost**. A plain `http://192.168.x.x` address on your phone won't work — use a hosted URL or keep it on your computer.
- Read-aloud uses an installed German system voice. If you don't have one, add German under your device's speech settings.
- **Settings → AI Talk voice** lets you add a free ElevenLabs voice, test it, and fall back to your device voice.
- No mic or no voice? Use the reading alternative and practise aloud — the app labels it honestly as reading, not speaking.

Full details: [docs/FREE_SETUP.md](docs/FREE_SETUP.md) · [docs/TTS_SETUP_VERIFICATION.md](docs/TTS_SETUP_VERIFICATION.md)

---

## Install it on your phone

```powershell
npm run build
npm run preview      # check it at http://127.0.0.1:4173/
```

Upload the `dist/` folder to any free static host (GitHub Pages, Netlify, Cloudflare Pages). No server, no database, no API key.

Then on Android: open the URL in Chrome → menu → **Install app**. Open **Today** once while online so the course downloads. Open the checks you want once too: their content and optional assessment code are cached for offline use. AI grading still needs a connection.

To add AI Talk on mobile, host the app and gateway together on Cloudflare Workers Free — steps are in [the setup guide](docs/FREE_SETUP.md#4-optional-free-https-hosting-for-android).

---

## Moving progress between devices

**Settings → Export progress** saves your attempts, timings, unfinished sessions, personal phrases, bookmarks, AI takeaways, assessment submissions and grades. Import it on the other device.

Importing is safe to repeat — attempts merge by ID, so you never get double credit. Audio recordings stay on the device they were made on; download individual clips during a session if you want to keep them.

Submitted assessment answers are sealed. Repeats create new attempts; conflicting submissions or unsent roleplay answers are reported during import rather than silently overwritten.

One thing to remember: browser storage belongs to the exact address you're on. `localhost:8080`, `127.0.0.1:4173`, and a hosted site all have separate storage, so use export/import to move between them.

Old data from version 2.0 (`deutsch-trainer-v1`) is picked up automatically if it's on the same address.

---

## For contributors

Every check in one go:

```powershell
npm test             # unit tests
npm run lint         # ESLint
npm run build        # production build (150 KiB gzip budget for initial JS/CSS)
npm run test:e2e     # Playwright browser tests
npm run check:openapi
npm run deploy:check # dry-run of the Worker bundle
```

Browser tests run in Edge/Chromium (installed on this machine) with desktop and Pixel 7 layouts, using a synthetic microphone — never yours. Optional live resource checks: `npm run check:resources`.

Test suites cover data migration, review spacing, dates/DST, recordings, offline reloads, all 48 lessons and 250 words, every mission/dialogue combination, and the AI gateway's auth, quotas, and error contracts.

Assessment checks also cover accepted German forms, partial credit, frozen submissions, cross-device conflicts, quoted evidence, shared review quotas, receipt recovery, Gemini imports, and all 120 lesson-derived roleplay variants. Provider fixtures prove the software contract, not live grading accuracy. `dist/asset-budget.json` lists initial versus on-demand assets; opening assessments or AI Talk caches the optional feature code.

### Where things live

| Path | What it does |
| --- | --- |
| `app/data/` | Course content: missions, phrases, resources, curriculum |
| `app/public/course/` | Versioned content packs (48 lessons, 250 words) |
| `app/public/assessments/` | Four pilot packs: 60 keyed items, four writing tasks, four roleplays |
| `shared/assessment-*.js` | Assessment validation, rubric definitions, scoring, hashes, and manifests |
| `app/js/assessment-*.js` | Immutable assessment state, evidence, jobs, loaders, and Gemini protocol |
| `app/js/` | App logic: views (`v-*.js`), storage, sessions, speech, rewards, export |
| `shared/ai-contracts.js` | Limits and schemas shared by browser and gateway |
| `worker/` | The optional AI gateway (routing, auth, quotas, providers) |
| `tools/` | Owner-code generator, local gateways, source checks |
| `tests/` | Unit and Playwright browser tests |
| `docs/` | Guides and design notes |

### Further reading

- [Architecture](docs/ARCHITECTURE.md) · [Learning model](LEARNING_MODEL.md) · [Research notes](RESEARCH.md)
- [Course release notes](docs/ITERATION_5.md) · [Resource catalog](docs/RESOURCE_CATALOG.md)
- [AI build brief](docs/AI_BUILD_BRIEF.md) · [Iteration history](docs/ITERATION_2.md)
- [Assessments and grading](docs/ASSESSMENTS.md) · [Grading architecture](docs/ASSESSMENT_IMPLEMENTATION.md)
