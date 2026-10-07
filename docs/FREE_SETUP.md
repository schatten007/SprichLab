# Set up Sprich for free

Checked against official documentation on **5 October 2026**.

**Starter lessons, vocabulary, and Gemini lesson export need no provider keys.** Use an installed German device voice for lesson audio; it has no API allowance to exhaust. Follow the [Start Speaking guide](START_SPEAKING.md). Groq Free enables the separate AI Talk feature; ElevenLabs is an optional natural-voice extra.

Run commands from the project folder with Node.js 22.13+ (22.x) or 24+. Dependencies are already installed here; a fresh copy needs `npm install`.

## 1. Free German read-aloud — no account or API key

1. Run `npm run dev` and open **http://localhost:8080/#settings**.
2. Install a German voice if needed:
   - **Windows:** Settings → Time & language → Speech → Manage voices → Add voices → German. Restart the browser after installation. [Microsoft instructions](https://support.microsoft.com/en-us/windows/appendix-a-supported-languages-and-voices-4486e345-7730-53da-fcfe-55cc64300f01).
   - **Android:** search Settings for **Text-to-speech output**, choose your engine, then **Install voice data → German**. [Google instructions](https://support.google.com/accessibility/android/answer/6006983?hl=en).
3. In Sprich, keep **AI Talk voice → German device voice**. Under **German voice**, choose an entry labelled **device voice**, or leave Automatic selected; it prefers installed voices.
4. Choose **Save preferences**, then **Test selected voice**. Installed voices work offline; entries labelled *online voice* need internet.

## 2. Real AI Talk with Groq Free

1. Create a [Groq account and API key](https://console.groq.com/keys). Stay on **Free**; no Developer upgrade or payment method is needed. [Billing details](https://console.groq.com/docs/billing-faqs).
2. In a second terminal, run:

   ```powershell
   npm run ai:access
   ```

   Keep the **owner access code** for the app. The command also prints its hash and a separate signing secret; it does not create your Groq key.
3. Copy `.dev.vars.example` to `.dev.vars` in your editor if that file does not already exist. Fill in the values:

   ```dotenv
   OWNER_TOKEN_HASH=PASTE_THE_GENERATED_HASH
   SESSION_SECRET=PASTE_THE_GENERATED_SIGNING_SECRET
   GROQ_API_KEY=PASTE_YOUR_GROQ_KEY
   GROQ_FREE_TIER_CONFIRMED=true
   ELEVENLABS_API_KEY=
   ELEVENLABS_VOICE_ID=
   ```

   `GROQ_FREE_TIER_CONFIRMED` is your confirmation of the account plan, not an automated billing lookup. Keep `.dev.vars` local.
4. Keep `npm run dev` running in the first terminal. In the second, run:

   ```powershell
   npm run ai:gateway
   ```

5. Open **http://localhost:8080/#ai**, enter the **owner access code** (not an API key), choose **Unlock AI Talk → Check models**, then start a conversation. The gateway fixes the models to `whisper-large-v3` and `openai/gpt-oss-120b`.

The app defaults to **40 turns/day, 3/minute, and 6 reviews/day**. Provider limits also apply; a 429 means wait for the limit to reset. `npm run ai:gateway:test` gives fixture responses for testing, not real AI.

## 3. Optional natural TTS with ElevenLabs Free

1. Create an [ElevenLabs Free account](https://elevenlabs.io/app/sign-up). Keep pay-as-you-go/credit extensions off. The current free allowance lists **10,000 Multilingual v2 characters**; it is limited, not enough for unrestricted daily conversation. [Pricing](https://elevenlabs.io/pricing/api).
2. In **Developers → API Keys**, create a key with **Text to Speech** and **User: Read** permissions. User read is needed for the Free-plan check. [API-key setup](https://help.elevenlabs.io/hc/en-us/articles/14599447207697-How-do-I-authorize-myself-using-an-API-key).
3. Copy the ID of a currently available **default voice**, or your own **Voice Design** voice. Shared **Voice Library** voices are unavailable through the Free API. [Voice restrictions](https://elevenlabs.io/docs/overview/capabilities/voices).
4. Set `ELEVENLABS_API_KEY` and `ELEVENLABS_VOICE_ID` in `.dev.vars`. Restart `npm run ai:gateway`, refresh Sprich, and unlock AI Talk.
5. Open **Settings → AI Talk voice → ElevenLabs Free**, save, and choose **Test AI Talk voice**.

Sprich checks the Free tier, disabled credit extensions, and remaining allowance before synthesis. Its extra caps are **800 characters/request, 1,500/day, and 8,000/calendar month**. Cached replays consume no new synthesis allowance; Stop and Slower work locally. Errors fall back to your German device voice.

Use free-tier audio for personal practice. Sharing it requires [ElevenLabs attribution](https://help.elevenlabs.io/hc/en-us/articles/13313564601361-Can-I-publish-the-content-I-generate-on-the-platform); the Free plan has no commercial licence.

## 4. Optional free HTTPS hosting for Android

Use a **Cloudflare Workers Free** account with **D1**. The included `workers.dev` address serves the app and `/api` together over HTTPS; no purchased domain is needed. [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/) · [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/).

1. Sign in and create the database:

   ```powershell
   npx wrangler login
   npx wrangler d1 create sprich-ai-requests --update-config=false
   ```

2. In `wrangler.jsonc`, replace the zero `database_id` with the returned ID. Keep the binding `AI_DB` and `migrations_dir`. Set its `GROQ_FREE_TIER_CONFIRMED` value to `"true"` after confirming your Groq plan.
3. Apply the schema, build, and publish:

   ```powershell
   npx wrangler d1 migrations apply sprich-ai-requests --remote
   npm run build
   npx wrangler deploy
   ```

4. Add these Worker secrets, pasting only the corresponding **value** at each prompt:

   ```powershell
   npx wrangler secret put OWNER_TOKEN_HASH
   npx wrangler secret put SESSION_SECRET
   npx wrangler secret put GROQ_API_KEY
   ```

   For optional natural speech, also add `ELEVENLABS_API_KEY` and `ELEVENLABS_VOICE_ID` with `wrangler secret put`. Local `.dev.vars` values are not deployed automatically. [Secret setup](https://developers.cloudflare.com/workers/configuration/secrets/).
5. Open the printed HTTPS address on Android, unlock AI Talk, and allow the microphone. Export/import progress to move it from localhost to the hosted origin.

**Quick fixes:** “Gateway unavailable” → start both local terminals and use port **8080**, then **Check connection again**. “Groq setup incomplete” → check the key and Free confirmation, then restart the gateway. Natural voice falls back → check its Free plan, key permissions, voice ID, and remaining allowance.

Local tests and the Worker dry-run pass. Actual provider audio quality and deployment still need your credentials and device check; see the [verification report](TTS_SETUP_VERIFICATION.md).
