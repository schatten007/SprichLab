/**
 * The course catalog classifies every lesson and describes the recommended path.
 * Classification lives here rather than in saved sessions, so it can be refined
 * without invalidating a learner's frozen lesson snapshots.
 */
export const COURSE_LEVELS = [
  { id: 'starter', label: 'Start speaking', short: 'Starter', minutes: 10,
    goal: 'Say a short model phrase and change one detail.' },
  { id: 'A1', label: 'Simple exchanges', short: 'A1', minutes: 12,
    goal: 'Answer familiar questions and manage a basic transaction.' },
  { id: 'A2', label: 'Keep the conversation going', short: 'A2', minutes: 15,
    goal: 'Add details, give a simple reason, clarify, and handle follow-ups.' },
  { id: 'B1', label: 'Explain and discuss', short: 'B1', minutes: 20,
    goal: 'Give connected descriptions, tell a short story, and handle unfamiliar questions.' },
];
export const COURSE_TOPICS = [
  { id: 'basics', label: 'First conversations' }, { id: 'everyday', label: 'Everyday life' },
  { id: 'travel', label: 'Getting around' }, { id: 'shopping', label: 'Shopping and services' },
  { id: 'home', label: 'Home and admin' }, { id: 'health', label: 'Health and appointments' },
  { id: 'social', label: 'Social conversations' }, { id: 'university', label: 'University' },
  { id: 'work', label: 'Work' },
];
export const COURSE_SKILLS = [
  { id: 'introduce', label: 'Introduce yourself' }, { id: 'clarify', label: 'Ask for clarification' },
  { id: 'transact', label: 'Ask for what you need' }, { id: 'navigate', label: 'Find your way' },
  { id: 'arrange', label: 'Arrange a time' }, { id: 'describe', label: 'Describe and explain' },
];
/** Short reusable grammar notes. A lesson points at one; they are never scored. */
export const LANGUAGE_TOOLS = {
  questions: { title: 'Question words', note: 'wer · was · wo · wann · wie · warum. The question word comes first, then the verb: Wo ist der Bahnhof?' },
  'verb-second': { title: 'The verb stays second', note: 'Ich arbeite am Montag. If a time comes first, the verb still follows it: Am Montag arbeite ich.' },
  numbers: { title: 'Numbers and times', note: 'Whole hours use um … Uhr. Before Uhr, one is ein: um ein Uhr. German also uses 14 Uhr.' },
  negation: { title: 'Saying no and not', note: 'nicht negates a verb: Ich verstehe das nicht. kein negates a noun: Ich habe keine Zeit.' },
  modals: { title: 'Modal verbs send the action last', note: 'With kann, muss, möchte or soll the action word goes to the end: Was soll ich machen?' },
  separable: { title: 'Separable verbs split', note: 'aufstehen and mitkommen split: Ich stehe um sechs Uhr auf. Kommst du mit?' },
  perfect: { title: 'Talking about yesterday', note: 'haben or sein plus a participle at the end: Ich habe gespielt. Ich bin gefahren. war = was.' },
  dative: { title: 'Saying who you mean', note: 'Helping and showing use mir/dir/Ihnen: Kannst du mir helfen?' },
};

const module_ = (id, title, topic, pack) => ({ id, title, topic, pack });
export const COURSE_MODULES = [
  module_('first-conversations', 'First conversations', 'basics', 'starter'),
  module_('about-you', 'Talking about yourself', 'basics', 'starter'),
  module_('everyday-needs', 'Everyday needs', 'everyday', 'starter'),
  module_('time-and-plans', 'Time and plans', 'everyday', 'starter'),
  module_('university-people', 'University and people', 'university', 'starter'),
  module_('first-work', 'First work conversations', 'work', 'starter'),
  module_('getting-around', 'Getting around', 'travel', 'everyday'),
  module_('shopping-services', 'Shopping and services', 'shopping', 'everyday'),
  module_('home-admin', 'Home and administration', 'home', 'everyday'),
  module_('health-appointments', 'Health and appointments', 'health', 'everyday'),
  module_('social-talk', 'Social conversations', 'social', 'everyday'),
  module_('work-bridges', 'University and work bridges', 'work', 'everyday'),
];

