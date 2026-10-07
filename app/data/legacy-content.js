// Frozen Sprich 2.0 content. Used only to preserve unfinished sessions during migration.
export const PHRASES = [
  { id: 'study', de: 'Ich studiere …', en: 'I am studying …', cue: 'Tell an interviewer what you study.', example: 'Ich studiere Wirtschaft im dritten Semester.', note: 'Add your subject. One clear sentence is a good beginning.', tags: ['interview'] },
  { id: 'work-goal', de: 'Ich möchte praktische Erfahrung sammeln.', en: 'I would like to gain practical experience.', cue: 'Explain what you want to gain from a student job.', example: 'Ich möchte neben dem Studium praktische Erfahrung sammeln.', note: 'möchte + infinitive: Ich möchte … sammeln.', tags: ['interview'] },
  { id: 'experience', de: 'Ich habe Erfahrung mit …', en: 'I have experience with …', cue: 'Introduce a skill you have actually used.', example: 'Ich habe Erfahrung mit Excel und arbeite gerne im Team.', note: 'Use a real skill. mit takes the dative.', tags: ['interview', 'work'] },
  { id: 'hours', de: 'Ich kann … Stunden pro Woche arbeiten.', en: 'I can work … hours per week.', cue: 'Tell an employer your weekly availability.', example: 'Ich kann sechzehn Stunden pro Woche arbeiten.', note: 'The main verb goes at the end after kann: kann … arbeiten.', tags: ['interview'] },
  { id: 'days', de: 'Am … und am … habe ich Zeit.', en: 'I am available on … and …', cue: 'Name two days when you are available.', example: 'Am Montag und am Donnerstag habe ich Zeit.', note: 'Days use am. After the time expression: habe ich.', tags: ['interview', 'everyday'] },
  { id: 'start', de: 'Ich könnte ab … anfangen.', en: 'I could start from …', cue: 'Say when you could start the job.', example: 'Ich könnte ab November anfangen.', note: 'ab gives the starting point; anfangen stays at the end.', tags: ['interview'] },
  { id: 'motivation', de: 'Die Stelle interessiert mich, weil …', en: 'The position interests me because …', cue: 'Give one honest reason for wanting this job.', example: 'Die Stelle interessiert mich, weil ich gerne mit Menschen arbeite.', note: 'After weil, put the conjugated verb at the end.', tags: ['interview'] },
  { id: 'repeat', de: 'Könnten Sie das bitte wiederholen?', en: 'Could you repeat that, please?', cue: 'Politely ask an interviewer to repeat the question.', example: 'Entschuldigung, könnten Sie das bitte wiederholen?', note: 'Asking for repetition is a useful conversation skill.', tags: ['repair', 'interview'] },
  { id: 'clarify', de: 'Was genau meinst du damit?', en: 'What exactly do you mean by that?', cue: 'Ask a colleague to explain an unclear instruction.', example: 'Was genau meinst du mit „aktualisieren“?', note: 'With Sie: Was genau meinen Sie damit?', tags: ['repair', 'work'] },
  { id: 'confirm', de: 'Habe ich das richtig verstanden: …?', en: 'Have I understood correctly: …?', cue: 'Check that you understood the task.', example: 'Habe ich das richtig verstanden: Ich soll die Liste bis morgen aktualisieren?', note: 'Repeat the action and deadline in your own words.', tags: ['repair', 'work'] },
  { id: 'priority', de: 'Was soll ich zuerst machen?', en: 'What should I do first?', cue: 'Ask which task is the priority.', example: 'Was soll ich zuerst machen: die E-Mails oder die Liste?', note: 'Offering two options makes the question concrete.', tags: ['work'] },
  { id: 'deadline', de: 'Bis wann brauchst du das?', en: 'When do you need it by?', cue: 'Find out the deadline for a task.', example: 'Bis wann brauchst du die neue Liste?', note: 'bis wann asks for a deadline. With Sie: Bis wann brauchen Sie das?', tags: ['work'] },
  { id: 'help', de: 'Kannst du mir kurz helfen?', en: 'Can you help me for a moment?', cue: 'Ask a colleague for a little help.', example: 'Kannst du mir kurz helfen? Ich finde die Datei nicht.', note: 'Say what you tried or where you are stuck next.', tags: ['work', 'repair'] },
  { id: 'status', de: 'Ich arbeite gerade an …', en: 'I am currently working on …', cue: 'Give the first sentence of a work update.', example: 'Ich arbeite gerade an der Präsentation.', note: 'an + dative: an der Präsentation, an einem Projekt.', tags: ['work'] },
  { id: 'task', de: 'Meine Aufgabe war …', en: 'My task was …', cue: 'Explain your own contribution to a project.', example: 'Meine Aufgabe war, die Ergebnisse zusammenzufassen.', note: 'Make your own contribution clear, even in a group project.', tags: ['interview', 'work'] },
  { id: 'problem', de: 'Es gibt ein Problem mit …', en: 'There is a problem with …', cue: 'Introduce a problem without a long explanation.', example: 'Es gibt ein Problem mit der Datei. Ich kann sie nicht öffnen.', note: 'Follow with one specific detail.', tags: ['work'] },
  { id: 'suggest', de: 'Ich schlage vor, dass wir …', en: 'I suggest that we …', cue: 'Suggest a next step to your team.', example: 'Ich schlage vor, dass wir das zusammen prüfen.', note: 'The conjugated verb goes at the end of the dass clause.', tags: ['work'] },
  { id: 'result', de: 'Am Ende haben wir …', en: 'In the end, we …', cue: 'Describe the result of a team project.', example: 'Am Ende haben wir die Präsentation pünktlich fertiggestellt.', note: 'Use a result that really happened. A small result is fine.', tags: ['interview', 'work'] },
  { id: 'reason', de: 'Das liegt daran, dass …', en: 'That is because …', cue: 'Explain the cause of a problem.', example: 'Das liegt daran, dass die Daten noch fehlen.', note: 'After dass: die Daten noch fehlen.', tags: ['work', 'everyday'] },
  { id: 'weekend', de: 'Am Wochenende habe ich …', en: 'At the weekend, I …', cue: 'Tell a colleague something about your weekend.', example: 'Am Wochenende habe ich Freunde besucht.', note: 'Use bin for movement: Am Wochenende bin ich nach Köln gefahren.', tags: ['smalltalk'] },
  { id: 'follow', de: 'Und wie war es bei dir?', en: 'And how was it for you?', cue: 'Return a casual question to a colleague.', example: 'Mein Wochenende war ruhig. Und wie war es bei dir?', note: 'A short question helps keep the conversation going.', tags: ['smalltalk'] },
  { id: 'opinion', de: 'Mir gefällt …, weil …', en: 'I like … because …', cue: 'Give an opinion and one reason.', example: 'Mir gefällt die Stadt, weil es viele Parks gibt.', note: 'Keep the reason short enough to say comfortably.', tags: ['smalltalk'] },
  { id: 'agree', de: 'Das klingt gut.', en: 'That sounds good.', cue: 'React positively to a colleague’s suggestion.', example: 'Das klingt gut. Um wie viel Uhr treffen wir uns?', note: 'Add a practical follow-up question.', tags: ['smalltalk', 'work'] },
  { id: 'join', de: 'Kann ich mitkommen?', en: 'Can I come along?', cue: 'Ask to join colleagues for lunch.', example: 'Geht ihr in die Mensa? Kann ich mitkommen?', note: 'mitkommen stays together after kann.', tags: ['smalltalk'] },
  { id: 'thanks', de: 'Danke für deine Hilfe.', en: 'Thank you for your help.', cue: 'Thank a colleague after they help you.', example: 'Danke für deine Hilfe. Jetzt ist alles klar.', note: 'With Sie: Danke für Ihre Hilfe.', tags: ['work', 'smalltalk'] },
  { id: 'thinking', de: 'Einen Moment, ich überlege kurz.', en: 'One moment, let me think.', cue: 'Give yourself a little time to answer.', example: 'Einen Moment, ich überlege kurz. Ein Beispiel wäre unser Gruppenprojekt.', note: 'A natural pause is better than rushing your answer.', tags: ['repair', 'interview'] },
];

