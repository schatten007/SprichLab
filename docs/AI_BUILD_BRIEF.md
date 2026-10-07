# AI update — iteration 3 checkpoint (historical)

The current build is **Sprich 2.2 / iteration 4**. See [ITERATION_4.md](ITERATION_4.md) for the 24 beginner lessons, 150-word vocabulary section, lesson-specific Gemini exports, schema 5, and current verification results. The sections below retain the earlier AI/TTS implementation checkpoint.

## User request and constraints

Implement the approved AI plan step by step in one build session. The user requested `/compact` while retaining this state and the next actions.

- Project: `C:\Users\hyper\Desktop\German Material`, Windows PowerShell 5.1, no Git repository.
- App: Sprich, Vite + vanilla JavaScript, local-first IndexedDB, 12 missions / 120 phrases / 36 bilingual dialogues, desktop + Android.
- Learner: A2, preparing for Werkstudent work/interviews, 90–120 minutes/day, free services, no billing account.
- Approved AI: **Groq Free + Gemini phone companion**. Short recorded clips may be sent after the learner chooses Send.
- Groq: `whisper-large-v3` with `language=de`; `openai/gpt-oss-120b` with strict JSON and low reasoning effort.
- Speech: existing German device voices first. Optional ElevenLabs adapter must verify the account is Free and enforce character caps; fall back to device voice.
- Gemini: native Android Live, lesson card + copyable prompt + screen-sharing guidance + explicit reflection/phrase capture. Consumer subscription is separate from API access. Do not scrape cookies or claim Gemini Live is embedded.
- Hosting: Workers Free + D1. Owner-only generated access code and signed HttpOnly cookie; no Cloudflare Zero Trust onboarding dependency.
- No subagents have been requested. Use `apply_patch` for edits and dedicated Read/Glob/Grep tools for files.

## Credentials and live limitations

Environment inspection found **no** `GROQ_API_KEY`, `ELEVENLABS_API_KEY`, `CLOUDFLARE_API_TOKEN`, or `CLOUDFLARE_ACCOUNT_ID`. No `.dev.vars` or `.env` was present.

Finish real provider adapters, local test fixtures, UI, setup tools and deployment configuration. Do not claim live model quality or a Cloudflare deployment was verified without credentials. Never print or store real provider keys in the client or progress export.

## Completed and last verified

The core AI Talk flow is implemented. A **TTS/setup specification review on 5 October 2026** found and fixed gaps missed by the earlier conversation tests; see [the verification report](TTS_SETUP_VERIFICATION.md). The latest full run passed **104 Node tests**, **ESLint**, **production build (JS 113.65 kB gzip + CSS 9.41 kB = approximately 123.06 kB, below the 150 KB budget)**, **OpenAPI lint**, **local Wrangler D1 migration**, **Worker dry-run**, and **64 Playwright tests** across desktop and Pixel 7 Chromium. Broader UI work remains listed below.

Still unverified, for the stated reason: **live Groq/ElevenLabs model quality** and **an actual Cloudflare deployment**, because no `GROQ_API_KEY`, `ELEVENLABS_API_KEY`, or Cloudflare credentials exist in this environment.

### Shared AI contracts

`shared/ai-contracts.js` contains:
- Limits: 60-second / 1.5 MB clips; 1.65 MB total request; 3000-character learner input; bounded 12-entry/8000-character history.
- Provider model IDs; strict reply/review JSON schemas and validators.
- Review quotes must occur in actual learner messages. AI feedback does not award mastery.

### Local conversation state and migration

- `app/js/ai-state.js`: conversation creation, selected-profile context, pending drafts, immutable completed turns, transcript supersession, bounded history, validators, merge helpers, Gemini practice brief.
- `app/js/model.js`: **schema 4**, schema 3 and 2 import migration, `aiSessions`, `companionNotes`, AI voice/level preferences, AI activity references, separate AI recording statistics.
- `app/js/store.js`: **IndexedDB version 3**, adds `ttsCache`; preserves per-version backups (`schema-2-backup`, `schema-3-backup`); AI draft/turn/review persistence, companion notes, generated audio caching; completed AI recording protection.
- `app/js/recorder.js`: configurable `maxMs` with the original three-minute default retained; AI can use 60 seconds.
- `tests/ai-state.test.js`: migration, bounded context, selected facts, duplicate receipts, transcript edits, recording protection, quote grounding, idempotent import.
- Existing migration expectations updated to schema 4 in `tests/migration.test.js` and `tests/browser/resources.spec.js`.

## Gateway files (implemented and covered by tests)

