import { dialogue as d, turn as t, mission, RETRY_CHECKS } from '../content-helpers.js';

export const vacancyCall = mission({
  id: 'vacancy-call', title: 'Make the first call.', titleDe: 'Der erste Anruf', shortTitle: 'Calling about a vacancy',
  subtitle: 'Introduce yourself, ask useful questions, and leave a clear message.', icon: 'messages', register: 'Sie · phone call', level: 'A2', stage: 1,
  goal: ['Rufe wegen einer Stelle an, stelle zwei Fragen und hinterlasse eine Nachricht.', 'Call about a vacancy, ask two questions, and leave a message.'],
  situation: ['Du hast eine passende Stellenanzeige gefunden. Kläre am Telefon die wichtigsten Informationen.', 'You found a relevant vacancy. Call to clarify the information you need.'],
  phraseIds: ['call-about', 'phone-intro', 'position-open', 'speak-person', 'leave-message', 'callback', 'spell', 'email-address', 'application-docs', 'reach-again'],
  resources: ['nicos-vacancy', 'dw-phone'],
  listening: [
    d('Eine Stelle im Büro', [
      ['Firma', 'Firma Morgenstern, Weber, guten Tag.', 'Morgenstern company, Weber speaking, hello.'],
      ['Sam', 'Guten Tag, hier spricht Sam Becker. Ich rufe wegen Ihrer Werkstudentenstelle im Büro an. Ist die Stelle noch frei?', 'Hello, this is Sam Becker. I am calling about your student job in the office. Is it still available?'],
      ['Firma', 'Ja. Wir suchen Unterstützung für zwölf Stunden pro Woche.', 'Yes. We are looking for support for twelve hours a week.'],
      ['Sam', 'Welche Unterlagen benötigen Sie?', 'Which documents do you need?'],
      ['Firma', 'Bitte schicken Sie uns Ihren Lebenslauf und Ihre Immatrikulationsbescheinigung per E-Mail.', 'Please email us your CV and proof of enrolment.'],
      ['Sam', 'Vielen Dank. Dann schicke ich Ihnen die Unterlagen heute.', 'Thank you. I will send the documents today.'],
    ], [
      ['available', 'Ist die Stelle noch frei?', 'Is the position still available?', [['Ja', 'Yes'], ['Nein', 'No'], ['Das ist unklar', 'It is unclear']], 0],
      ['hours', 'Wie viele Stunden pro Woche sind vorgesehen?', 'How many hours per week are planned?', [['Zehn', 'Ten'], ['Zwölf', 'Twelve'], ['Zwanzig', 'Twenty']], 1],
      ['documents', 'Wie soll Sam die Unterlagen schicken?', 'How should Sam send the documents?', [['Per Post', 'By post'], ['Persönlich abgeben', 'Hand them in in person'], ['Per E-Mail', 'By email']], 2],
    ]),
    d('Eine Nachricht hinterlassen', [
      ['Sam', 'Guten Tag, mein Name ist Sam Becker. Könnte ich bitte Frau Keller sprechen?', 'Hello, my name is Sam Becker. Could I speak to Ms Keller?'],
      ['Empfang', 'Frau Keller ist gerade in einem Meeting. Worum geht es?', 'Ms Keller is in a meeting. What is it about?'],
      ['Sam', 'Ich habe eine Frage zur Werkstudentenstelle. Kann ich eine Nachricht hinterlassen?', 'I have a question about the student job. Can I leave a message?'],
      ['Empfang', 'Natürlich. Wann kann sie Sie zurückrufen?', 'Of course. When can she call you back?'],
      ['Sam', 'Heute ab vierzehn Uhr bin ich erreichbar. Meine Nummer steht in meiner Bewerbung.', 'I can be reached today from two pm. My number is in my application.'],
      ['Empfang', 'Gut, ich gebe Frau Keller Bescheid.', 'Good, I will let Ms Keller know.'],
    ], [
      ['where', 'Warum ist Frau Keller nicht erreichbar?', 'Why is Ms Keller unavailable?', [['Sie ist krank', 'She is ill'], ['Sie ist im Urlaub', 'She is on holiday'], ['Sie ist in einem Meeting', 'She is in a meeting']], 2],
      ['time', 'Ab wann ist Sam erreichbar?', 'From when can Sam be reached?', [['Ab 12 Uhr', 'From noon'], ['Ab 14 Uhr', 'From two pm'], ['Ab 16 Uhr', 'From four pm']], 1],
      ['number', 'Wo steht Sams Telefonnummer?', 'Where is Sam’s phone number?', [['In der Bewerbung', 'In the application'], ['Auf der Webseite', 'On the website'], ['Im Kalender', 'In the calendar']], 0],
    ]),
    d('Den Namen klären', [
      ['Empfang', 'Für die Stelle ist Herr Mertens zuständig.', 'Mr Mertens is responsible for the vacancy.'],
      ['Sam', 'Könnten Sie den Namen bitte buchstabieren?', 'Could you spell the name, please?'],
      ['Empfang', 'M-e-r-t-e-n-s. Sie erreichen ihn morgen zwischen neun und elf Uhr.', 'M-e-r-t-e-n-s. You can reach him tomorrow between nine and eleven.'],
      ['Sam', 'Vielen Dank. Geht es um eine Stelle mit Kundenkontakt?', 'Thank you. Is it a position involving customer contact?'],
      ['Empfang', 'Ja, am Empfang und am Telefon.', 'Yes, at reception and on the phone.'],
      ['Sam', 'Das interessiert mich. Ich rufe morgen Vormittag noch einmal an.', 'That interests me. I will call again tomorrow morning.'],
    ], [
      ['person', 'Wer ist für die Stelle zuständig?', 'Who is responsible for the position?', [['Frau Keller', 'Ms Keller'], ['Herr Mertens', 'Mr Mertens'], ['Herr Weber', 'Mr Weber']], 1],
      ['when', 'Wann ist die Person erreichbar?', 'When can the person be reached?', [['Morgen zwischen 9 und 11 Uhr', 'Tomorrow between 9 and 11'], ['Heute ab 14 Uhr', 'Today from 14:00'], ['Am Freitagabend', 'On Friday evening']], 0],
      ['task', 'Wo arbeitet man in dieser Stelle?', 'Where does one work in this position?', [['Im Lager', 'In a warehouse'], ['Im Labor', 'In a laboratory'], ['Am Empfang und am Telefon', 'At reception and on the phone']], 2],
    ]),
  ],
  shadow: ['Ich rufe wegen Ihrer Werkstudentenstelle an. Ist die Stelle noch frei?', 'I am calling about your student job. Is the position still available?'],
  turns: [
    t('intro', { essential: true, ask: ['Firma Morgenstern, guten Tag. Wie kann ich Ihnen helfen?', 'Morgenstern company, hello. How can I help?'], simpler: ['Guten Tag. Warum rufen Sie an?', 'Hello. Why are you calling?'],
      goal: ['Nenne deinen Namen und den Grund deines Anrufs.', 'Give your name and the reason for calling.'], model: ['Guten Tag, hier spricht Sam Becker. Ich rufe wegen Ihrer Werkstudentenstelle an.', 'Hello, this is Sam Becker. I am calling about your student position.'], phrases: ['phone-intro', 'call-about'],
      checks: [['Ich habe meinen Namen genannt.', 'I gave my name.'], ['Ich habe mein Anliegen genannt.', 'I stated why I was calling.'], ['Ich habe höflich gesprochen.', 'I used polite language.']] }),
    t('questions', { essential: true, ask: ['Ja, die Stelle ist noch frei. Was möchten Sie wissen?', 'Yes, the position is still available. What would you like to know?'], simpler: ['Welche Frage haben Sie zur Stelle?', 'What question do you have about the job?'],
      goal: ['Frage nach Arbeitszeiten oder Bewerbungsunterlagen.', 'Ask about working hours or application documents.'], model: ['Wie viele Stunden pro Woche sind vorgesehen? Und welche Unterlagen benötigen Sie?', 'How many hours a week are planned? And which documents do you need?'], phrases: ['hours', 'application-docs'],
      intents: [{ id: 'hours', label: 'I asked about working hours.', labelDe: 'Ich habe nach den Arbeitszeiten gefragt.' }, { id: 'documents', label: 'I asked about the documents.', labelDe: 'Ich habe nach den Unterlagen gefragt.' }],
      checks: [['Meine Frage passt zur Stelle.', 'My question is relevant to the position.'], ['Ich habe nach einer konkreten Information gefragt.', 'I asked for specific information.'], ['Meine Frage war verständlich.', 'My question was understandable.']] }),
    t('details', { ask: ['Wir brauchen Unterstützung an zwei Tagen pro Woche. Passt das zu Ihrem Studium?', 'We need support on two days a week. Does that fit your studies?'], simpler: ['Können Sie an zwei Tagen arbeiten?', 'Can you work on two days?'],
      goal: ['Antworte auf die neue Information und frage bei Bedarf nach.', 'Respond to the new information and clarify if needed.'], model: ['Zwei Tage wären möglich. Können wir die genauen Tage vorher absprechen?', 'Two days would be possible. Can we agree on the exact days in advance?'], phrases: ['days', 'agree-hours'],
      branch: { from: 'questions', options: { documents: { prompt: 'Bitte schicken Sie Ihren Lebenslauf per E-Mail. Haben Sie dazu noch eine Frage?', promptEn: 'Please email your CV. Do you have another question about that?', rephrase: 'Können Sie uns Ihren Lebenslauf schicken?', rephraseEn: 'Can you send us your CV?', goalDe: 'Bestätige, wie du deine Bewerbung schickst, oder frage nach der Adresse.', goal: 'Confirm how you will apply, or ask for the address.', model: 'Ja, gerne. An welche E-Mail-Adresse soll ich die Unterlagen schicken?', modelEn: 'Yes, gladly. To which email address should I send the documents?' } } },
      checks: [['Ich habe auf die Information reagiert.', 'I responded to the information.'], ['Meine Antwort war konkret.', 'My answer was specific.'], ['Ich habe bei Bedarf nachgefragt.', 'I clarified if needed.']] }),
    t('message', { ask: ['Unsere Ansprechperson ist gerade nicht da. Möchten Sie eine Nachricht hinterlassen?', 'Our contact person is not here right now. Would you like to leave a message?'], simpler: ['Soll die zuständige Person Sie zurückrufen?', 'Should the responsible person call you back?'],
      goal: ['Hinterlasse dein Anliegen und eine mögliche Rückrufzeit.', 'Leave your reason for calling and a suitable callback time.'], model: ['Ja, bitte. Es geht um die Werkstudentenstelle. Ich bin heute ab vierzehn Uhr erreichbar.', 'Yes, please. It is about the student job. I can be reached today from two pm.'], phrases: ['leave-message', 'callback', 'available-after'],
      checks: [['Ich habe mein Anliegen wiederholt.', 'I repeated the reason for calling.'], ['Ich habe eine Rückrufzeit genannt.', 'I gave a callback time.'], ['Ich habe klar und ruhig gesprochen.', 'I spoke clearly and calmly.']] }),
    t('close', { ask: ['Danke, ich gebe die Nachricht weiter.', 'Thank you, I will pass on the message.'], simpler: ['Die zuständige Person bekommt Ihre Nachricht.', 'The contact person will receive your message.'],
      goal: ['Bedanke dich und beende den Anruf höflich.', 'Thank the person and end the call politely.'], model: ['Vielen Dank für Ihre Hilfe. Auf Wiederhören!', 'Thank you for your help. Goodbye!'], phrases: ['thanks', 'feedback'],
      checks: [['Ich habe mich bedankt.', 'I thanked the person.'], ['Ich habe mich verabschiedet.', 'I ended the call politely.'], ['Ich konnte ohne Modell antworten.', 'I could respond without a model.']] }),
  ],
  retry: { ask: ['Hinterlassen Sie bitte eine kurze Nachricht zur Werkstudentenstelle.', 'Please leave a short message about the student job.'], simpler: ['Sagen Sie Ihren Namen, Ihr Anliegen und eine Rückrufzeit.', 'Say your name, your reason for calling, and a callback time.'], goal: ['Sprich eine neue Nachricht von 30–45 Sekunden mit deinen eigenen Angaben.', 'Record a new 30–45-second message using your own details.'], model: ['Guten Tag, hier spricht Sam Becker. Ich interessiere mich für die Werkstudentenstelle und hätte eine Frage zu den Arbeitszeiten. Könnten Sie mich bitte morgen Vormittag zurückrufen? Vielen Dank.', 'Hello, this is Sam Becker. I am interested in the student position and have a question about the working hours. Could you call me back tomorrow morning? Thank you.'], phrases: ['phone-intro', 'call-about', 'callback'], checks: RETRY_CHECKS },
});

