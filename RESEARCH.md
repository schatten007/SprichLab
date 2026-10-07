# Research and source notes

Reviewed for the v2 redesign on **1 October 2026**. This document separates established learning principles from product defaults. It replaces the old unsourced numerical claims about vocabulary coverage, guaranteed learning speed, and universal daily word limits.

## Principles used

### Retrieval and spacing

Actively retrieving an answer and returning to it over time have a strong evidence base in memory research. Looking at a translation list does not demonstrate retrieval.

- Rowland (2014), *The effect of testing versus restudy on retention: A meta-analytic review of the testing effect*. [DOI: 10.1037/a0037559](https://doi.org/10.1037/a0037559)
- Cepeda et al. (2006), *Distributed practice in verbal recall tasks: A review and quantitative synthesis*. [DOI: 10.1037/0033-2909.132.3.354](https://doi.org/10.1037/0033-2909.132.3.354)

**Application:** attempt before reveal; real review questions; failed items return; immediate repetition cannot count as spaced success.

**Limit:** these findings do not validate the app's exact interval sequence or establish that a particular number of phrases per day is optimal. Those are adjustable product choices.

### Communicative tasks and repair strategies

CEFR descriptors describe activities a learner can perform, including asking for clarification, checking understanding, exchanging information, and describing experiences. A vocabulary total alone does not establish conversational competence.

- Council of Europe, [CEFR descriptors and Companion volume information](https://www.coe.int/en/web/common-european-framework-reference-languages/cefr-descriptors)
- Council of Europe, [Communicative language activities and strategies](https://rm.coe.int/chapter-3-communicative-language-activities-and-strategies/1680a084b4)

**Application:** observable missions, relevant follow-up questions, repeat/rephrase controls, short descriptions of actual experience, and questions back to the other person.

**Limit:** app practice results and self-ratings are not a CEFR assessment. German requirements also differ across employers and roles.

### Model → attempt → reflection → reuse

The app uses short, understandable models, output practice, playback, and repeated attempts. Support fades when the learner can complete a task more independently. Reusable phrases are taught in a situation, with a slot for the learner's own meaning.

**Application:** listen first; use a transcript to check meaning; practise a short phrase; answer a related question; repeat with one chosen improvement.

**Limit:** this exact workflow has not been experimentally validated as a package. Self-assessment can be inaccurate, so compare recordings and seek real conversational feedback. TTS provides accessible examples but does not capture all features of natural human conversation.

## Free resources mapped to the goal

| Resource | Appropriate use |
| --- | --- |
| [VHS A2–B1 Deutsch Beruf](https://a2-b1-beruf.vhs-lernportal.de/wws/home.php) | Structured workplace communication at the user's starting level |
| [DW Nicos Weg A2](https://learngerman.dw.com/en/nicos-weg/c-36519797) | Everyday situations and human-recorded examples |
| [Goethe Deutsch am Arbeitsplatz](https://www.goethe.de/de/spr/ueb/daa.html) | Work-related situations and listening practice; choose appropriate levels |
| [Goethe Vorstellungsgespräch](https://www.goethe.de/de/spr/ueb/daa/inf/tde/bew.html) | An interview example to pause, analyse, and respond to |

The app links to the publishers. It does not copy their audio into its offline cache.

**Correction to the original resource list:** DW describes [Langsam gesprochene Nachrichten](https://learngerman.dw.com/de/langsam-gesprochene-nachrichten/a-61694712) as **B2**, not B1. Slower delivery does not automatically make a news text suitable for A2.

## Browser capability sources

- [MDN: SpeechRecognition](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition) — availability is limited; some implementations use a server and cannot work offline.
- [MDN: MediaStream Recording API](https://developer.mozilla.org/en-US/docs/Web/API/MediaStream_Recording_API/Using_the_MediaStream_Recording_API) — capturing and replaying audio from a microphone.
- [MDN: getUserMedia](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia) — microphone access, permission errors, and secure contexts.
- [MDN: JavaScript modules](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules) — serve module-based applications through HTTP/HTTPS rather than double-clicking a file.
- [OpenAI: Voice availability and limits](https://help.openai.com/en/articles/8400625-voice-mode-faq) — optional external voice use depends on account, region, browser, and current limits. The app makes no claim of unlimited free voice access.

## What will count as evidence of improvement

Record fewer assistance requests, clearer task completion, and successful phrase use in later contexts. Periodically compare similar recorded tasks and try an unfamiliar real conversation. Treat exact vocabulary targets, timing thresholds, and scheduler intervals as hypotheses to adjust, not scientific guarantees.
