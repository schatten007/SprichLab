# TTS and setup verification

This records the TTS/setup review before the Start Speaking release. For the current course and regression results, see [iteration 4](ITERATION_4.md).

**Date:** 5 October 2026. **Scope:** the speech/setup requirements in [AI_BUILD_BRIEF.md](AI_BUILD_BRIEF.md), the `/speech` OpenAPI contract, local setup tooling, and free-tier documentation.

## Summary and verdict

The earlier “complete” report overstated TTS coverage: its browser tests exercised conversation turns and reviews, but never requested natural speech. A new test using the browser client against the actual gateway reproduced **HTTP 400 `invalid_json`** for speech.

**Verdict after fixes: the TTS/setup paths pass local automated verification.** Live-provider quality, account-specific eligibility, physical-device voices, and a real Cloudflare deployment remain unverified because credentials are absent.

## Blocking and major findings — fixed

| Priority | Finding | Correction and evidence |
| --- | --- | --- |
| High | `ai-gateway.js` used one `json` flag for request encoding and response decoding. Binary TTS responses therefore caused the request body to be sent incorrectly. | Request bodies are encoded independently of response type. The real client → gateway test receives valid WAV audio; multipart turn responses remain JSON. |
| High | Natural playback in `v-ai.js` could not be stopped by its “Stop audio” button; detached audio and delayed fallback could continue after navigation or into microphone recording. | `ai-speech.js` owns generation, audio, object URLs, and cancellation for each view. Stop, route cleanup, and recording release them; late responses never start playback or fallback. |
| Major | Natural voice was unreachable through Settings, Slower ignored natural audio, and the existing IndexedDB TTS cache was unused. | Settings now includes **AI Talk voice** and **Test AI Talk voice**. Replays use a voice/model/test-mode-separated cache; Slower changes playback rate. Cache entries expire after 30 days and are cleared by **Remove saved audio**. |
| Major | Setup could say “Connected provider” with no Groq configuration, remain stuck on “Checking”, or lose a capability error because `safeAction` supplies a message string. | Readiness is labelled as configuration rather than verified connectivity. Missing/invalid gateway responses show a retry screen; start is gated on configuration and unlock. Capability failures retain their messages. Gemini Companion renders before network checks complete. |
| Major | The Free-tier guard accepted an absent credit-extension flag and coerced invalid account counters. Existing tests did not actually exercise the app's daily/monthly speech caps. | Synthesis requires explicit `tier=free`, `can_extend_character_limit=false`, valid nonnegative integer counters, and enough remaining allowance. Tests assert **zero synthesis calls** for refusal and enforce the 1,500/day and 8,000/month caps. |

## Additional corrections

- Automatic German voice selection prefers installed voices, including offline use. Slower remains slower even when the selected base rate is already 0.7.
- Replay reads the most recent partner message, including a simplified question or hint.
- The browser supplies Origin/cookies; production code no longer tries to set forbidden headers or read HttpOnly cookies. Abort/timeout handling remains active while audio downloads.
- Setup copy now correctly explains that the owner code and chosen answers are sent to the gateway. Provider keys remain server-side.
- A regression test read IndexedDB immediately after clicking a grade button. It now waits for the saved-state UI before inspecting the result; grading behavior is unchanged.

## Requirements checked

| Requirement | Status / evidence |
| --- | --- |
| German device speech is the default, without a TTS account/key | Pass: Settings and browser tests make no API requests on the device-voice path. |
| Optional German ElevenLabs output with Free-account checks | Pass with provider fixtures: fixed `eleven_multilingual_v2`, `language_code=de`, server-held key/voice ID, rejection before synthesis. |
| Bounded synthesis with local cached replay | Pass: request, daily, monthly, cache persistence/expiry/deletion tests. Cached replay avoids a second TTS request. |
| Repeat, Slower, Stop, microphone handoff, route cleanup | Pass: unit tests plus browser decoding/playback of generated WAV fixtures. |
| Device fallback on quota, credentials, provider or audio errors | Pass: errors produce a single fallback; cancellation produces none. |
| Clear missing-key/gateway guidance and model availability check | Pass: loading, missing proxy, incomplete configuration, retry, and capability-error browser cases. |
| Local gateway, D1 schema, Worker/static-asset packaging | Pass: local gateway exercised through the preview proxy; local Wrangler D1 migration and deployment dry-run succeeded. |
| Real Groq/ElevenLabs output and hosted Workers Free CPU budget | Pending real credentials/deployment. A dry-run does not measure hosted CPU or model quality. |

## Verification results

| Check | Result |
| --- | --- |
| `npm test` | **104 passed** |
| `npm run lint` | Passed |
| `npm run build` | Passed; JS **113.65 kB gzip** + CSS **9.41 kB gzip**, approximately **123.06 kB**, below the 150 KB budget |
| `npm run check:openapi` | Valid |
| `npm run test:e2e` | **64 passed**, desktop and Pixel 7 Chromium emulation |
| `npx wrangler d1 migrations apply sprich-ai-requests --local` | `0001_ai.sql` applied successfully |
| `npm run deploy:check` | Passed; no deployment performed |

Targeted coverage: `tests/ai-gateway.test.js` (5 cases), `tests/ai-speech.test.js` (11), `tests/speech.test.js` (4), strengthened gateway Free-tier/cap tests, and `tests/browser/tts-setup.spec.js` (7 flows on both browser projects). Browser natural audio is decoded by the real media element; device speech in those specific tests is a deterministic double, not evidence of a voice installed on the user's phone.

## Positive findings and remaining work

The original gateway already had useful boundaries: same-origin authentication, server-side provider keys, bounded request/audio sizes, and a local cache store. The fixes connect those pieces without adding a dependency or changing the provider stack.

There are no open clarification questions for the reviewed setup. Iteration 4 subsequently added companion-note and beginner-progress views. Use the [short free setup guide](FREE_SETUP.md) for the user-owned account and device steps.

## Free-tier facts checked

- [ElevenLabs API pricing](https://elevenlabs.io/pricing/api) lists a free Multilingual v2 allowance; [voice documentation](https://elevenlabs.io/docs/overview/capabilities/voices) excludes shared Voice Library voices from Free API access. Default voices change over time, so the guide asks for a currently available ID.
- [ElevenLabs subscription API](https://elevenlabs.io/docs/api-reference/user/subscription/get) documents the tier, counters, and credit-extension flag used by the gateway. [API keys are restricted by default](https://help.elevenlabs.io/hc/en-us/articles/14599447207697-How-do-I-authorize-myself-using-an-API-key); TTS and User Read access are needed here.
- [Groq billing](https://console.groq.com/docs/billing-faqs) requires a payment method for a Developer upgrade. Sprich's Free confirmation is owner-declared; it is not a provider billing lookup.
- [Workers Free](https://developers.cloudflare.com/workers/platform/pricing/) includes 100,000 requests/day and 10 ms CPU/invocation. [D1 Free](https://developers.cloudflare.com/d1/platform/pricing/) includes 5 million rows read/day, 100,000 written/day, and 5 GB total storage; exceeding free limits produces errors.
