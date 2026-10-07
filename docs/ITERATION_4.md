# Iteration 4 · Start Speaking (Sprich 2.2)

Superseded by [iteration 5](ITERATION_5.md), which classified every lesson, added a recommended path, and grew the course to 48 lessons and 250 words. The notes below describe the 2.2 release.

## Delivered

The entry point now supports a learner who is near-beginner in speaking. Today defaults to a small starter lesson; the workplace course is selectable from Today, Settings, and Lessons.

| Unit | Lessons | Vocabulary entries |
| --- | ---: | ---: |
| First conversations | 4 | 25 |
| Talking about yourself | 4 | 25 |
| Everyday needs | 4 | 25 |
| Time and plans | 4 | 25 |
| University and people | 4 | 25 |
| First work conversations | 4 | 25 |
| **Total** | **24** | **150** |

Every lesson has a bilingual warm-up, 5–8 target words, 1–2 sentence patterns with English explanations, a 4–8-line model conversation, three guided replies, and two variations. Each of the 150 vocabulary entries is referenced by a lesson. Completed lesson repetitions alternate the final variation.

The three pilot lessons were greetings/names, asking for repetition, and ordering a drink. The same tested runner now serves all 24 lessons.

## Vocabulary and evidence

- Searchable Words section with topic/type filters, saved words, word and sentence audio, meanings, examples, and useful forms.
- Nouns carry their article and plural or a singular-only note; verbs carry usable spoken forms.
- New batches contain at most five words; due-review batches contain at most ten.
- Recognition, aloud recall, and sentence use have separate evidence and schedules, using the existing spaced-review algorithm.
- Early answer reveal is marked assisted. A typed answer is not independent spoken recall. Results are self-rated, not automatic language grades.

## Gemini handoff

A shared pack builder produces the selected lesson’s vocabulary, meanings, patterns, conversation, questions, and variants. It is available from beginner overviews and sessions, workplace missions, and the Gemini companion’s lesson selector.

The export offers an editable preview, optional explicit profile-field selection, copy, UTF-8 `.txt` download, and native share where available. Clipboard/share errors leave a manual-copy/download path; cancelling share leaves the pack intact. Export flushes and stops active lesson recording without grading it.

The computer-to-phone workflow is a normal Gemini text chat followed by Live in the same chat on the phone. Return notes are shown in Progress with self-reported outside-practice minutes. No AI provider key or AI gateway is needed for export.

## Persistence and offline architecture

- Progress schema **5**; IndexedDB version **4** adds `coursePacks`.
- Older schema 2/3/4 progress is upgraded with a pre-upgrade backup. Existing mission and AI records remain available.
- `starter` holds lesson sessions, word sessions/reviews, saved-word markers, and stable daily assignments.
- Lesson and word sessions store frozen content. Immutable results merge by ID, while newer cursors/drafts and completed work are preserved.
- The synchronous pending-draft journal covers beginner and word drafts as well as workplace drafts.
- The starter JSON pack downloads separately and is validated and cached in IndexedDB. It does not inflate the initial JS/CSS bundle or progress exports. Production shell caching plus the downloaded pack supports offline use.
- Measured active time uses the existing visibility/idle-aware clock. Gemini notes and exports do not create SRS or pronunciation evidence.

## Verification

- **115 Node tests passed**, including eleven starter content/state/export tests.
- **82 browser tests passed**, across desktop and Pixel 7 Chromium emulation. The nine starter flows cover a full lesson, correct text export, vocabulary assistance, offline reload, the complete library, selected Gemini context/takeaways, immediate-reload drafts, microphone handoff, and cancelled sharing/profile selection.
- ESLint and production build passed. Core JS/CSS is approximately **140 kB gzip**, below the existing 150 KB budget. The starter course is a separate static JSON asset.
- Content checks enforce counts, unique IDs, all-word coverage, bilingual fields, word forms, lesson snapshots, concise export packs, and variants.
- The existing workplace, resource, migration, TTS, gateway, and backup checks remain in the regression suite.
- OpenAPI lint and the Worker deployment dry-run passed. The final Today layout was rechecked on both browser projects. A live local-server check returned HTTP 200 for the complete 24-lesson / 150-word course pack.

Automated tests exercise Sprich’s handoff, not Gemini’s live responses. A real phone/Gemini session is still the user check for pacing and how closely the external model follows the pack. No live Groq/ElevenLabs evaluation or Cloudflare deployment was performed.

## Start here

Open `#lesson/starter-hello`, then try `#words` and `#gemini/starter-coffee`. See [the short guide](START_SPEAKING.md) and [free voice/setup instructions](FREE_SETUP.md).