const introListening = [
  {
    title: 'A short first interview',
    transcript: 'Guten Tag, ich heiße Lena. Ich studiere Wirtschaft im dritten Semester. Ich möchte neben dem Studium praktische Erfahrung sammeln. Ich kann sechzehn Stunden pro Woche arbeiten, am Montag und am Donnerstag. Ab November könnte ich anfangen. Könnten Sie mir sagen, wie die Einarbeitung abläuft?',
    questions: [
      { id: 'hours', question: 'How many hours can Lena work each week?', options: ['Twelve', 'Sixteen', 'Twenty'], answer: 1 },
      { id: 'start', question: 'When could she start?', options: ['Immediately', 'In December', 'From November'], answer: 2 },
    ],
  },
  {
    title: 'A different applicant',
    transcript: 'Guten Tag, mein Name ist Amir. Ich studiere Informatik. In einem Uni-Projekt habe ich mit zwei anderen Studierenden eine Webseite entwickelt. Ich kann zwölf Stunden pro Woche arbeiten, vor allem am Dienstag und am Freitag. Ich könnte nächsten Monat anfangen. Wie groß ist Ihr Team?',
    questions: [
      { id: 'hours', question: 'How many hours is Amir available each week?', options: ['Twelve', 'Sixteen', 'Twenty'], answer: 0 },
      { id: 'days', question: 'Which days does he mention?', options: ['Monday and Thursday', 'Tuesday and Friday', 'Wednesday and Friday'], answer: 1 },
    ],
  },
];