/** The recommended route. Every lesson stays openable regardless of stage. */
export const COURSE_STAGES = [
  { id: 'speak-first', title: 'Start speaking', level: 'starter',
    lede: 'Say your first useful sentences: greet someone, give your name, and ask for help when you do not understand.',
    moduleIds: ['first-conversations', 'about-you'] },
  { id: 'build-sentences', title: 'Build sentences', level: 'A1',
    lede: 'Order something, ask a price, say a time, and arrange to meet. Short sentences with your own details.',
    moduleIds: ['everyday-needs', 'time-and-plans'] },
  { id: 'everyday-situations', title: 'Handle everyday situations', level: 'A1',
    lede: 'Travel, shopping, and home situations where you need to ask, check, and confirm.',
    moduleIds: ['getting-around', 'shopping-services', 'home-admin'] },
  { id: 'keep-going', title: 'Keep conversations going', level: 'A2',
    lede: 'Give a reason, describe a problem, decline politely, and talk about what you did.',
    moduleIds: ['health-appointments', 'social-talk'] },
  { id: 'study-and-work', title: 'University and work', level: 'A2',
    lede: 'Classrooms, colleagues, availability, and a short introduction you can use in an interview.',
    moduleIds: ['university-people', 'first-work', 'work-bridges'] },
];

