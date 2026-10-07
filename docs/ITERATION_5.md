# Iteration 5 · A classified course path (Sprich 2.3)

## What changed

Lessons now have a **level, topic, speaking skill, and preparation**, and the course has grown from 24 to **48 lessons** and from 150 to **250 words**. Lessons are presented as a recommended path while every lesson stays open.

### Difficulty means something specific

| Level | Speaking goal |
| --- | --- |
| Starter · Start speaking | Say a short model phrase and change one detail |
| A1 · Simple exchanges | Answer familiar questions and manage a basic transaction |
| A2 · Keep the conversation going | Add details, give a simple reason, clarify, and handle follow-ups |
| B1 · Explain and discuss | Connected description, a short story, unfamiliar follow-ups |

Levels describe the **task**, not a claim about the learner. Finishing lessons records practice; it never awards a CEFR level. Support is a separate choice per lesson: **Guided** or **Try with less help**.

Current distribution: 5 Starter, 22 A1, 21 A2. B1 is defined and reserved for the existing workplace missions and later content.

### The recommended path

Five stages over twelve modules:

| Stage | Modules | Lessons |
| --- | --- | ---: |
| 1 · Start speaking | First conversations, Talking about yourself | 8 |
| 2 · Build sentences | Everyday needs, Time and plans | 8 |
| 3 · Handle everyday situations | Getting around, Shopping and services, Home and administration | 12 |
| 4 · Keep conversations going | Health and appointments, Social conversations | 8 |
| 5 · University and work | University and people, First work conversations, University and work bridges | 12 |

`recommendNext` resumes an unfinished lesson first, then suggests a guided retry when a learner marked two or more answers for another try, then the first unpractised lesson whose preparation is done. Each recommendation carries a plain-language reason. Prerequisites are advisory links, never locks, and are validated to precede their lesson in path order.

### New content

Six new modules, 24 lessons, and 100 words:

- **Getting around** — buy a ticket, find a platform, ask about a connection, explain a delay
- **Shopping and services** — ask for a size, compare two things, return a purchase, send or collect a parcel
- **Home and administration** — address and contact details, ask about a room, arrange a viewing, report a problem at home
- **Health and appointments** — book an appointment, check what to bring, describe symptoms, ask at a pharmacy
- **Social conversations** — family and friends, suggest an activity, decline politely, say what you did yesterday
- **University and work bridges** — course and deadline, explain an absence, describe a small project, leave a callback message

Every new lesson has **two full bilingual model conversations**; practising a lesson again uses the other one and the other variation. Each new lesson introduces at most five new words and reuses earlier vocabulary. Eight short reusable **language focus** notes cover question words, verb position, numbers, negation, modal verbs, separable verbs, the perfect tense, and dative pronouns.

### Expandable content system

- The catalog (`app/data/starter-catalog.js`) is the single source for modules, stages, levels, topics, skills, prerequisites, and pack membership.
- Content ships as **versioned packs** declared in a manifest: `starter-2026.10-1` (24 lessons / 150 words) and `everyday-2026.10-1` (24 lessons / 100 words).
- `validatePack` checks a pack against its own manifest entry; `mergeCourse` then checks course-wide uniqueness, that every catalog lesson exists, that every `wordId` resolves, and that every word is taught somewhere.
- IndexedDB caches **one entry per pack id**, so publishing one pack leaves the others untouched. Unknown entries are pruned. Lessons already started keep their own frozen snapshot and remain usable.
- Saved lesson snapshots may hold one or several dialogues, so progress from 2.2 stays valid with no migration.

## Verification

| Check | Result |
| --- | --- |
| `npm test` | **121 passed** |
| `npm run lint` | Passed |
| `npm run build` | Passed; JS **136.16 kB** + CSS **10.26 kB** gzip ≈ **146.4 kB** of the 150 KB budget |
| `npm run test:e2e` | **86 passed**, desktop and Pixel 7 Chromium |
| `npm run check:openapi` | Valid |
| `npm run deploy:check` | Passed, no deployment |

New automated coverage: catalog classification and prerequisite ordering, authored-content completeness for all 48 lessons, two-dialogue alternation, path recommendation and reasons, resume and guided-retry behaviour, support-mode persistence and its effect on the Gemini pack, level-aware packs, and per-pack caching/pruning. Browser tests cover the path view, the stage list, level/topic/skill/search filtering, prerequisite links, and a lighter-support lesson hiding its meaning and model until asked.

## Known limits and next steps

- **The core bundle is at 146.4 KB of the 150 KB budget.** The next structural task is moving the A2–B1 workplace mission content (`app/data/mission-packs/*`, `phrases.js`, `legacy-content.js` — roughly 45 kB gzip of source) into downloaded content packs, exactly as the starter course already is. Until then there is little room for new core UI.
- The 24 original lessons still have **one** model conversation each; the planned alternate dialogues for them are not written yet.
- B1 lessons are defined as a level but not yet authored; the existing twelve workplace missions remain the A2–B1 material.
- Levels, topics, and prerequisites are editorial judgements checked against the CEFR interaction descriptors, not measured difficulty.
- Gemini's live conversation behaviour is still only verifiable on your own phone.