export const MISSIONS = [
  {
    id: 'first-interview', number: '01', title: 'Introduce yourself. Find your words.', shortTitle: 'Your first interview',
    subtitle: 'Your studies, your motivation, and when you can work.', icon: 'briefcase', register: 'Sie · interview', level: 'A2 → B1',
    goal: 'Introduce yourself, discuss your availability, and ask one question of your own.',
    situation: 'You are having a first conversation about a Werkstudent position. Keep your answers short, specific, and true to your experience.',
    phraseIds: ['study', 'work-goal', 'hours', 'days', 'repeat', 'motivation'],
    listening: introListening,
    shadow: 'Ich möchte neben dem Studium praktische Erfahrung sammeln.',
    turns: [
      { id: 'intro', prompts: ['Guten Tag! Stellen Sie sich bitte kurz vor.', 'Schön, dass Sie da sind. Erzählen Sie uns kurz etwas über sich.'], rephrase: 'Wie heißen Sie? Was studieren Sie? Was möchten Sie hier lernen?', goal: 'Introduce your studies and one relevant interest in 30–60 seconds.', model: 'Ich heiße Lena und studiere Wirtschaft im dritten Semester. Ich interessiere mich für die Arbeit in Ihrem Team und möchte praktische Erfahrung sammeln.', phraseIds: ['study', 'work-goal', 'experience'], criteria: ['I mentioned my studies.', 'I added a relevant interest or experience.', 'I spoke in my own words.'] },
      { id: 'motivation', prompts: ['Warum interessiert Sie diese Stelle?', 'Warum möchten Sie bei uns als Werkstudent arbeiten?'], rephrase: 'Was möchten Sie bei dieser Arbeit lernen oder machen?', goal: 'Give one reason and explain it with weil.', model: 'Die Stelle interessiert mich, weil ich gerne im Team arbeite. Außerdem möchte ich das Wissen aus meinem Studium praktisch anwenden.', phraseIds: ['motivation', 'work-goal'], criteria: ['I gave a reason for my interest.', 'I explained the reason briefly.', 'I could understand my answer on replay.'] },
      { id: 'availability', prompts: ['Wie viele Stunden pro Woche können Sie arbeiten?', 'An welchen Tagen und wie viele Stunden hätten Sie Zeit?'], rephrase: 'Wann haben Sie Zeit für die Arbeit? Wie viele Stunden pro Woche?', goal: 'Give your real availability, or ask what hours the employer needs.', model: 'Ich kann sechzehn Stunden pro Woche arbeiten. Am Montag und am Donnerstag habe ich Zeit. Welche Arbeitszeiten sind für das Team wichtig?', phraseIds: ['hours', 'days', 'repeat'], criteria: ['I stated my availability or asked a relevant question.', 'I made the days or hours clear.', 'I answered without reading a model.'], intents: [{ id: 'gave-hours', label: 'I gave my available hours or days.' }, { id: 'asked-hours', label: 'I asked which hours they need.' }, { id: 'clarify', label: 'I asked for a simpler question.' }, { id: 'unsure', label: 'I said I need to check my timetable.' }] },
      { id: 'availability-followup', prompts: ['Wie können Sie die Arbeit mit Ihrem Studium verbinden?'], rephrase: 'Haben Sie auch während der Prüfungen Zeit?', goal: 'Respond to a follow-up about your schedule.', model: 'Ich plane meine Woche im Voraus. Während der Prüfungszeit würde ich die Arbeitszeiten gerne früh mit Ihnen absprechen.', phraseIds: ['hours', 'days', 'thinking'], criteria: ['I responded to the follow-up question.', 'I gave a useful detail or asked for clarification.', 'My answer was understandable to me on replay.'] },
      { id: 'start', prompts: ['Wann könnten Sie bei uns anfangen?', 'Ab wann wären Sie verfügbar?'], rephrase: 'Können Sie sofort anfangen oder erst später?', goal: 'Give a possible start date and one useful detail.', model: 'Ich könnte ab November anfangen. Meinen Stundenplan bekomme ich nächste Woche.', phraseIds: ['start', 'thinking'], criteria: ['I gave a starting point.', 'I used a complete short sentence.', 'I spoke without a model answer.'] },
      { id: 'question', prompts: ['Haben Sie noch eine Frage an uns?', 'Was möchten Sie über die Stelle wissen?'], rephrase: 'Möchten Sie etwas über das Team oder die Aufgaben fragen?', goal: 'Ask one practical question about the role.', model: 'Ja, gerne. Wie läuft die Einarbeitung ab? Und welche Aufgaben würde ich am Anfang übernehmen?', phraseIds: ['repeat', 'task'], criteria: ['I asked a relevant question.', 'I used polite Sie language.', 'I could say it without reading.'] },
    ],
    retry: 'Introduce yourself again, then give your availability. Aim for 60–90 seconds with fewer prompts.',
    resources: ['vhs', 'goethe-interview'],
  },
  {
    id: 'clear-instructions', number: '02', title: 'Understand the task. Ask clearly.', shortTitle: 'Instructions & clarification',
    subtitle: 'Ask for help, check deadlines, and confirm the next step.', icon: 'messages', register: 'du · colleagues', level: 'A2 → B1',
    goal: 'Clarify an instruction and confirm what you will do and by when.',
    situation: 'A colleague gives you a new task. Asking a clear question is part of doing the job well.',
    phraseIds: ['clarify', 'confirm', 'deadline', 'priority', 'help', 'thanks'],
    listening: [
      { title: 'A task for tomorrow', transcript: 'Kannst du bitte die Kontaktliste aktualisieren? Die neue Datei liegt im Team-Ordner. Bitte prüfe zuerst die E-Mail-Adressen. Die Telefonnummern machen wir später. Ich brauche die Liste morgen bis zwölf Uhr. Wenn etwas unklar ist, frag mich einfach.', questions: [
        { id: 'first', question: 'What should be checked first?', options: ['Phone numbers', 'Email addresses', 'The calendar'], answer: 1 },
        { id: 'when', question: 'When is the list needed?', options: ['Today at twelve', 'Tomorrow at ten', 'Tomorrow at twelve'], answer: 2 },
      ] },
      { title: 'Two tasks, one priority', transcript: 'Heute gibt es zwei Aufgaben. Bitte bereite zuerst die Unterlagen für das Meeting vor. Das Meeting beginnt um vierzehn Uhr. Danach kannst du die Kontaktliste prüfen. Die Liste brauchen wir erst am Freitag. Wenn du Hilfe brauchst, bin ich bis elf Uhr im Büro.', questions: [
        { id: 'first', question: 'What is the priority?', options: ['The contact list', 'The meeting documents', 'Calling a colleague'], answer: 1 },
        { id: 'when', question: 'When is the contact list needed?', options: ['Today', 'Tomorrow', 'On Friday'], answer: 2 },
      ] },
    ],
    shadow: 'Habe ich das richtig verstanden: Ich soll zuerst die E-Mail-Adressen prüfen?',
    turns: [
      { id: 'intro', prompts: ['Kannst du die Unterlagen bitte aufbereiten?', 'Kannst du die Liste bitte aktualisieren?'], rephrase: 'Kannst du die Informationen in der Datei prüfen?', goal: 'Ask what exactly needs to be done.', model: 'Gerne. Was genau meinst du mit „aufbereiten“? Soll ich die Informationen nur prüfen oder auch etwas ergänzen?', phraseIds: ['clarify', 'help'], criteria: ['I identified the unclear part.', 'I asked a specific question.', 'I used my own words.'] },
      { id: 'deadline', prompts: ['Bitte prüfe die E-Mail-Adressen in der Kontaktliste.'], rephrase: 'Sind die E-Mail-Adressen noch richtig? Bitte prüfe das.', goal: 'Ask when your colleague needs the result.', model: 'Alles klar. Bis wann brauchst du die Liste?', phraseIds: ['deadline'], criteria: ['I asked about the deadline.', 'My question was clear.', 'I spoke without reading.'] },
      { id: 'confirm', prompts: ['Ich brauche die Liste morgen bis zwölf Uhr.'], rephrase: 'Bitte sei morgen um zwölf Uhr fertig.', goal: 'Confirm the action and the deadline.', model: 'Habe ich das richtig verstanden: Ich prüfe die E-Mail-Adressen und schicke dir die Liste morgen vor zwölf?', phraseIds: ['confirm', 'deadline'], criteria: ['I repeated the action.', 'I repeated the correct deadline.', 'I checked that I understood.'] },
      { id: 'priority', prompts: ['Und könntest du auch die Meeting-Unterlagen vorbereiten?'], rephrase: 'Es gibt noch eine zweite Aufgabe: die Unterlagen für das Meeting.', goal: 'Ask which of the two tasks comes first.', model: 'Ja, gerne. Was soll ich zuerst machen: die Liste prüfen oder die Unterlagen vorbereiten?', phraseIds: ['priority'], criteria: ['I asked about priority.', 'I named the two tasks.', 'I could say the question without a model.'] },
      { id: 'close', prompts: ['Mach bitte zuerst die Liste. Die Unterlagen haben noch Zeit.'], rephrase: 'Die Liste ist wichtiger. Die Unterlagen kannst du später machen.', goal: 'Acknowledge the priority and close the exchange.', model: 'Alles klar, ich fange mit der Liste an. Danke für deine Hilfe.', phraseIds: ['thanks', 'confirm'], criteria: ['I acknowledged the first task.', 'I closed the exchange politely.', 'I used a short complete sentence.'] },
    ],
    retry: 'Explain the task, deadline, and priority aloud in 45–60 seconds. Include one question you would ask if something were unclear.',
    resources: ['vhs', 'goethe'],
  },
  {
    id: 'project-story', number: '03', title: 'Explain what you did.', shortTitle: 'Projects & work updates',
    subtitle: 'Your task, a problem, a next step, and a result.', icon: 'layers', register: 'Sie · interview', level: 'A2+ → B1',
    goal: 'Tell a short, truthful project story and handle follow-up questions.',
    situation: 'Use a real university, volunteer, work, or personal project. Your contribution can be small and still worth explaining.',
    phraseIds: ['experience', 'task', 'problem', 'suggest', 'result', 'reason'],
    listening: [
      { title: 'A group presentation', transcript: 'Letztes Semester haben wir zu dritt eine Präsentation vorbereitet. Meine Aufgabe war, die Ergebnisse zusammenzufassen. Am Anfang fehlten uns einige Daten. Deshalb haben wir die Dozentin gefragt. Danach konnten wir die Präsentation fertigstellen. Wir haben gelernt, Aufgaben früher im Team zu verteilen.', questions: [
        { id: 'task', question: 'What was the speaker’s task?', options: ['Collecting all the data', 'Summarising the results', 'Teaching the course'], answer: 1 },
        { id: 'problem', question: 'What was the initial problem?', options: ['Missing data', 'A broken computer', 'A late train'], answer: 0 },
      ] },
      { title: 'Organising an event', transcript: 'Ich habe bei einer Veranstaltung an der Universität geholfen. Meine Aufgabe war die Anmeldung. Am Morgen gab es ein Problem mit der Teilnehmerliste. Einige Namen fehlten. Ich habe mit einer Kollegin die E-Mails geprüft und die Liste ergänzt. Danach konnten wir alle Teilnehmenden begrüßen.', questions: [
        { id: 'task', question: 'What did the speaker help with?', options: ['The presentation', 'Registration', 'Catering'], answer: 1 },
        { id: 'solution', question: 'How was the problem solved?', options: ['Cancelling the event', 'Checking emails and adding names', 'Printing a timetable'], answer: 1 },
      ] },
    ],
    shadow: 'Meine Aufgabe war, die Ergebnisse zusammenzufassen.',
    turns: [
      { id: 'intro', prompts: ['Erzählen Sie von einem Projekt, an dem Sie mitgearbeitet haben.', 'Können Sie uns ein Beispiel aus Ihrem Studium oder Ihrer Arbeit geben?'], rephrase: 'Was haben Sie in einem Projekt gemacht?', goal: 'Introduce a real project and your role in 30–60 seconds.', model: 'Letztes Semester haben wir eine Präsentation vorbereitet. Wir waren drei Personen im Team. Meine Aufgabe war, die Ergebnisse zusammenzufassen.', phraseIds: ['task', 'experience'], criteria: ['I named a real project.', 'I explained my own role.', 'I kept the story understandable.'] },
      { id: 'detail', prompts: ['Was genau waren Ihre Aufgaben?', 'Was haben Sie persönlich zu dem Projekt beigetragen?'], rephrase: 'Was haben Sie selbst gemacht?', goal: 'Describe one specific action you took.', model: 'Ich habe die Daten geprüft und zwei Diagramme erstellt. Danach habe ich die wichtigsten Ergebnisse erklärt.', phraseIds: ['task'], criteria: ['I described my own action.', 'I gave one concrete detail.', 'I spoke in my own words.'] },
      { id: 'problem', prompts: ['Gab es dabei eine Schwierigkeit?', 'Was war an dem Projekt besonders schwierig?'], rephrase: 'Gab es ein Problem? Was ist passiert?', goal: 'Explain one problem or challenge.', model: 'Es gab ein Problem mit den Daten. Einige Informationen waren unvollständig. Deshalb mussten wir noch einmal nachfragen.', phraseIds: ['problem', 'reason'], criteria: ['I identified a difficulty.', 'I explained why it mattered.', 'My explanation was understandable.'] },
      { id: 'solution', prompts: ['Wie haben Sie das Problem gelöst?', 'Was haben Sie dann gemacht?'], rephrase: 'Was war Ihr nächster Schritt?', goal: 'Explain your next step or what you would try.', model: 'Ich habe vorgeschlagen, dass wir die fehlenden Informationen zusammen prüfen. Danach haben wir unsere Dozentin gefragt.', phraseIds: ['suggest'], criteria: ['I gave a relevant next step.', 'I connected it to the problem.', 'I could answer without reading.'] },
      { id: 'result', prompts: ['Was war das Ergebnis? Was haben Sie gelernt?', 'Was würden Sie beim nächsten Mal anders machen?'], rephrase: 'Wie ist das Projekt ausgegangen? Was haben Sie daraus gelernt?', goal: 'Give a truthful result and a short reflection.', model: 'Am Ende haben wir die Präsentation pünktlich fertiggestellt. Beim nächsten Mal würde ich die Aufgaben früher verteilen.', phraseIds: ['result'], criteria: ['I described a result.', 'I added something I learned.', 'I kept my answer specific.'] },
    ],
    retry: 'Tell the same project story again in 60–90 seconds: situation, your task, one challenge, and the result.',
    resources: ['goethe-interview', 'vhs'],
  },
  {
    id: 'colleague-smalltalk', number: '04', title: 'Keep the conversation going.', shortTitle: 'Small talk with colleagues',
    subtitle: 'A weekend story, a follow-up, and an invitation.', icon: 'coffee', register: 'du · colleagues', level: 'A2',
    goal: 'Share a short experience, ask a question back, and arrange something together.',
    situation: 'You meet a colleague during a break. A few friendly sentences and a genuine question are enough to get started.',
    phraseIds: ['weekend', 'follow', 'opinion', 'agree', 'join', 'thinking'],
    listening: [
      { title: 'Monday morning', transcript: 'Am Wochenende habe ich Freunde besucht. Wir haben zusammen gekocht und einen Film gesehen. Am Sonntag bin ich im Park spazieren gegangen. Das Wetter war schön. Und wie war es bei dir? Hast du heute Lust, zusammen in die Mensa zu gehen?', questions: [
        { id: 'sunday', question: 'What did the speaker do on Sunday?', options: ['Watched a film at the cinema', 'Walked in the park', 'Worked in the office'], answer: 1 },
        { id: 'invite', question: 'What is the invitation?', options: ['Lunch in the canteen', 'A weekend trip', 'A meeting'], answer: 0 },
      ] },
      { title: 'A quiet weekend', transcript: 'Mein Wochenende war ziemlich ruhig. Am Samstag habe ich für eine Prüfung gelernt. Am Sonntag war ich mit einer Freundin im Café. Wir haben lange geredet. Nächste Woche möchte ich wieder mehr Sport machen. Kennst du einen guten Sportkurs an der Universität?', questions: [
        { id: 'saturday', question: 'What happened on Saturday?', options: ['A sports class', 'Studying for an exam', 'Meeting a friend at a café'], answer: 1 },
        { id: 'question', question: 'What does the speaker ask about?', options: ['A university sports class', 'A good café', 'The next exam'], answer: 0 },
      ] },
    ],
    shadow: 'Mein Wochenende war ruhig. Und wie war es bei dir?',
    turns: [
      { id: 'intro', prompts: ['Hey! Wie war dein Wochenende?', 'Guten Morgen! Hast du am Wochenende etwas Schönes gemacht?'], rephrase: 'Was hast du am Samstag oder Sonntag gemacht?', goal: 'Describe one real experience in two or three sentences.', model: 'Am Wochenende habe ich Freunde besucht. Wir haben zusammen gekocht. Das war sehr schön.', phraseIds: ['weekend'], criteria: ['I shared one experience.', 'I added a detail or a feeling.', 'I could speak in my own words.'] },
      { id: 'detail', prompts: ['Was hat dir daran am besten gefallen?', 'Und wie war das für dich?'], rephrase: 'War es gut? Warum?', goal: 'Give an opinion and one reason.', model: 'Mir hat das gemeinsame Kochen gefallen, weil wir viel geredet haben.', phraseIds: ['opinion', 'thinking'], criteria: ['I gave an opinion.', 'I added a reason.', 'My answer related to my story.'] },
      { id: 'ask-back', prompts: ['Das klingt schön!'], rephrase: 'Das war bestimmt ein schönes Wochenende.', goal: 'Ask your colleague a question back.', model: 'Und wie war es bei dir? Hast du etwas Besonderes gemacht?', phraseIds: ['follow'], criteria: ['I asked a question back.', 'It fit the conversation.', 'I asked without reading a model.'] },
      { id: 'lunch', prompts: ['Ich war wandern. Übrigens, wir gehen um zwölf in die Mensa. Kommst du mit?', 'Wir gehen heute um halb eins essen. Hast du Lust mitzukommen?'], rephrase: 'Möchtest du mit uns Mittag essen?', goal: 'Accept or decline and ask one practical question.', model: 'Das klingt gut, ich komme gerne mit. Wo treffen wir uns?', phraseIds: ['agree', 'join'], criteria: ['I accepted or declined clearly.', 'I asked or confirmed a practical detail.', 'I used friendly informal language.'] },
      { id: 'close', prompts: ['Treffen wir uns vor dem Eingang. Bis später!'], rephrase: 'Wir sehen uns später am Eingang.', goal: 'Confirm the arrangement and say goodbye.', model: 'Alles klar, bis später! Ich freue mich darauf.', phraseIds: ['agree'], criteria: ['I acknowledged the arrangement.', 'I closed the conversation naturally.', 'I used my own words.'] },
    ],
    retry: 'Tell your weekend story again, then ask two follow-up questions you could use with a colleague.',
    resources: ['nicos', 'vhs'],
  },
];