export const appointmentChange = mission({
  id: 'appointment-change', title: 'Find a time that works.', titleDe: 'Einen passenden Termin finden', shortTitle: 'Appointments & changes',
  subtitle: 'Understand times, propose alternatives, and confirm the details.', icon: 'clock', register: 'Sie · appointment', level: 'A2', stage: 2,
  goal: ['Vereinbare oder verschiebe einen Termin und bestätige Zeit und Ort.', 'Arrange or change an appointment and confirm the time and place.'],
  situation: ['Ein Gesprächstermin passt nicht zu deinem Stundenplan. Suche höflich eine Alternative.', 'An interview appointment conflicts with your timetable. Find a polite alternative.'],
  phraseIds: ['appointment-request', 'reschedule', 'would-time-work', 'unavailable-day', 'available-after', 'confirm-time', 'online-or-onsite', 'send-link', 'repeat-time', 'thanks-flexibility'], resources: ['nicos-vacancy', 'dw-phone', 'goethe-a2'],
  listening: [
    d('Donnerstag oder Freitag?', [
      ['Firma', 'Haben Sie am Donnerstag um halb zehn Zeit für ein kurzes Gespräch?', 'Do you have time on Thursday at half past nine for a short conversation?'],
      ['Sam', 'Am Donnerstag habe ich vormittags eine Vorlesung. Wäre Freitag um zehn Uhr möglich?', 'I have a lecture on Thursday morning. Would Friday at ten be possible?'],
      ['Firma', 'Ja, das passt. Das Gespräch findet online statt.', 'Yes, that works. The conversation will be online.'],
      ['Sam', 'Könnten Sie mir den Link per E-Mail schicken?', 'Could you email me the link?'],
      ['Firma', 'Natürlich, Sie bekommen ihn heute Nachmittag.', 'Of course, you will receive it this afternoon.'],
      ['Sam', 'Vielen Dank. Dann sprechen wir am Freitag um zehn Uhr.', 'Thank you. Then we will speak on Friday at ten.'],
    ], [
      ['first-time', 'Was bedeutet „halb zehn“?', 'What does “halb zehn” mean?', [['09:30', '09:30'], ['10:30', '10:30'], ['09:15', '09:15']], 0],
      ['final-time', 'Wann findet das Gespräch statt?', 'When will the conversation take place?', [['Donnerstag um 10 Uhr', 'Thursday at ten'], ['Freitag um 10 Uhr', 'Friday at ten'], ['Freitag um 9 Uhr', 'Friday at nine']], 1],
      ['place', 'Wo findet das Gespräch statt?', 'Where will it take place?', [['In der Universität', 'At the university'], ['Im Büro', 'At the office'], ['Online', 'Online']], 2],
    ]),
    d('Ein späterer Termin', [
      ['Firma', 'Könnten Sie am Dienstag um vierzehn Uhr ins Büro kommen?', 'Could you come to the office on Tuesday at two pm?'],
      ['Sam', 'An diesem Tag habe ich bis fünfzehn Uhr ein Seminar. Hätten Sie danach noch Zeit?', 'I have a seminar until three that day. Would you have time afterwards?'],
      ['Firma', 'Um sechzehn Uhr wäre noch ein Termin frei.', 'There is still an appointment available at four.'],
      ['Sam', 'Das passt gut. Wo soll ich mich melden?', 'That works well. Where should I report?'],
      ['Firma', 'Bitte kommen Sie zum Empfang im Erdgeschoss.', 'Please come to reception on the ground floor.'],
      ['Sam', 'Gut, Dienstag um sechzehn Uhr am Empfang. Vielen Dank.', 'Good, Tuesday at four at reception. Thank you.'],
    ], [
      ['conflict', 'Warum passt 14 Uhr nicht?', 'Why does two pm not work?', [['Sam hat ein Seminar', 'Sam has a seminar'], ['Sam ist krank', 'Sam is ill'], ['Der Zug fällt aus', 'The train is cancelled']], 0],
      ['time', 'Welche Uhrzeit wird vereinbart?', 'Which time is agreed?', [['15 Uhr', 'Three pm'], ['16 Uhr', 'Four pm'], ['17 Uhr', 'Five pm']], 1],
      ['where', 'Wo soll Sam sich melden?', 'Where should Sam report?', [['Im zweiten Stock', 'On the second floor'], ['Im Besprechungsraum', 'In the meeting room'], ['Am Empfang im Erdgeschoss', 'At reception on the ground floor']], 2],
    ]),
    d('Wegen einer Prüfung verschieben', [
      ['Sam', 'Guten Tag. Wir haben am Mittwoch um elf Uhr einen Termin. Könnten wir ihn verschieben?', 'Hello. We have an appointment on Wednesday at eleven. Could we move it?'],
      ['Firma', 'Gibt es einen bestimmten Grund?', 'Is there a particular reason?'],
      ['Sam', 'Meine Prüfung wurde auf Mittwoch verlegt. Am Donnerstag hätte ich ab dreizehn Uhr Zeit.', 'My exam was moved to Wednesday. On Thursday I would be free from one pm.'],
      ['Firma', 'Dann nehmen wir Donnerstag um halb zwei. Das Gespräch dauert ungefähr dreißig Minuten.', 'Then let us take Thursday at half past one. The conversation will take about thirty minutes.'],
      ['Sam', 'Donnerstag um dreizehn Uhr dreißig, richtig?', 'Thursday at thirteen thirty, correct?'],
      ['Firma', 'Genau. Ich schicke Ihnen eine neue Bestätigung.', 'Exactly. I will send you a new confirmation.'],
    ], [
      ['why', 'Warum möchte Sam den Termin ändern?', 'Why does Sam want to change the appointment?', [['Wegen einer Reise', 'Because of a trip'], ['Wegen einer Prüfung', 'Because of an exam'], ['Wegen der Arbeit', 'Because of work']], 1],
      ['when', 'Wann ist der neue Termin?', 'When is the new appointment?', [['Donnerstag 13:30', 'Thursday 13:30'], ['Mittwoch 11:00', 'Wednesday 11:00'], ['Donnerstag 14:30', 'Thursday 14:30']], 0],
      ['length', 'Wie lange dauert das Gespräch ungefähr?', 'How long will the conversation take approximately?', [['Eine Stunde', 'One hour'], ['Zehn Minuten', 'Ten minutes'], ['Dreißig Minuten', 'Thirty minutes']], 2],
    ]),
  ],
  shadow: ['Wäre Freitag um zehn Uhr möglich? Dann halten wir diesen Termin fest.', 'Would Friday at ten be possible? Then let us confirm that appointment.'],
  turns: [
    t('intro', { essential: true, ask: ['Hätten Sie am Donnerstag um halb zehn Zeit für ein Gespräch?', 'Would you have time for a conversation on Thursday at half past nine?'], simpler: ['Passt Donnerstag um neun Uhr dreißig?', 'Does Thursday at nine thirty work?'], goal: ['Sage, ob der Termin passt, oder schlage eine Alternative vor.', 'Say whether the time works or propose an alternative.'], model: ['Am Donnerstag bin ich leider verhindert. Wäre Freitag um zehn Uhr möglich?', 'Unfortunately I am unavailable on Thursday. Would Friday at ten be possible?'], phrases: ['unavailable-day', 'would-time-work', 'reschedule'], checks: [['Ich habe die Uhrzeit verstanden.', 'I understood the time.'], ['Ich habe klar zu- oder abgesagt.', 'I accepted or declined clearly.'], ['Bei Bedarf habe ich eine Alternative genannt.', 'I offered an alternative if needed.']] }),
    t('confirm', { essential: true, ask: ['Freitag um zehn Uhr passt. Können Sie den Termin bitte kurz bestätigen?', 'Friday at ten works. Could you briefly confirm the appointment?'], simpler: ['An welchem Tag und um wie viel Uhr sprechen wir?', 'On which day and at what time will we speak?'], goal: ['Bestätige Freitag um zehn Uhr in einem vollständigen Satz.', 'Confirm Friday at ten in a complete sentence.'], model: ['Gerne. Dann halten wir Freitag um zehn Uhr fest.', 'Gladly. Then let us confirm Friday at ten.'], phrases: ['confirm-time', 'repeat-time'], checks: [['Ich habe Freitag genannt.', 'I said Friday.'], ['Ich habe zehn Uhr genannt.', 'I said ten o’clock.'], ['Ich habe einen vollständigen Satz benutzt.', 'I used a complete sentence.']] }),
    t('format', { ask: ['Haben Sie noch eine organisatorische Frage?', 'Do you have another practical question?'], simpler: ['Möchten Sie wissen, wo das Gespräch stattfindet?', 'Would you like to know where the conversation will take place?'], goal: ['Frage, ob das Gespräch online oder vor Ort stattfindet.', 'Ask whether the conversation will be online or in person.'], model: ['Ja, findet das Gespräch online oder vor Ort statt?', 'Yes, will the conversation take place online or in person?'], phrases: ['online-or-onsite'], checks: [['Ich habe nach dem Format gefragt.', 'I asked about the format.'], ['Meine Frage war eindeutig.', 'My question was unambiguous.'], ['Ich habe höflich gefragt.', 'I asked politely.']] }),
    t('link', { ask: ['Das Gespräch findet online statt. Was brauchen Sie noch von uns?', 'It will take place online. What else do you need from us?'], simpler: ['Brauchen Sie den Link zum Gespräch?', 'Do you need the meeting link?'], goal: ['Bitte um den Zugangslink per E-Mail.', 'Ask for the meeting link by email.'], model: ['Könnten Sie mir den Link bitte per E-Mail schicken?', 'Could you please email me the link?'], phrases: ['send-link', 'email-address'], checks: [['Ich habe um den Link gebeten.', 'I requested the link.'], ['Ich habe den gewünschten Versandweg genannt.', 'I stated how I would like to receive it.'], ['Ich konnte ohne Modell antworten.', 'I could respond without a model.']] }),
    t('close', { ask: ['Den Link bekommen Sie heute. Dann bis Freitag!', 'You will receive the link today. See you on Friday!'], simpler: ['Wir sehen uns am Freitag online.', 'We will see each other online on Friday.'], goal: ['Bedanke dich für die Terminänderung und verabschiede dich.', 'Thank the person for changing the appointment and say goodbye.'], model: ['Vielen Dank für Ihr Entgegenkommen. Bis Freitag, auf Wiederhören!', 'Thank you for accommodating me. See you Friday, goodbye!'], phrases: ['thanks-flexibility'], checks: [['Ich habe mich bedankt.', 'I thanked the person.'], ['Ich habe mich höflich verabschiedet.', 'I ended politely.'], ['Ich habe den Termin nicht verwechselt.', 'I did not mix up the appointment.']] }),
  ],
  retry: { ask: ['Der Termin am Freitag passt Ihnen doch nicht. Bitten Sie um eine neue Uhrzeit.', 'Friday’s appointment no longer works for you. Request a new time.'], simpler: ['Nennen Sie einen Grund und schlagen Sie einen neuen Termin vor.', 'Give a reason and suggest another appointment.'], goal: ['Formuliere in 45–60 Sekunden eine höfliche Änderung mit Grund, Alternative und Rückfrage.', 'In 45–60 seconds, give a polite change request with a reason, an alternative, and a question.'], model: ['Guten Tag, leider hat sich mein Stundenplan geändert. Könnten wir den Termin verschieben? Am Montag hätte ich ab vierzehn Uhr Zeit. Wäre das für Sie möglich?', 'Hello, unfortunately my timetable has changed. Could we move the appointment? I would be free on Monday from two pm. Would that work for you?'], phrases: ['reschedule', 'available-after', 'would-time-work'], checks: RETRY_CHECKS },
});

