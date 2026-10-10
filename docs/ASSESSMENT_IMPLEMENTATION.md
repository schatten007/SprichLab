# Assessment implementation notes

## Boundaries

This implements the agent-ticket plan as a separate assessment layer. Existing self-rated practice and SRS are not reinterpreted as checked grades.

| Module | Responsibility |
| --- | --- |
| `shared/assessment-contracts.js` | Plain-JSON contracts, identity hashing, support/evidence validation, bounded submissions |
| `shared/assessment-rubrics.js` | Versioned five-criterion conversation/writing rubrics and target-level anchors |
| `shared/assessment-scoring.js` | Literal keyed grading, independent slot points, explicit alternatives, rubric arithmetic |
| `shared/assessment-results.js` | Evaluator provenance, recalculated results, evidence/identity checks |
| `shared/assessment-manifest.js` | Pilot asset allowlist and published lesson-roleplay selectors |
| `shared/assessment-scenarios.js` | Deterministic scenario definitions from published lesson goals and variations |
| `app/js/assessment-state.js` | Definition snapshots, attempt lifecycle, immutable merges, jobs and cross-device conflicts |
| `app/js/assessment-store.js` | IndexedDB integration with compare-and-seal writes |
| `app/js/assessment-evidence.js` | Full assessed turn set; no synthetic learner strings or silent truncation |
| `app/js/assessment-jobs.js` | Initial POST, receipt-only recovery, explicit retries, late-result validation |
| `app/js/assessment-gemini.js` | Graded packs and validated external report parsing |
| `app/js/v-assessments.js`, `v-assessment-run.js` | Discovery, objective/writing runner, results and roleplay entry points |
| `worker/assessment-definitions.js` | Definition loading via deployment-owned manifests/ASSETS |
| `worker/assessment-prompts.js` | Trusted roleplay/grader messages and strict structured-output schema |
| `worker/assessments.js` | Evaluation API, hashes, quotes, quotas and ledger receipts |

## Persistence

Progress schema **6**, IndexedDB version **5**, backup format **1**.

`state.assessments` contains `definitions`, `attempts`, `evaluations` and `jobs`. Definition snapshots are deduplicated by SHA-256. Submitted answers and grading content are immutable; local receipt timestamps can reconcile when identical keyed/Gemini evaluations were created on two devices.

Submission hashing happens outside IndexedDB transactions. The synchronous write rechecks the draft revision and, for roleplays, the current conversation evidence before sealing. Submitted recording references cannot be overwritten. Explicit user deletion of audio is supported; transferred results do not pretend a missing blob exists.

Imports verify content, submission and prepared-context hashes before writing. Conflicting submitted answers or grading content reject the import. A submitted roleplay cannot overwrite another device's unsent answer or additional conversation turns. Activity clocks accept assessment IDs, but assessment scores never create legacy attempts, word reviews, SRS successes or course completion.

## Score contracts

Objective item types: `choice`, `text`, `slots`, `order`. Keys define normalization explicitly; there is no global accent stripping, fuzzy match or substring credit. Points are derived from the authored definition, not the submitted answer.

Conversation criteria: task, interaction, clarity, vocabulary, grammar. Writing: task, organisation, vocabulary, grammar, mechanics. Each is 0–4 or unobserved (`null`). Five observed criteria produce a 20-point score; percentages are calculated in code. Partial evidence produces a null percentage.

Writing and roleplay submissions include support metadata. Roleplay evidence distinguishes learner/partner/control and typed/transcribed input. In-app grading does not receive raw audio and cannot score acoustic delivery. Grader quotations must refer to eligible learner text, not models, preparation or control strings.

## Definitions and versions

Four pilot JSON packs contain 60 keyed items, four writing tasks and four roleplays. Every published lesson/mission also has two lesson-derived roleplay definitions (120 variants in the current catalog). Their version is derived from the actual scenario material/classification/rules; changed content cannot silently grade an older submission.

Frontend and gateway resolve the same content. Production uses the static-assets binding; local/test gateways inject an allowlisted filesystem resolver. Unknown IDs/versions, HTML fallbacks and malformed content fail before model work. Historical saved results render from their snapshots; completed receipts do not require a live catalog lookup.

## Gateway and recovery

`POST /api/v1/assessments/evaluations` accepts writing/roleplay submissions, references and hashes. It shares the existing authenticated origin, review quota and minute limits. Request-ledger kind `assessment` uses the existing SQL table; no D1 schema migration is required.

New assessed turns use `assessmentRef` instead of a legacy mission ID. This permits Starter/A1 scenarios through a trusted definition resolver without accepting client-authored system prompts or provider choices. Checkpoints reject answer-hint operations.

Duplicate request IDs return the original receipt. An uncertain outcome is recovered, not regenerated automatically. Authentication failure during receipt lookup preserves recovery. Two exhausted rate-limit attempts become terminal `retry_exhausted`, allowing an explicit new grading request against the same sealed submission.

## Gemini

`external-live` reports bind to the prepared export context; they cannot claim a hash of speech that did not yet exist. `submitted-text` reports bind to an existing sealed artifact and undergo quotation checks. Both import as `gemini-import`, never as authenticated gateway results.

The parser accepts one JSON object or one unambiguous fenced object, rejects duplicate/unsafe keys and unknown fields, and ignores a claimed total when calculating scores. Its normalized report hash makes imports idempotent. External delivery/assistance notes remain labelled claims.

## Offline and bundle budget

Assessment views and AI Talk are dynamically loaded. The unchanged **150 KiB gzip** limit is enforced on the entry point's static JS/CSS dependency graph, rather than counting optional feature chunks as initial code. `dist/asset-budget.json` exposes both lists for inspection.

The service worker precaches the initial shell. Opening assessments or AI Talk asks it to cache known optional chunks; no arbitrary cache URLs are accepted. Assessment content packs use a separate IndexedDB cache. Tests cover graph accounting and an assessment reload/submission while offline.

## Checks and remaining live validation

Verified for this implementation:

| Check | Result |
| --- | --- |
| Node regression suite | 595 passed |
| Desktop + Pixel 7 browser suite | 110 passed |
| ESLint | Passed |
| OpenAPI lint | Passed without warnings |
| Production build | Passed; initial JS/CSS below the unchanged 150 KiB gzip limit |
| Worker deployment dry-run | Passed; no live deployment performed |

Run ESLint, Node tests, build, OpenAPI lint, Worker dry-run, then browser tests. Build before Playwright because its preview serves `dist/`. Start fresh owned test gateways when server code changes.

Tests exercise numeric/Unicode/partial-credit cases, all pilot forms, all derived scenario hashes, merge races, idempotent imports, wrong receipts, support provenance, auth/cooldown recovery, offline code/content, and UI handoff. Provider test mode produces explicitly labelled fixture grades.

Live Groq/Gemini rating quality, account-specific limits, and physical-device audio remain separate checks. No real provider key or Cloudflare deployment is required for the local keyed tests, and none is implied by a passing mock suite.
