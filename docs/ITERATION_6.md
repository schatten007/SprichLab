# Iteration 6 · Quiet Pixel progress (Sprich 2.4)

## What changed

The app now gives the learner one calm next action instead of presenting every metric and control at once. The core learning content and assessment contracts are unchanged.

### A quieter interface

- **Today** leads with one recommended lesson, its time cost, and one reason to do it. Word review, Gemini export, lesson switching, and the path remain available as secondary actions.
- **Lessons** separates **My path** from **All lessons**. Only the current stage is open initially, and the 48-card library is built when its tab is selected.
- **Words** starts with 12 visible cards, keeps filters behind one disclosure, and uses a keyboard-friendly segmented practice-mode control.
- **Lesson steps** show a discrete step meter, focus the new step heading, and keep Previous / Next actions visible on small screens.
- **Progress** starts with this week, practice evidence, and one next milestone. Recordings, mission detail, takeaways, and saved history are available under one Details disclosure.

### Three visual themes

The existing `system / light / dark` appearance preference remains compatible with saved progress. A separate device-local light palette adds:

| Theme | Purpose |
| --- | --- |
| **Paper** | Warm, low-glare light background for longer sessions |
| **Contrast** | Strongest text contrast, thicker rules, and no decorative texture |
| **Night** | Deep green-charcoal background with off-white text for dark rooms |

Headings, controls, numbers, badges, and progress blocks use a compact pixel-inspired monospace treatment. German lesson text remains a readable system font. The themes keep focus rings and normal text at accessible contrast levels.

### Honest effort rewards

Rewards are derived at render time from existing practice evidence; there is no new state or IndexedDB version. They never read assessment scores, CEFR labels, or the repeat-counting session total as proficiency.

- A goal ring compares measured practice with the learner's selected daily goal.
- A day qualifies for the streak at 15 minutes of measured practice.
- Six qualifying days earn one rest day; at most two can be banked.
- One missed day can spend a banked rest day. Two missed days in a row end the streak.
- Milestones count deduplicated effort such as lessons practised, words recalled, spoken answers, recordings, and practice time. The interface shows earned milestones and one next target.

### Provenance vocabulary

Numbers now carry compact labels instead of repeating long caveats across every card:

`Measured` · `Checked locally` · `Self-rated` · `Self-reported` · `AI estimate` · `Imported Gemini assessment`

The **How progress is measured** page explains the labels once. This keeps the UI honest without making every screen read like a policy document.

## Verification

| Check | Result |
| --- | --- |
| `npm run lint` | Passed |
| `npm test` | **621 passed** |
| `npm run build` | Passed; core **128,297 bytes gzip** of the **153,600-byte** budget |
| `npm run test:e2e` | Not runnable in this Linux environment because the configured Microsoft Edge channel is not installed |

The browser suite was already green before the final screen changes; the remaining browser verification requires the repository's configured Edge channel or an equivalent local browser installation.

## Known limits

- A forward device clock can bank future qualifying days because rewards use the local activity dates already stored by the app.
- Changing `preferences.timeZone` changes which local day is called “today”; it does not relabel stored day entries.
- Importing a second device's backup can retroactively repair a past qualifying day.
- The streak and milestones describe effort and persistence. They do not estimate a CEFR level, pronunciation, or fluency.