// [slug, level, skill, title, titleDe, register, prerequisite slugs, language tool]
const LESSON_ROWS = {
  'first-conversations': [
    ['hello', 'starter', 'introduce', 'Greetings and names', 'Hallo! Wie heißt du?', 'du', [], 'questions'],
    ['learning', 'starter', 'clarify', 'Say you are learning German', 'Ich lerne Deutsch.', 'du', [], 'negation'],
    ['repeat', 'starter', 'clarify', 'Ask for repetition', 'Bitte noch einmal.', 'Sie', [], 'modals'],
    ['spelling', 'starter', 'introduce', 'Spell your name', 'Wie schreibt man das?', 'Sie', ['hello'], 'questions'],
  ],
  'about-you': [
    ['home', 'starter', 'introduce', 'Say where you live', 'Ich wohne in …', 'du', ['hello'], 'verb-second'],
    ['languages', 'A1', 'introduce', 'Languages you speak', 'Welche Sprachen sprichst du?', 'du', ['learning'], 'verb-second'],
    ['studies', 'A1', 'introduce', 'What you study or do', 'Was machst du?', 'du', ['home'], 'questions'],
    ['interests', 'A1', 'introduce', 'Likes and interests', 'Was machst du gern?', 'du', ['studies'], 'verb-second'],
  ],
  'everyday-needs': [
    ['coffee', 'A1', 'transact', 'Order a drink', 'Einen Kaffee, bitte.', 'Sie', [], 'modals'],
    ['food', 'A1', 'transact', 'Buy some food', 'Ich möchte ein Brot.', 'Sie', ['coffee'], 'modals'],
    ['prices', 'A1', 'transact', 'Ask the price and pay', 'Was kostet das?', 'Sie', ['food'], 'numbers'],
    ['directions', 'A1', 'navigate', 'Ask for directions', 'Wo ist der Bahnhof?', 'Sie', ['repeat'], 'questions'],
  ],
  'time-and-plans': [
    ['time', 'A1', 'arrange', 'Numbers and times', 'Wie spät ist es?', 'du', [], 'numbers'],
    ['routine', 'A1', 'describe', 'Your daily routine', 'Wann stehst du auf?', 'du', ['time'], 'separable'],
    ['meeting-time', 'A1', 'arrange', 'Arrange a meeting', 'Hast du morgen Zeit?', 'du', ['time'], 'numbers'],
    ['change-time', 'A2', 'arrange', 'Change a time', 'Geht es auch später?', 'du', ['meeting-time'], 'negation'],
  ],
  'university-people': [
    ['room', 'A1', 'navigate', 'Find your classroom', 'Wo ist der Raum?', 'du', ['directions'], 'questions'],
    ['class-help', 'A1', 'clarify', 'Ask a classmate for help', 'Kannst du mir helfen?', 'du', ['repeat'], 'dative'],
    ['lunch', 'A1', 'arrange', 'Invite someone to lunch', 'Kommst du mit?', 'du', ['meeting-time'], 'separable'],
    ['weekend', 'A2', 'describe', 'Weekend plans', 'Was machst du am Samstag?', 'du', ['interests', 'meeting-time'], 'verb-second'],
  ],
  'first-work': [
    ['work-times', 'A2', 'arrange', 'Your availability', 'Wann können Sie arbeiten?', 'Sie', ['time', 'meeting-time'], 'modals'],
    ['first-task', 'A2', 'clarify', 'Ask what to do', 'Was soll ich machen?', 'du', ['class-help'], 'modals'],
    ['work-help', 'A2', 'describe', 'Ask for help at work', 'Ich brauche Hilfe.', 'du', ['class-help'], 'negation'],
    ['mini-intro', 'A2', 'introduce', 'A simple work introduction', 'Ich stelle mich kurz vor.', 'Sie', ['studies', 'interests'], 'verb-second'],
  ],
  'getting-around': [
    ['ticket', 'A1', 'transact', 'Buy a ticket', 'Eine Fahrkarte, bitte.', 'Sie', ['prices', 'time'], 'modals'],
    ['platform', 'A1', 'navigate', 'Find your platform', 'Von welchem Gleis?', 'Sie', ['directions', 'time'], 'questions'],
    ['connection', 'A2', 'navigate', 'Ask about a connection', 'Wann fährt der nächste Zug?', 'Sie', ['platform'], 'questions'],
    ['delay', 'A2', 'describe', 'Explain a delay', 'Ich komme später.', 'du', ['change-time'], 'perfect'],
  ],
  'shopping-services': [
    ['size', 'A1', 'transact', 'Ask for a size', 'Haben Sie das in M?', 'Sie', ['prices'], 'questions'],
    ['compare', 'A2', 'describe', 'Compare two things', 'Welches ist besser?', 'Sie', ['size'], 'verb-second'],
    ['return', 'A2', 'transact', 'Return a purchase', 'Ich möchte das zurückgeben.', 'Sie', ['size', 'repeat'], 'modals'],
    ['parcel', 'A2', 'transact', 'Send or collect a parcel', 'Ich möchte ein Paket abholen.', 'Sie', ['prices'], 'separable'],
  ],
  'home-admin': [
    ['contact-details', 'A1', 'introduce', 'Give your address and contact details', 'Meine Adresse ist …', 'Sie', ['spelling'], 'numbers'],
    ['room-ask', 'A1', 'transact', 'Ask about a room', 'Ist das Zimmer noch frei?', 'Sie', ['prices'], 'questions'],
    ['viewing', 'A2', 'arrange', 'Arrange a viewing', 'Wann kann ich das Zimmer sehen?', 'Sie', ['meeting-time', 'room-ask'], 'modals'],
    ['household-problem', 'A2', 'describe', 'Report a problem at home', 'Die Heizung funktioniert nicht.', 'Sie', ['repeat', 'room-ask'], 'negation'],
  ],
  'health-appointments': [
    ['appointment', 'A1', 'arrange', 'Book an appointment', 'Ich brauche einen Termin.', 'Sie', ['meeting-time'], 'numbers'],
    ['bring-when', 'A1', 'clarify', 'Check what to bring and when', 'Was soll ich mitbringen?', 'Sie', ['appointment'], 'modals'],
    ['symptoms', 'A2', 'describe', 'Describe simple symptoms', 'Mein Hals tut weh.', 'Sie', ['appointment'], 'verb-second'],
    ['pharmacy', 'A2', 'transact', 'Ask for help at a pharmacy', 'Haben Sie etwas dagegen?', 'Sie', ['symptoms', 'prices'], 'questions'],
  ],
  'social-talk': [
    ['family', 'A1', 'describe', 'Talk about family and friends', 'Ich habe einen Bruder.', 'du', ['interests'], 'verb-second'],
    ['suggest', 'A1', 'arrange', 'Suggest an activity', 'Wollen wir ins Kino gehen?', 'du', ['meeting-time', 'interests'], 'modals'],
    ['decline', 'A2', 'arrange', 'Decline and suggest something else', 'Heute passt es nicht.', 'du', ['suggest', 'change-time'], 'negation'],
    ['yesterday', 'A2', 'describe', 'Say what you did yesterday', 'Was hast du gemacht?', 'du', ['routine', 'interests'], 'perfect'],
  ],
  'work-bridges': [
    ['course-deadline', 'A2', 'clarify', 'Ask about a course and a deadline', 'Wann ist die Abgabe?', 'Sie', ['room', 'time'], 'questions'],
    ['absence', 'A2', 'describe', 'Explain an absence', 'Ich war krank.', 'Sie', ['change-time', 'symptoms'], 'perfect'],
    ['project', 'A2', 'describe', 'Describe a small project', 'Ich habe eine App gebaut.', 'Sie', ['studies', 'first-task'], 'perfect'],
    ['callback', 'A2', 'arrange', 'Leave a short callback message', 'Können Sie mich zurückrufen?', 'Sie', ['contact-details', 'spelling'], 'separable'],
  ],
};