- `worker/index.js`: same-origin `/api/v1` router, owner session, status/capabilities/usage, turns/reviews, cached receipts, optional speech, parameter bounds, free-account configuration gate.
- `worker/auth.js`: SHA-256 hashes for generated 256-bit access codes (not human passwords), HMAC session cookies, expiry/tamper checks, same-origin mutation checks, API security headers.
- `worker/errors.js`: RFC problem JSON using stable `urn:sprich:problem:*` identifiers.
- `worker/ledger.js`: D1 idempotency claims, per-period counters, cooldown/retry state, uncertain outcomes, 24-hour receipt retention and cleanup.
- `worker/migrations/0001_ai.sql`: requests and counters tables, parameterized queries throughout.
- `worker/providers.js`: actual Groq transcription/chat/review/model-list calls; bounded JSON; silent-input handling; ElevenLabs Free-account/credit verification and bounded speech output.
- `worker/prompts.js`: versioned conversation/review prompts; short A2/B1 German; consistent Sie/du; selected facts; quote-grounded corrections.
- `worker/sqlite-adapter.js`: in-memory/file Node SQLite D1-compatible adapter for local development/tests only.
- `worker/openapi.yaml`: OpenAPI 3.1 contract, linted by `npm run check:openapi`.

### Implemented API surface

- `GET /api/v1/status` — public configuration/auth status, never secrets or upstream generation.
- `POST /api/v1/session` — `{token}` creates signed HttpOnly/SameSite cookie; rate-limited.
- `DELETE /api/v1/session` — logout.
- `GET /api/v1/capabilities` — authenticated provider model availability check.
- `GET /api/v1/usage` — gateway UTC-day counters.
- `POST /api/v1/turns` — text JSON or multipart (`metadata` JSON + `audio`).
- `POST /api/v1/reviews` — text context only, at least two real learner exchanges.
- `GET /api/v1/requests/{requestId}` — recover receipt without generating again.
- `POST /api/v1/speech` — optional German speech, Free ElevenLabs account only.

Successful responses use `{data, meta}`. Errors use `application/problem+json` with `code`, `detail`, `requestId`, `retryAfterSeconds`. Only unchanged retries reuse a request ID. Changed payload => 409.

### Setup/development files

- `.dev.vars.example`: empty placeholders for `OWNER_TOKEN_HASH`, `SESSION_SECRET`, `GROQ_API_KEY`, `GROQ_FREE_TIER_CONFIRMED=false`, optional ElevenLabs key/voice.
- `.gitignore` now ignores `.dev.vars`, `.env*`, `.local/`, `.wrangler/`; explicitly retains `.dev.vars.example`.
- `tools/create-ai-access.js`: user-invoked generator for a random access code, its hash, and signing secret. **Not run for real secrets.**
- `tools/mock-ai-provider.js`: deliberately fake provider responses, tiny valid WAV output, explicit test-only access code. UI must always show test mode.
- `tools/gateway-dev.js`: loopback Node HTTP adapter on port 8787; reads local `.dev.vars`; `--test` uses fake providers + memory DB. Real local DB goes under ignored `.local/`. Uses `fileURLToPath` for Windows spaces.
- `wrangler.jsonc`: Worker + static `dist/` assets, D1 binding `AI_DB`, placeholder zero UUID, no secrets. API routes run the Worker; static assets bypass it.
- Wrangler `4.147.0` and `@redocly/cli@2.57.0` are installed as devDependencies; `npm run deploy:check` performs `wrangler deploy --dry-run` and passes.
- ESLint globals were expanded for Fetch/WebCrypto-related APIs.

## Verification results (last full run)

| Check | Command | Result |
| --- | --- | --- |
| Domain, AI state, gateway, speech | `npm test` | 104 tests, 0 failures |
| Lint | `npm run lint` | clean |
| Bundle budget | `npm run build` | JS 113.65 kB gzip + CSS 9.41 kB gzip ≈ 123.06 kB; below 150 KB |
| API contract | `npm run check:openapi` | Redocly valid, 0 errors / 0 warnings |
| Worker bundle | `npm run deploy:check` | `wrangler deploy --dry-run` succeeded |
| Browser | `npm run test:e2e` | 64 passed, desktop + Pixel 7 Chromium |
| Local Worker database | `npx wrangler d1 migrations apply sprich-ai-requests --local` | Migration applied |

### Gateway and client test coverage

`tests/gateway.test.js` (21 cases) drives the real `createGateway` with `sqliteD1(':memory:')` and `createMockProvider()`: status never leaks secrets, cookie tampering/expiry/origin, 405/404/cross-origin, text turn + cached receipt + `request_changed` 409, provider overrides stripped, concurrent duplicate → 202 pending, minute/daily 429 with UTC reset, separate review quota, provider 429 → cooldown → recovery, uncertain 504 with no re-generation, invalid/oversized audio, review quote grounding, rephrase/hint, model availability, Free-account checks, speech daily/monthly caps, the `urn:sprich:problem:*` contract, and D1 `batch` atomicity.

`tests/v-ai.test.js` (8 cases) covers the client recovery rules: a definite rejection rotates to a fresh request ID while keeping the learner's words and audio key; an uncertain outcome keeps its request ID so it can still be recovered; an unreadable clip returns to a typed reply; recovery distinguishes "never reached us", "still checking after a dropped connection", and "cannot prove the outcome, start a fresh attempt".