export const RESOURCES = [
  { id: 'vhs', title: 'VHS · A2–B1 Deutsch Beruf', label: 'Free workplace course', url: 'https://a2-b1-beruf.vhs-lernportal.de/wws/home.php', detail: 'Choose one workplace exercise, then explain the situation aloud in your own words.' },
  { id: 'goethe', title: 'Goethe · Deutsch am Arbeitsplatz', label: 'Workplace listening & situations', url: 'https://www.goethe.de/de/spr/ueb/daa.html', detail: 'Practise an instruction, a phone call, or a conversation with colleagues.' },
  { id: 'goethe-interview', title: 'Goethe · Vorstellungsgespräch', label: 'Interview example', url: 'https://www.goethe.de/de/spr/ueb/daa/inf/tde/bew.html', detail: 'Listen for one interview question. Pause and answer it for yourself before continuing.' },
  { id: 'nicos', title: 'DW · Nicos Weg A2', label: 'Everyday German with human voices', url: 'https://learngerman.dw.com/en/nicos-weg/c-36519797', detail: 'Choose a short scene. Listen, check its meaning, then retell one part without the transcript.' },
];

export const phraseById = id => PHRASES.find(phrase => phrase.id === id);
export const missionById = id => MISSIONS.find(mission => mission.id === id);
