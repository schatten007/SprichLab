# Start small — a beginner + ADHD-friendly guide to Sprich

> **Reading this instead of practising?** That is normal. Do one thing first: open **Today**, press **Hear and repeat**, and say the sentence once. Then come back. This guide will still be here.

**The whole plan:** open **Today**, do one short lesson, practise German out loud for about 15 minutes, save one sentence, close the app.

That is enough. You do not need to finish the course, understand every word, or use every feature.

---

## 1. The only four buttons you need

| Where | What it is for |
| --- | --- |
| **Today** | Tells you the next small thing. Start here every day. |
| **Lessons** | The full 48-lesson path, if you want to choose or look ahead. |
| **Words** | Five-word reviews. Short, optional, useful. |
| **Progress** | A record of what you actually did. Visit it weekly, not hourly. |

Everything under **More** — AI Talk, Checks & roleplays, Workplace — is optional. You only need **Settings** once, to set your goal. Ignore the rest for your first two weeks.

The levels you see on lesson cards (Starter, A1, A2, B1) describe what the task asks of you, not your ability. Nothing is locked.

---

## 2. Five-minute setup (once)

If the app is already running at **http://localhost:8080/**, skip to section 3.

1. In the project folder, run this (you need Node.js 22.13 or newer, installed once from [nodejs.org](https://nodejs.org)):

   ```powershell
   npm install
   npm run dev
   ```

2. Open **http://localhost:8080/** in your browser. Do not double-click `app/index.html`; the app needs the local server.

3. Go to **More → Settings** and set:
   - **Learning path:** Start speaking · near-beginner
   - **Daily practice goal:** 15 minutes
   - **Read-aloud speed:** 0.8× or 0.9×
   - **Appearance:** whatever is easiest on your eyes

4. On **Today**, press **Hear and repeat** once. If you hear German, you are ready. If not, add a German voice in your device's speech settings, then choose it under **Settings → German voice** and press **Test selected voice**.

5. Bookmark the page, or install it as an app from your browser menu. Put the bookmark somewhere you will actually see it.

**Do not set up AI Talk or start the assessment section yet, and do not build a 90-minute routine.** Setup is a classic ADHD rabbit hole. The core app works without any of it.

---

## 3. The 15-minute daily loop

Use a visible timer. One round is:

- [ ] **0:00** — Open **Today**. Do not browse the menu.
- [ ] **0:01** — Press **Hear and repeat** on the target sentence. Say it once, badly. Badly is allowed.
- [ ] **0:02** — Press **Start · 10 min** (the big button). Keep **Guided** for now. If it says **Resume lesson**, press that instead.
- [ ] **0:12** — Back on Today, press **Learn five words** or **Review N words**.
- [ ] **0:15** — Type one sentence in **Today's takeaway** and press **Save today's takeaway**.
- [ ] Close the app. Done.

Leaving a lesson unfinished is allowed. Today will show **Resume lesson** next time, and your place is saved on this device.

Why this size: the first lessons are 10 minutes, a word batch is about 5, and **15 minutes** is both the smallest goal the app offers and the threshold where a day counts toward the streak. One lesson plus one word batch is a complete day.

If the app recommends a different lesson, follow the app. The plan above is a shape, not homework.

---

## 4. What happens inside a lesson

A lesson has six short steps: **Start → Words → Pattern → Dialogue → Speak → Finish**.

1. **Start** — Listen to one phrase. Repeat it. Press **Save warm-up & continue**.
   You cannot fail the warm-up. It is not scored.

2. **Words** — Read and hear 5–8 words. Do not try to memorise them. Just notice them.

3. **Pattern** — One sentence shape. Say it with your own name, town, or detail.

4. **Dialogue** — Press **Hear line**, then repeat the line. You do not need to translate every word.

5. **Speak** — This is the real practice:
   - Answer aloud **before** pressing **Show model answer**.
   - Recording is optional. If you do not record, tick **I practised aloud (recording is optional)** so the rating buttons unlock.
   - Recordings stay in this browser. Nothing is uploaded unless you choose to use AI Talk and press **Send**.
   - Then choose one rating: **Try again later**, **Needed help**, or **Said it on my own**.

6. **Finish** — Press **Finish lesson**. Optionally press **Export for Gemini** if you want a conversation later. Exporting is not required.

### The three ratings, without overthinking

| Button | Choose it when |
| --- | --- |
| **Try again later** | You froze, guessed, or could not get the sentence out. |
| **Needed help** | You looked at the model answer or an answer hint, then said it. |
| **Said it on my own** | You said it aloud without revealing the model answer. |

**Needed help is not failure.** It is the most common honest answer for a beginner, and the app schedules another try. The only thing to avoid is pressing **Said it on my own** just to make the screen go away. Honest ratings make tomorrow's review useful.

The English prompt in **Guided** mode does not count as help. Looking at the model answer does. If you are not sure, choose **Needed help**; it costs nothing and keeps the review honest.

Word practice uses the same idea with different labels: **Again**, **With help**, and **Said from memory** (or **Remembered the meaning** / **Used it myself**).

The app does not judge your accent or pronunciation. You are the judge. That is deliberate.

---

## 5. If 15 minutes feels impossible

Pick the smallest version that matches your day. All of them count as showing up.

**3-minute version — the “just open it” day**
- Open Today.
- Press **Hear and repeat**.
- Do the warm-up step only, then leave the lesson. It will wait for you.
- Save the takeaway. Close.

**7-minute version — the “low battery” day**
- Warm-up plus Words.
- One speaking answer.
- Save and close.

**15-minute version — the normal day**
- One full lesson plus five words.

**25-minute version — the good day**
- One lesson, five words, and either:
  - repeat the lesson with **Try with less help**, or
  - do a 5-minute Gemini Live conversation from **Export for Gemini**.

**The rule:** start the 3-minute version. If you feel like continuing, continue. If not, you still practised. Do not wait for motivation to arrive first.

---

## 6. Your first seven days

This is a map, not a contract. If you miss a day, continue where you are. There is no catch-up.

| Day | Do this | Why |
| --- | --- | --- |
| 1 | **Greetings and names** + 5 words | Your first real exchange. |
| 2 | **Say you are learning German** + 5 words | A sentence you will use constantly. |
| 3 | **Ask for repetition** + review words | The most useful survival skill. |
| 4 | **Spell your name** + 5 words | Slow, practical, and finite. |
| 5 | **Say where you live** + review words | Add a detail about yourself. |
| 6 | Repeat the lesson that felt hardest, using **Try with less help** | Less support is the real progress. |
| 7 | Conversation day: **Export for Gemini** and talk for 5 minutes, or simply review due words and replay one recording | Use the language with another voice. |

After day 7, repeat the same rhythm. The app will keep recommending the next lesson. You do not need to plan the next month.

---

## 7. ADHD-friendly rules that matter more than the schedule

**Use one screen.** For two weeks, start on **Today** and nowhere else. Choice is the enemy of starting.

**Start with sound, not reading.** Press the speaker button first. Listening gives your brain something to hold on to.

**Speak before you feel ready.** The first sentence will sound bad. That is the practice, not a preview of the practice.

**Make the next action visible.** Leave the app open on Today, headphones nearby, timer on your desk. Remove one step between “I should practise” and hearing German.

**Use a timer you can see.** Fifteen minutes is short. A visible countdown stops the “how long has this been?” spiral.

**Borrow a body.** Practise while walking, cooking, or with someone else in the room. Say the lines out loud. Movement helps attention; nobody is grading you.

**When you get bored, change the support — not the habit.** Press **Try with less help**, choose a different lesson under **Change today's lesson**, or do a Gemini conversation. Boredom usually means the task is too easy, too repetitive, or too long. It does not mean you should quit.

**When you miss a day, do three minutes.** Do not restart the course, punish yourself, or “make up” the missed lesson. The streak is a gentle routine reminder, not a measure of your German. Missed days never delete saved practice, and banked rest days exist for exactly this.

**Do not optimise the system.** Do not reorganise your word list, compare lesson levels, or read the whole grammar note before speaking. The app is built to keep going without perfect setup.

---

## 8. How progress actually happens

Progress is **less support over time**, not more content.

- **Week 1:** Guided lessons. English visible. Use the model whenever you need it.
- **Week 2:** Repeat one familiar lesson with **Try with less help**. Try answering before revealing the model.
- **Week 3 and beyond:** Add one Gemini Live conversation per week, or one workplace mission if work German is your goal.

Signs you are improving — none of them are a streak number:

- You hear a word and know it before the translation appears.
- You answer a question before you reach for **Show model answer**.
- You need fewer **Needed help** ratings on a lesson you have practised before.
- You can say one sentence without reading it.
- A real person understands you, even if your grammar is imperfect.

### The five-minute weekly review

Once a week, open **Progress** and look at only these:

- minutes practised in the last seven days,
- lessons practised,
- words recalled,
- one saved takeaway you still like.

Then close it. Do not audit every percentage, compare grades, or turn the week into a report card. The numbers describe practice, not your worth or your level.

---

## 9. Speaking outside the app (optional, high value)

The app can only take you so far because it cannot hear you. Two cheap additions:

**Gemini Live, once or twice a week**
- Open a lesson → **Export for Gemini** → copy the pack.
- Paste it into a Gemini chat, then tap **Live** on your phone.
- Say: “Please start the warm-up from this lesson.”
- When you get stuck, use these and keep going:
  - **Langsamer, bitte.** — Slower, please.
  - **Noch einmal, bitte.** — Once more, please.
  - **Wie bitte?** — Sorry, what?
  - **Ich verstehe das nicht.** — I don't understand that.
  - **Kannst du mir helfen?** — Can you help me?

**A 30-second voice memo**
- Answer one lesson question into your phone.
- Listen once.
- Say it again without reading.
- Keep the second one. Do not delete the first; comparing them later is the point.

You can also use German in tiny real situations: greeting a colleague, ordering a coffee, reading a sign aloud, narrating your commute. Five real seconds beat fifty perfect flashcards.

---

## 10. When something goes wrong

| Problem | Do this |
| --- | --- |
| No German audio | **Settings → German voice**, add German in your device speech settings, press **Test selected voice**. If audio still fails, read each line aloud yourself and tick **I practised aloud**. |
| Microphone does not work | Recording is optional. Say it aloud and tick the “I practised aloud” option. Recording needs localhost or HTTPS, not a plain network address. |
| I do not understand the lesson | Stay in **Guided**, open **Meaning**, and use **Show model answer**. Choose **Needed help**. Understanding comes from repetition, not from pretending. |
| The lesson is too easy | Use **Try with less help** or pick a different lesson under **Change today's lesson**. You can jump anywhere; nothing is locked. |
| Too many words | Ignore the full **Words** library. Only use the five words offered on **Today**. |
| I missed several days | Open Today and do the 3-minute version. No catch-up, no restart. |
| My progress disappeared | Check the address. `localhost:8080`, `127.0.0.1:4173`, and a hosted site each have separate storage. Use **Settings → Export progress / Import progress** to move it. |
| I feel overwhelmed by the menus | Use only **Today** for a week. The **More** menu can wait. |

---

## 11. The one-page version

Copy this into a note, or stick it next to your screen.

```text
DAILY (15 min)
[ ] Open Today — nowhere else
[ ] Hear and repeat the target sentence
[ ] Start the recommended lesson (Guided)
[ ] Say every answer out loud before revealing the model
[ ] Rate honestly: Try again later / Needed help / Said it on my own
[ ] Learn or review five words
[ ] Save one takeaway
[ ] Close the app

LOW DAY (3 min)
[ ] Open Today
[ ] Hear and repeat
[ ] Do the warm-up only
[ ] Save and close

WEEKLY (5 min)
[ ] Open Progress
[ ] Notice minutes, lessons, words, one takeaway
[ ] Pick one lesson to repeat with less help next week
[ ] Close it

RULES
- A bad sentence out loud beats a perfect sentence in your head.
- Needed help is a valid answer.
- Missed a day? Three minutes, no restart.
- Bored? Change the support, not the habit.
- The streak is a reminder, not a grade.
```

---

## The 20-second version

Open **Today** → press **Hear and repeat** → start the lesson → say the answers out loud → do five words → save one sentence → close.

Do that most days. When it feels easy, use **Try with less help**. When it feels hard, do the three-minute version.

**Consistency beats intensity. A small, bad, finished session beats a perfect plan you never start.**