`tests/browser/ai-talk.spec.js` drives the **production build** against `gateway-dev.js --test`: unlock with the test-mode owner code, record a clip on the synthetic microphone, send it, and assert the transcribed German plus the partner's follow-up appear in the transcript; a second case sends two typed answers and asserts the short review appears, no correction was invented, the "NOT A SCORE" label is present, and the explicit "nothing here awards mastery or a pronunciation grade" statement is visible.

TTS/setup additions: `tests/ai-gateway.test.js` (5), `tests/ai-speech.test.js` (11), `tests/speech.test.js` (4), and `tests/browser/tts-setup.spec.js` (7 flows per project). These cover JSON-to-binary speech requests, real WAV playback, local replay cache, Stop/Slower, installed-voice preference, Free-tier fallback, recording handoff, late cancellation, loading/unavailable setup, retry, and capability errors.

### Setup and development commands

| Command | Purpose |
| --- | --- |
| `npm run ai:access` | Generate a random owner access code, its hash, and a signing secret (writes nothing to source control) |
| `npm run ai:gateway` | Local gateway on `127.0.0.1:8787` using `.dev.vars` and `.local/ai-gateway.sqlite` |
| `npm run ai:gateway:test` | Test-mode gateway: mock provider, in-memory DB, `TEST_ACCESS_CODE`, loopback only |
| `npm run check:openapi` | Redocly lint of `worker/openapi.yaml` |
| `npm run deploy:check` | `wrangler deploy --dry-run` bundle check |

Vite proxies `/api` to `127.0.0.1:8787` in both `dev` and `preview` with `changeOrigin: false`, so the page's `Origin`/`Host` stay on the app origin and the gateway's same-origin check passes unchanged. `playwright.config.js` starts both the preview server and the test gateway.

The [free setup guide](FREE_SETUP.md) covers installed German voices, Groq Free, optional ElevenLabs Free, Worker secrets, D1 migrations, and HTTPS hosting. Provider account creation and remote provisioning remain user-owned steps.

## Known review points — status

- `providers.readLimited` timer race — **fixed**: the timeout rejects before `reader.cancel()` runs, so cancellation cannot win against `{done:true}`.
- An upstream body timeout is an uncertain provider outcome, not a replayable generation — **done** (`provider_timeout` produces an `uncertain` receipt and never generates twice).
- `sqlite-adapter.batch` yielding inside a transaction — **fixed**: `runSync()` plus a fully synchronous `batch()`; covered by the D1 adapter atomicity test.
- `mergeAIConversations` two-pass sort under clock skew — **fixed**: supersession depth with a per-call cycle guard; covered by the clock-skew merge tests.
- Review payloads carry real learner replies, not Rephrase/Hint control strings — **covered** by the review-grounding tests.
- `TEST_ACCESS_CODE` and loopback-only test mode — **held**: `--test` binds `127.0.0.1`, the UI always shows a "Test provider · no real AI" pill, and the client cannot request test mode.
- API keys are absent — **still true**: fixture success is not real-provider verification.

## UI shipped

- AI Talk navigation entry, lobby, situation/level selection, and an explicit selected-profile preview (`app/js/v-ai.js`, routed from `app/js/app.js`).
- Setup/unlock screen with status, capability check, usage counters, and missing-credential guidance.
- `/ai/session/<id>`: authored opening question, 60-second record/stop/send, transcript with partner replies and English meanings, repeat/slower/rephrase/hint controls, and a "Check for my reply" recovery control.
- Draft and audio are saved locally **before** any network work; uncertain sends keep their request ID; `recover()` is invoked when a session reopens mid-send.
- End review: grounded strengths, at most two corrections, phrase suggestions with a save action that reuses the existing personal-phrase API, and a retry task.
- Settings exposes an optional ElevenLabs voice through `POST /api/v1/speech`. `ai-speech.js` provides cached replay, Stop/Slower, route/microphone cancellation, and German device-voice fallback. Account tier, credit-extension status, counters, and app limits are checked before synthesis.
- Gemini Companion card: screen-share steps, copyable brief, stop-audio control, and a manual reflection saved as a companion note.

## Remaining work (honest gaps)

- **No live provider verification.** Mock fixtures are not evidence of Groq output quality. Use `npm run ai:gateway` with a real `.dev.vars` and a confirmed Free-plan key before trusting replies.
- **No deployment.** `npm run deploy:check` only proves the bundle builds. Fill in the D1 binding id and deploy only when you intend to.
- Iteration 4 now shows companion notes and beginner takeaways in Progress. AI transcripts/reviews remain accessible through saved AI conversations and backups; they never become SRS or pronunciation scores.
- TTS cache wiring is complete. Live German voice quality and the hosted Workers Free CPU budget still need a real account/device check.
- Package version is now 2.2.0; the current beginner release is described in the iteration 4 notes.

## Operational reminders

- PowerShell 5.1: no `&&`; use conditional chaining. Verify parent paths before commands generate artifacts.
- Use `apply_patch` for edits, Read/Glob/Grep for filesystem inspection.
- No Git commits, pushes, account creation, paid-plan activation, or secret disclosure were requested.
- Current release: 2.2.0. Further live-provider/deployment checks still require user-owned credentials.
