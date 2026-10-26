# Sprich

**Start speaking German with one small conversation at a time.**

Sprich is a free, local-first German speaking trainer for everyday life, university, and work. It has short lessons, useful words, workplace situations, optional recording, and a manual Gemini handoff.

- No account or subscription.
- No API key needed for the core app.
- Progress stays in your browser.
- Works on Windows, macOS, Linux, and Android.

## Start in five minutes

You need [Node.js 22.13+ or 24+](https://nodejs.org).

```powershell
npm install
npm run dev
```

Open **http://localhost:8080/**. Do not double-click `app/index.html`; the app needs a real server for browser modules and storage.

On the first launch, use **Start here**. It explains the app, free audio, the small daily routine, and the optional Gemini handoff.

## Your first practice session

1. Stay on **Today** and keep **Start speaking · near-beginner** selected.
2. Press **Hear and repeat**. Say the sentence once.
3. Start the recommended guided lesson.
4. Try each answer aloud before revealing the model. Recording is optional.
5. Choose **Needed help** when you needed help. Honest answers make reviews useful.
6. Learn or review five words, then save one takeaway.

That is enough for a day. A small finished session beats a perfect plan you never start.

For the shortest routine, see [Start small](docs/START_SMALL.md). For the fuller walkthrough, see [Start speaking](docs/START_SPEAKING.md).

## What is included

- **Beginner course:** 48 lessons, 250 useful words, model conversations, sentence patterns, guided replies, and repeatable variations.
- **Workplace practice:** interviews, appointments, meetings, small talk, describing problems, and other practical missions.
- **Words:** recognition, spoken recall, sentence use, audio, articles, and plurals.
- **Progress:** measured practice time, due reviews, takeaways, a forgiving streak, and export/import backups.
- **Offline-friendly core:** course content and saved practice work locally after the app has been opened online once.
- **Accessible practice:** keyboard navigation, readable themes, visible focus, and honest labels for measured, checked, self-rated, reported, and AI-generated evidence.

Nothing is locked. Lesson levels describe the task, not your ability.

## Optional Gemini practice

Open a lesson and choose **Export for Gemini**. Sprich builds the practice pack locally; no Gemini API key or Sprich gateway is needed.

- Copy the pack into a normal Gemini chat.
- Ask Gemini to start the warm-up and ask one short German question at a time.
- On your phone, use **Live** if it is available for your account and device.
- Ask for one sentence you said, one useful correction, one thing to practise, and one new word with its meaning.
- Return to Sprich and save the takeaway.

See [the Gemini walkthrough](docs/START_SPEAKING.md#take-the-lesson-to-gemini) and [the assessment guide](docs/ASSESSMENTS.md) for graded roleplays.

## Optional AI Talk and audio APIs

The core app works without this. AI Talk is a self-hosted push-to-talk conversation that sends audio only when you press **Send**.

```powershell
npm run ai:access
npm run ai:gateway
```

Unlock AI Talk with the generated owner code. AI Talk and **Settings** both link to **Save your own audio key**. Choose **Groq** or **ElevenLabs**, follow the official key link shown in the form, paste the key, and choose **Save this provider key**.

Keys are sent only to your local gateway and stored through the OS keychain using `@github/keytar` (Windows Credential Vault, macOS Keychain, or Linux Secret Service). They are cleared from the form after saving and never placed in browser progress or exports. Hosted gateways use their platform secret manager instead.

The app defaults to free device speech. Add German voice data in your device settings if needed.

See [Free setup](docs/FREE_SETUP.md) for Groq, optional natural ElevenLabs speech, HTTPS hosting, quotas, and troubleshooting. See [TTS verification](docs/TTS_SETUP_VERIFICATION.md) for implementation boundaries and remaining live-provider checks.

## Install on Android

Build and preview the production app:

```powershell
npm run build
npm run preview
```

Upload `dist/` to an HTTPS static host, open it in Chrome, then choose **Install app** or **Add to Home screen**. Open **Today** once while online so the course can be cached.

For optional AI Talk on a phone, host the app and gateway together. The steps are in [Free setup](docs/FREE_SETUP.md#4-optional-free-https-hosting-for-android).

## Back up your progress

Use **Settings → Export progress** to move progress between browsers or devices. Importing the same file twice is safe. Recordings and cached voice clips stay on the device where they were made.

Browser storage belongs to the exact address, so `localhost:8080`, `127.0.0.1:4173`, and a hosted site have separate progress. Export/import is the way to move between them.

## For contributors

Run the complete project check with:

```powershell
npm run verify
```

Useful individual checks:

```powershell
npm test
npm run lint
npm run build
npm run test:e2e
npm run check:openapi
npm run deploy:check
```

The browser tests use desktop and Pixel 7 Chromium with a synthetic microphone. They do not use your microphone or live provider accounts.

Project map:

| Path | Purpose |
| --- | --- |
| `app/data/` | Lessons, missions, phrases, resources, and curriculum |
| `app/public/course/` | Versioned beginner course packs |
| `app/js/` | Views, storage, sessions, speech, progress, and exports |
| `shared/` | Shared AI and assessment contracts |
| `worker/` | Optional AI gateway and provider adapters |
| `tools/` | Local gateway, access-code, and validation tools |
| `tests/` | Unit and browser tests |
| `docs/` | Setup guides, architecture, research, and detailed behavior |

For deeper technical context, see [Architecture](docs/ARCHITECTURE.md), [Learning model](LEARNING_MODEL.md), [Research notes](RESEARCH.md), and [Assessments](docs/ASSESSMENTS.md).
