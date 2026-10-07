# Iteration 2 · Resource-guided German course

## Delivered sequence

1. **Progression and migration**
   - Phrase reviews no longer complete a parent mission or advance its dialogue variation.
   - An assisted overdue recall is scheduled into the future.
   - Existing 2.0 sessions receive frozen content snapshots, retaining their original questions, cursor, drafts, and audio keys.
2. **Resource foundation**
   - Fifteen dated source records with level/access/transcript/voice information.
   - Guided activities require a saved response artifact.
   - Bookmarks, difficulty preferences, unavailable-source reporting, and personal phrases are stored and exported.
3. **Content packs**
   - Twelve complete missions, 120 distinct core phrases, 36 bilingual dialogues, and 108 comprehension questions.
   - Every mission has normal and short routes with at least two speaking turns and a retry.
   - Availability, vacancy-call, and appointment follow-ups are driven by explicit response-intent data.
4. **Daily use**
   - Searchable resource library and a resource workspace that shares recording/draft recovery with mission practice.
   - German-first lessons with English meanings on demand or always visible.
   - A persistent daily queue with an editable focus and a six-stage course guide.
   - Saved qualitative takeaways and separate self-reported outside-study minutes.
5. **Verification and maintenance**
   - Domain, migration, content, and browser tests cover the new contracts.
   - A live publisher check records both accessible and restricted resources.
   - A 150 KB gzip JavaScript/CSS budget is enforced in the build.

## Main entry points

- `#today`: daily assignment, focus, due work, and reflection.
- `#practice`: all twelve missions and six-stage navigation.
- `#resources`: searchable/filterable source catalog.
- `#resource/<id>`: access details, task guidance, alternatives, and start action.
- `#session/<id>`: frozen mission/review or resource activity, automatically selected by session type.
- `#phrases`: core phrases, saved personal phrases, and source-linked examples.
- `#progress`: measured time, self-assessed evidence, resource responses, recordings, and takeaways.

## Evidence boundaries

Resource responses are unscored. Self-reported outside time does not become measured app time. English question support does not become answer-model help. A saved annotation for an existing core phrase retains its source/example without creating a duplicate recall track. Curriculum stages describe situations practised, not certified proficiency.

## Required checks

```powershell
npm run lint
npm test
npm run build
npm run test:e2e
```

Run the network-dependent source check separately. For Android, use the HTTPS hosted production build; automated mobile checks use Pixel 7 emulation with a synthetic microphone.
