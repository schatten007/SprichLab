# SprichLab feature opportunities

Approved implementation order: **1 → 2 → 3**.

This file tracks the original goals and the smallest accepted scope. It is not
a roadmap; deferred work stays deferred unless explicitly approved later.

## 1. Spoken reuse after phrase review

**Original goal:** After recalling a phrase, give the learner one short chance
to use it in a new personal sentence.

**Accepted scope:** Add one self-rated spoken reuse task to phrase-review
sessions. Reuse the existing recorder, draft persistence, reflection checks,
and `Again` / `Needed help` / `Answered independently` outcomes. Keep this
separate from automatic grammar, pronunciation, and mastery scoring.

**Deferred:** AI grading, pronunciation scoring, extra review settings, and
longer generated conversations.

**Status:** Complete

## 2. Quick capture from any source

**Original goal:** Let a learner bring a useful German sentence from another
app or website into Sprich without retyping the German text.

**Accepted scope:** Add installed-PWA share-target support for shared text and
an optional URL, plus a paste/manual fallback. Prefill the existing personal
phrase form; the learner confirms the English meaning and optional example
before saving. Do not fetch or scrape the shared URL.

**Deferred:** Automatic translation, arbitrary URL fetching, background
imports, and browser-extension support.

**Status:** Complete

## 3. Free-source example lookup

**Original goal:** Give saved phrases another free, attributable example
without adding authored content for every variation.

**Accepted scope:** Add an on-demand lookup for a saved phrase using a free
sentence API. Show a small number of candidate examples with source/license
information; let the learner choose one as an example. Keep the feature
optional and usable without the network.

**Source boundary:** Start with Tatoeba's documented sentence-search API. Do
not mirror audio or treat community examples as official Sprich curriculum.

**Deferred:** Bulk feed ingestion, arbitrary site scraping, automatic lesson
generation, and audio caching.

**Status:** Complete

## Verification log

| Feature | Focused checks | Broader checks | Result |
| --- | --- | --- | --- |
| 1 | `node --test tests/session.test.js` | `npm test` | Focused and full unit suites passed |
| 2 | `node --test tests/share-capture.test.js` | `npx playwright test tests/browser/navigation.spec.js -g "shared text opens|saved phrase can choose"` | Unit and desktop/Android browser flows passed |
| 3 | `node --test tests/tatoeba.test.js` | `npx playwright test tests/browser/navigation.spec.js -g "shared text opens|saved phrase can choose"` | Unit/contract and desktop/Android browser flows passed |

`npm run lint` and `npm run build` passed after all three changes. `npm test`
passed **643 tests**. A live Tatoeba lookup for `Guten Tag` also returned a
licensed German/English example. The focused Playwright flows passed on both the
desktop and Android projects after Edge was installed at
`/opt/microsoft/msedge/msedge`.
