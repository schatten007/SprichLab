import { levelById, lessonById, skillLabel, LANGUAGE_TOOLS } from '../data/starter-catalog.js';
import { lessonDialogues } from './starter-content.js';

export const GEMINI_FACTS = { name: 'Name', studies: 'Studies', experience: 'Experience', availability: 'Availability', start: 'Possible start date', motivation: 'Motivation' };
export const GEMINI_LEVELS = ['starter', 'A1', 'A2', 'B1'];

const LEVEL_BRIEF = {
  starter: 'I am a near-beginner in speaking German. Use very short sentences, and add the English meaning after each German question.',
  A1: 'I am at about A1 in speaking. Keep to short familiar questions and let me answer in one sentence. Add English only when I ask or look stuck.',
  A2: 'I am at about A2 in speaking. Ask follow-up questions and encourage one extra detail or a simple reason. Stay in German where you can.',
  B1: 'I am at about B1 in speaking. Ask me to explain, compare, or tell a short story, and include one unprepared follow-up question.',
};
const SUPPORT_BRIEF = {
  guided: 'Offer a small word hint before a full model answer, and repeat your question in simpler German when I hesitate.',
  light: 'Do not offer help unless I ask. If I say “Hilfe”, then give a short hint first.',
};

export function starterGeminiSource(content, { variant = 0, support = 'guided' } = {}) {
  const dialogues = lessonDialogues(content.lesson);
  const meta = lessonById(content.lesson.id) ?? {};
  return { ...content.lesson, ...meta, id: content.lesson.id, title: content.lesson.title, goal: content.lesson.goal,
    version: content.version, words: content.words, support,
    dialogue: dialogues[variant % dialogues.length],
    variations: [content.lesson.variations[variant % content.lesson.variations.length]] };
}
export function missionGeminiSource(mission, content = null, phrases = []) {
  const listening = content?.tasks.find(task => task.kind === 'listen')?.listening ?? mission.listening?.[0];
  const turns = content?.tasks.filter(task => task.kind === 'speak') ?? mission.turns ?? [];
  return { id: mission.id, title: mission.shortTitle, goal: mission.goal,
    register: mission.register.startsWith('Sie') ? 'Sie' : 'du', version: content?.version ?? 'current-workplace-course',
    words: (content?.phrases ?? phrases).slice(0, 8),
    patterns: turns.slice(0, 2).map(turn => ({ de: turn.model, en: turn.modelEn ?? '' })),
    dialogue: [], dialogueText: listening ? `${listening.transcript}\nEnglish support:\n${listening.transcriptEn ?? ''}` : '',
    practice: turns.slice(0, 4).map(turn => ({ promptDe: turn.prompt ?? turn.prompts?.[0], promptEn: turn.promptEn ?? turn.promptsEn?.[0] ?? '' })),
    variations: [{ cue: 'Repeat the situation with one different practical detail. Keep the learner’s own facts consistent.' }],
  };
}

/** Build a portable lesson, not a progress backup. Unknown profile fields are never exported. */
export function buildGeminiPack(source, { level = source.level ?? 'starter', facts = {}, focus = '', support = source.support ?? 'guided' } = {}) {
  const entry = levelById(level);
  const known = Object.entries(GEMINI_FACTS).filter(([key]) => typeof facts[key] === 'string' && facts[key].trim())
    .map(([key, label]) => `${label}: ${facts[key].trim().slice(0, 500)}`);
  const words = (source.words ?? []).slice(0, 8).map(word => `${word.de} — ${word.en}${word.forms ? ` (${word.forms})` : ''}${word.exampleDe ? `\n  ${word.exampleDe} — ${word.exampleEn}` : ''}`).join('\n');
  const patterns = (source.patterns ?? []).slice(0, 2).map(pattern => `${pattern.de} — ${pattern.en}${pattern.note ? `\n  ${pattern.note}` : ''}`).join('\n');
  const dialogue = source.dialogue?.length ? source.dialogue.map(line => `${line.speaker}: ${line.de}\n  ${line.en}`).join('\n') : source.dialogueText ?? '';
  const questions = (source.practice ?? []).slice(0, 4).map(task => `${task.promptDe} — ${task.promptEn}`).join('\n');
  const tool = LANGUAGE_TOOLS[source.focus];
  return `SPRiCH · ${source.title}
Lesson: ${source.id} | Content: ${source.version}
Level target: ${entry ? `${entry.short} · ${entry.label}` : level}${source.skill ? ` | Speaking skill: ${skillLabel(source.skill)}` : ''} | Support: ${support === 'light' ? 'less help' : 'guided'}

PRACTISE THIS LESSON WITH ME
${LEVEL_BRIEF[level] ?? LEVEL_BRIEF.starter}
Goal: ${source.goal}
Use ${source.register} consistently in the roleplay.
${source.warmup ? `First warm-up: ${source.warmup.de} — ${source.warmup.en}\n` : ''}${tool ? `Language focus: ${tool.title}. ${tool.note}\n` : ''}${known.length ? `Only use these personal facts where relevant:\n${known.join('\n')}\n` : 'Ask for personal facts when needed; do not invent a name, experience, or availability for me.\n'}${focus.trim() ? `My focus: ${focus.trim().slice(0, 500)}\n` : ''}
HOW TO PRACTISE
1. Start with a very short warm-up using one useful sentence below. Let me repeat it, then change one detail.
2. Be my conversation partner in this situation. Ask one short German question at a time, then wait for my answer. Do not speak both roles or answer for me.
3. Accept short answers. Use the lesson’s words where possible. Respond naturally to what I actually say rather than reading a fixed script.
4. ${SUPPORT_BRIEF[support] ?? SUPPORT_BRIEF.guided} Let me try again after any help.
5. If I say “langsamer” or “noch einmal”, slow down or repeat the current question. Allow me time to finish.
6. After about five learner replies, give at most two useful corrections from my actual words. Let me retry. Do not give a CEFR or pronunciation score.
7. Finish with a short recap I can copy back: one sentence I said, one thing to practise, and one useful word with its English meaning.

WORDS AND MEANINGS
${words}

SENTENCE PATTERNS
${patterns}

EXAMPLE CONVERSATION — a model, not a script to read at me
${dialogue.slice(0, 4500)}

PRACTICE QUESTIONS
${questions}

SMALL VARIATIONS
${(source.variations ?? []).map(task => `- ${task.cue}`).join('\n')}

Begin with the short warm-up, then ask your first question and wait. Keep this focused on speaking practice.`;
}