// The confirmation and closing follow the learner's stated scheduling intent.
appointmentChange.turns.find(turn => turn.id === 'intro').intents = [
  { id: 'accepted', labelDe: 'Ich habe Donnerstag um 09:30 zugesagt.', label: 'I accepted Thursday at 09:30.' },
  { id: 'friday', labelDe: 'Ich habe Freitag um 10:00 vorgeschlagen.', label: 'I proposed Friday at 10:00.' },
  { id: 'check', labelDe: 'Ich muss einen anderen Termin prüfen.', label: 'I need to check another time.' },
];
appointmentChange.turns.find(turn => turn.id === 'confirm').branch = {
  from: 'intro', options: {
    accepted: {
      prompt: 'Gut, dann Donnerstag um halb zehn. Können Sie den Termin bitte kurz bestätigen?', promptEn: 'Good, then Thursday at half past nine. Could you briefly confirm it?',
      rephrase: 'An welchem Tag und um wie viel Uhr sprechen wir?', rephraseEn: 'On which day and at what time will we speak?',
      goalDe: 'Bestätige Donnerstag um 09:30 in einem vollständigen Satz.', goal: 'Confirm Thursday at 09:30 in a complete sentence.',
      model: 'Gerne. Dann halten wir Donnerstag um neun Uhr dreißig fest.', modelEn: 'Gladly. Then let us confirm Thursday at nine thirty.',
      criteria: ['I said Thursday.', 'I said nine thirty.', 'I used a complete sentence.'], criteriaDe: ['Ich habe Donnerstag genannt.', 'Ich habe 09:30 genannt.', 'Ich habe einen vollständigen Satz benutzt.'],
    },
    check: {
      prompt: 'Kein Problem. Bis wann können Sie einen passenden Termin vorschlagen?', promptEn: 'No problem. By when can you suggest a suitable appointment?',
      rephrase: 'Wann geben Sie uns wegen des Termins Bescheid?', rephraseEn: 'When will you let us know about the appointment?',
      goalDe: 'Vereinbare eine Rückmeldung, statt einen unbestätigten Termin zuzusagen.', goal: 'Agree on a reply instead of confirming an unverified appointment.',
      model: 'Ich prüfe meinen Kalender und gebe Ihnen bis morgen Mittag Bescheid.', modelEn: 'I will check my calendar and let you know by tomorrow noon.',
      criteria: ['I explained what I need to check.', 'I gave a time for my reply.', 'I did not confirm an unknown date.'], criteriaDe: ['Ich habe gesagt, was ich prüfen muss.', 'Ich habe einen Zeitpunkt für meine Rückmeldung genannt.', 'Ich habe keinen unklaren Termin bestätigt.'],
    },
  },
};
appointmentChange.turns.find(turn => turn.id === 'close').branch = {
  from: 'intro', options: {
    accepted: { prompt: 'Den Link bekommen Sie heute. Dann bis Donnerstag!', promptEn: 'You will receive the link today. See you on Thursday!', rephrase: 'Wir sehen uns am Donnerstag online.', rephraseEn: 'We will see each other online on Thursday.', model: 'Vielen Dank. Bis Donnerstag, auf Wiederhören!', modelEn: 'Thank you. See you on Thursday, goodbye!' },
    check: { prompt: 'Dann warten wir auf Ihre Rückmeldung zum Termin. Vielen Dank!', promptEn: 'Then we will wait for your reply about the appointment. Thank you!', rephrase: 'Bitte melden Sie sich, sobald Sie Ihren Kalender geprüft haben.', rephraseEn: 'Please get back to us once you have checked your calendar.', model: 'Vielen Dank für Ihr Verständnis. Ich melde mich morgen. Auf Wiederhören!', modelEn: 'Thank you for understanding. I will get back to you tomorrow. Goodbye!' },
  },
};