const rows = COURSE_MODULES.flatMap((module, moduleIndex) => (LESSON_ROWS[module.id] ?? []).map(row => ({ module, moduleIndex, row })));
export const COURSE_LESSONS = rows.map(({ module, moduleIndex, row }, index) => {
  const [slug, level, skill, title, titleDe, register, prerequisites, focus] = row;
  return { id: `starter-${slug}`, slug, title, titleDe, register, level, skill, focus,
    module: module.id, moduleTitle: module.title, topic: module.topic, pack: module.pack,
    unit: moduleIndex + 1, number: index + 1,
    minutes: COURSE_LEVELS.find(item => item.id === level).minutes,
    prerequisites: prerequisites.map(item => `starter-${item}`) };
});

const stageOf = moduleId => COURSE_STAGES.find(stage => stage.moduleIds.includes(moduleId));
const pathIndex = new Map(COURSE_STAGES.flatMap(stage => stage.moduleIds)
  .flatMap(moduleId => COURSE_LESSONS.filter(lesson => lesson.module === moduleId))
  .map((lesson, index) => [lesson.id, index]));
for (const lesson of COURSE_LESSONS) {
  lesson.stage = stageOf(lesson.module).id;
  lesson.pathOrder = pathIndex.get(lesson.id);
}
/** Lessons in recommended order rather than catalog order. */
export const COURSE_PATH = [...COURSE_LESSONS].sort((a, b) => a.pathOrder - b.pathOrder);

export const COURSE_PACKS = [
  { id: 'starter', version: 'starter-2026.10-1', file: 'course/starter-2026.10-1.json', words: 150 },
  { id: 'everyday', version: 'everyday-2026.10-1', file: 'course/everyday-2026.10-1.json', words: 100 },
].map(pack => ({ ...pack, lessonIds: COURSE_LESSONS.filter(lesson => lesson.pack === pack.id).map(lesson => lesson.id) }));

export const lessonById = id => COURSE_LESSONS.find(lesson => lesson.id === id);
export const moduleById = id => COURSE_MODULES.find(module => module.id === id);
export const stageById = id => COURSE_STAGES.find(stage => stage.id === id);
export const levelById = id => COURSE_LEVELS.find(level => level.id === id);
export const packById = id => COURSE_PACKS.find(pack => pack.id === id);
export const levelLabel = id => levelById(id)?.short ?? id;
export const topicLabel = id => COURSE_TOPICS.find(topic => topic.id === id)?.label ?? id;
export const skillLabel = id => COURSE_SKILLS.find(skill => skill.id === id)?.label ?? id;

// Names kept for earlier imports and saved data.
export const STARTER_UNITS = COURSE_MODULES.map(module => module.title);
export const STARTER_LESSONS = COURSE_LESSONS;
export const starterLessonById = lessonById;
export const STARTER_VERSION = packById('starter').version;
export const STARTER_PACK = packById('starter').file;
