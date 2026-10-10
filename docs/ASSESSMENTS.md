# Checks and grades

Open **Lessons → Checks & grades**, or open `#assessments` directly.

## Choose a mode

- **Practice:** optional answer and translation reveals are saved as assistance. There is no hidden score penalty; the result clearly identifies the help used.
- **Checkpoint:** answers and reading translations stay hidden until submission. English instructions remain available. These are self-directed learning checks, not proctored exams.

The pilot includes café/shopping and appointment topics, two forms each. Each form has 5 vocabulary, 4 grammar, 4 reading and 2 constrained-writing questions, plus a free-writing task and a roleplay.

## Local checks

Choose **Start check**. Answer the questions and select **Submit answers**. Empty answers score zero; slots earn points independently. Word-order exercises use accessible token buttons, Undo and Reset.

Answers are compared with authored keys. German umlauts, meaningful spelling and case are preserved unless that item explicitly allows a variant. The result shows your submitted answer, accepted alternatives, points and an explanation.

Once submitted, the attempt is sealed. **Try a new attempt** starts a separate record; it does not erase the first score.

## Writing

Choose **Start writing**, write your message and choose **Save for grading**. The suggested word range is a guide, not a semantic score.

On the result page:

1. **Grade with in-app AI** sends the saved text through your configured Groq gateway; or
2. **Copy grading pack** sends the same task and submitted artifact to Gemini when you paste it there.

The writing rubric has five criteria: task fulfilment, organisation, vocabulary, grammar, and spelling/punctuation. Each has 0–4 points. A complete result has 20 possible points; the app calculates the percentage.

## Conversations

Choose **Talk in app** for a graded roleplay, or **Use Gemini Live** to prepare a phone session.

Every published course lesson and workplace mission has two graded-roleplay variations. The task, target level, roles and goals are fixed when the attempt starts. Normal AI Talk's existing review remains qualitative; use the graded entry points for a numerical result.

For in-app roleplay, unlock the gateway through AI Talk if needed. Give at least three real replies; aim for 5–8 short exchanges. **End & grade** seals the complete conversation before evaluation. Send or discard an unsent answer first. Help-button text is never counted as words you spoke.

Conversation criteria are task achievement, interaction, clarity, vocabulary and grammar. A1 short answers can fully meet a goal. The numeric grade is based on the submitted text/transcript, not acoustic pronunciation, accent, speed or pauses. Typed conversations are labelled as typed.

If evidence is missing for a criterion, it is marked unobserved. A partial result has no overall percentage; it is not silently renormalized.

## Gemini report import

For a new Live roleplay:

1. Copy/download/share the prepared grading pack into a normal Gemini chat.
2. Open that same chat on your phone and use Live.
3. After the assessed segment, switch to text and use **Copy report request** to ask for the JSON report.
4. Paste the report into **Gemini assessment report** in Sprich.
5. Choose **Check report**, review the preview, then **Save imported grade**.

For an existing submitted writing/conversation artifact, the pack asks Gemini to grade that exact text rather than conduct a new roleplay.

Sprich validates the attempt, definition, rubric and hash binding and calculates the percentage itself. Quotations are checked against a known submitted artifact. Live-only quotations and observations are externally reported claims. A report's echoed hash does not authenticate its authorship or your performance.

Repeated imports of the same report do not add grades. Invalid reports can be kept as an ungraded note. Changed reports cannot replace a sealed external Live attempt; start another attempt for another performance.

## Saved results and connection problems

Results are available in **Progress** and **Checks and graded roleplays → Saved assessment attempts**. The source and conditions are always shown. Test-provider fixtures are excluded from learning results in Progress.

- A lost connection leaves the response saved. **Check for my grade** retrieves its receipt without generating again.
- If a receipt lookup needs login, unlock first and then check the same request.
- A cooldown retry reuses the same request ID. After its retry limit is exhausted, a new request requires your explicit action.
- The default AI review allowance is shared with grading. Missing credentials, quotas and provider errors are not zero scores.
- If a published derived task changes before grading, start its current version or use Gemini with the saved artifact. Historical grades retain their original definitions.

Local checks work offline after their pack and optional code have downloaded in the production app. AI grading requires a connection. Submitted definitions, answers and grades transfer in progress backups; audio and downloaded pack caches remain device-local.

AI ratings are estimates. Automated fixtures validate request handling and scoring arithmetic, not real-model grading quality or a CEFR certificate.
