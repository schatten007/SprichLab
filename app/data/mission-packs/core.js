import { MISSIONS as LEGACY } from '../legacy-content.js';
import { dialogue as d, RETRY_CHECKS } from '../content-helpers.js';

// Each row: German goal, English prompt(s), English rephrase/model, German rubric.
const translations = {
  'first-interview': [
    ['Stelle dein Studium und ein relevantes Interesse in 30–60 Sekunden vor.', ['Hello! Please introduce yourself briefly.', 'It is good to have you here. Tell us a little about yourself.'], 'What is your name? What do you study? What would you like to learn here?', 'My name is Lena and I study business in my third semester. I am interested in working in your team and would like to gain practical experience.', ['Ich habe mein Studium genannt.', 'Ich habe ein relevantes Interesse oder eine Erfahrung ergänzt.', 'Ich habe in eigenen Worten gesprochen.']],
    ['Nenne einen Grund für dein Interesse und erkläre ihn mit „weil“.', ['Why are you interested in this position?', 'Why would you like to work here as a student employee?'], 'What would you like to learn or do in this job?', 'The position interests me because I enjoy working in a team. I would also like to apply what I learn at university in practice.', ['Ich habe einen Grund für mein Interesse genannt.', 'Ich habe den Grund kurz erklärt.', 'Meine Antwort war beim Anhören verständlich.']],
    ['Nenne deine echten verfügbaren Zeiten oder frage nach dem Bedarf des Teams.', ['How many hours a week can you work?', 'Which days and how many hours would you have available?'], 'When do you have time for work? How many hours a week?', 'I can work sixteen hours a week. I am available on Mondays and Thursdays. Which working hours matter to the team?', ['Ich habe meine Verfügbarkeit genannt oder passend nachgefragt.', 'Ich habe Tage oder Stunden klar genannt.', 'Ich habe ohne Modell geantwortet.']],
    ['Antworte auf eine Rückfrage zu deinem Stundenplan.', ['How can you combine this work with your studies?'], 'Do you also have time during exams?', 'I plan my week in advance. During exams I would like to agree on my working hours with you early.', ['Ich habe auf die Rückfrage geantwortet.', 'Ich habe ein Detail ergänzt oder nachgefragt.', 'Meine Antwort war beim Anhören verständlich.']],
    ['Nenne einen möglichen Arbeitsbeginn und ein hilfreiches Detail.', ['When could you start working with us?', 'From when would you be available?'], 'Can you start immediately or only later?', 'I could start from November. I will receive my timetable next week.', ['Ich habe einen Startzeitpunkt genannt.', 'Ich habe einen vollständigen kurzen Satz benutzt.', 'Ich habe ohne Modell gesprochen.']],
    ['Stelle eine praktische Frage zur Stelle.', ['Do you have another question for us?', 'What would you like to know about the position?'], 'Would you like to ask something about the team or tasks?', 'Yes, gladly. How does onboarding work? And which tasks would I take on at the start?', ['Ich habe eine relevante Frage gestellt.', 'Ich habe die höfliche Sie-Form benutzt.', 'Ich konnte ohne Ablesen sprechen.']],
  ],
  'clear-instructions': [
    ['Frage, was genau gemacht werden soll.', ['Could you prepare the documents, please?', 'Could you update the list, please?'], 'Could you check the information in the file?', 'Gladly. What exactly do you mean by “prepare”? Should I only check the information or also add something?', ['Ich habe den unklaren Teil benannt.', 'Ich habe gezielt nachgefragt.', 'Ich habe eigene Worte benutzt.']],
    ['Frage nach der Frist für die Liste.', ['Please check the email addresses in the contact list.'], 'Are the email addresses still correct? Please check that.', 'All right. When do you need the list by?', ['Ich habe nach der Frist gefragt.', 'Meine Frage war klar.', 'Ich habe ohne Ablesen gesprochen.']],
    ['Wiederhole die Aufgabe und die Frist richtig.', ['I need the list tomorrow by noon.'], 'Please be finished tomorrow at noon.', 'Have I understood correctly: I will check the email addresses and send you the list before noon tomorrow?', ['Ich habe die Aufgabe wiederholt.', 'Ich habe die richtige Frist genannt.', 'Ich habe mein Verständnis überprüft.']],
    ['Frage, welche der beiden Aufgaben zuerst kommt.', ['And could you also prepare the meeting documents?'], 'There is a second task: the meeting documents.', 'Yes, gladly. What should I do first: check the list or prepare the documents?', ['Ich habe nach der Priorität gefragt.', 'Ich habe die beiden Aufgaben genannt.', 'Ich konnte ohne Modell fragen.']],
    ['Bestätige die Priorität und beende das Gespräch freundlich.', ['Please do the list first. There is still time for the documents.'], 'The list is more important. You can do the documents later.', 'All right, I will start with the list. Thank you for your help.', ['Ich habe die erste Aufgabe bestätigt.', 'Ich habe das Gespräch höflich beendet.', 'Ich habe einen vollständigen kurzen Satz benutzt.']],
  ],
  'project-story': [
    ['Stelle ein echtes Projekt und deine Rolle in 30–60 Sekunden vor.', ['Tell us about a project you worked on.', 'Can you give us an example from your studies or work?'], 'What did you do in a project?', 'Last semester we prepared a presentation. There were three people on the team. My task was to summarise the results.', ['Ich habe ein echtes Projekt genannt.', 'Ich habe meine eigene Rolle erklärt.', 'Meine Geschichte war verständlich.']],
    ['Beschreibe eine konkrete Handlung von dir.', ['What exactly were your tasks?', 'What did you personally contribute to the project?'], 'What did you do yourself?', 'I checked the data and created two charts. Then I explained the key results.', ['Ich habe meine eigene Handlung beschrieben.', 'Ich habe ein konkretes Detail genannt.', 'Ich habe eigene Worte benutzt.']],
    ['Erkläre eine Schwierigkeit und warum sie wichtig war.', ['Was there a difficulty?', 'What was particularly difficult about the project?'], 'Was there a problem? What happened?', 'There was a problem with the data. Some information was incomplete. That is why we had to ask again.', ['Ich habe eine Schwierigkeit genannt.', 'Ich habe erklärt, warum sie wichtig war.', 'Meine Erklärung war verständlich.']],
    ['Erkläre deinen nächsten Schritt oder Lösungsversuch.', ['How did you solve the problem?', 'What did you do next?'], 'What was your next step?', 'I suggested that we check the missing information together. Then we asked our lecturer.', ['Ich habe einen passenden nächsten Schritt genannt.', 'Ich habe ihn mit dem Problem verbunden.', 'Ich konnte ohne Ablesen antworten.']],
    ['Nenne das echte Ergebnis und etwas, das du gelernt hast.', ['What was the result? What did you learn?', 'What would you do differently next time?'], 'How did the project turn out? What did you learn from it?', 'In the end we finished the presentation on time. Next time I would divide up the tasks earlier.', ['Ich habe ein Ergebnis beschrieben.', 'Ich habe einen Lernpunkt ergänzt.', 'Meine Antwort war konkret.']],
  ],
  'colleague-smalltalk': [
    ['Erzähle ein echtes Erlebnis in zwei oder drei Sätzen.', ['Hey! How was your weekend?', 'Good morning! Did you do something nice at the weekend?'], 'What did you do on Saturday or Sunday?', 'At the weekend I visited friends. We cooked together. It was very nice.', ['Ich habe ein Erlebnis erzählt.', 'Ich habe ein Detail oder Gefühl ergänzt.', 'Ich konnte in eigenen Worten sprechen.']],
    ['Sage deine Meinung und begründe sie.', ['What did you like best about it?', 'And what was that like for you?'], 'Was it good? Why?', 'I liked cooking together because we talked a lot.', ['Ich habe meine Meinung genannt.', 'Ich habe einen Grund ergänzt.', 'Meine Antwort passte zu meiner Geschichte.']],
    ['Stelle deinem Gegenüber eine Frage zurück.', ['That sounds nice!'], 'That must have been a nice weekend.', 'And how was it for you? Did you do anything special?', ['Ich habe eine Frage zurückgestellt.', 'Sie passte zum Gespräch.', 'Ich habe ohne Modell gefragt.']],
    ['Sage zu oder ab und frage nach einem praktischen Detail.', ['I went hiking. By the way, we are going to the canteen at twelve. Will you join us?', 'We are going to eat at half past twelve today. Would you like to join?'], 'Would you like to have lunch with us?', 'That sounds good, I would like to join you. Where shall we meet?', ['Ich habe klar zu- oder abgesagt.', 'Ich habe ein praktisches Detail erfragt oder bestätigt.', 'Ich habe freundlich und informell gesprochen.']],
    ['Bestätige die Verabredung und verabschiede dich.', ['Let us meet in front of the entrance. See you later!'], 'We will see each other at the entrance later.', 'All right, see you later! I am looking forward to it.', ['Ich habe die Verabredung bestätigt.', 'Ich habe das Gespräch natürlich beendet.', 'Ich habe eigene Worte benutzt.']],
  ],
};

const listenings = {
  'first-interview': [
    d('Ein erstes Gespräch', [
      ['Interviewer', 'Stellen Sie sich bitte kurz vor.', 'Please introduce yourself briefly.'],
      ['Lena', 'Ich heiße Lena und studiere Wirtschaft im dritten Semester. Ich möchte praktische Erfahrung sammeln.', 'My name is Lena and I study business in my third semester. I would like practical experience.'],
      ['Interviewer', 'Wie viel Zeit haben Sie, und wann könnten Sie anfangen?', 'How much time do you have, and when could you start?'],
      ['Lena', 'Ich kann sechzehn Stunden pro Woche arbeiten, am Montag und am Donnerstag. Ab November könnte ich anfangen.', 'I can work sixteen hours a week, on Monday and Thursday. I could start from November.'],
      ['Interviewer', 'Haben Sie noch eine Frage?', 'Do you have another question?'],
      ['Lena', 'Ja, wie läuft die Einarbeitung ab?', 'Yes, how does onboarding work?'],
    ], [
      ['hours', 'Wie viele Stunden kann Lena pro Woche arbeiten?', 'How many hours can Lena work each week?', [['Zwölf', 'Twelve'], ['Sechzehn', 'Sixteen'], ['Zwanzig', 'Twenty']], 1],
      ['start', 'Wann könnte Lena anfangen?', 'When could Lena start?', [['Sofort', 'Immediately'], ['Im Dezember', 'In December'], ['Ab November', 'From November']], 2],
      ['days', 'Welche Tage nennt Lena?', 'Which days does Lena mention?', [['Montag und Donnerstag', 'Monday and Thursday'], ['Dienstag und Freitag', 'Tuesday and Friday'], ['Mittwoch und Samstag', 'Wednesday and Saturday']], 0],
    ]),
    d('Eine andere Erfahrung', [
      ['Interviewer', 'Was studieren Sie, Amir?', 'What do you study, Amir?'],
      ['Amir', 'Ich studiere Informatik. In einem Uni-Projekt habe ich mit zwei anderen Studierenden eine Webseite entwickelt.', 'I study computer science. In a university project I developed a website with two other students.'],
      ['Interviewer', 'Wann könnten Sie bei uns arbeiten?', 'When could you work with us?'],
      ['Amir', 'Ich kann zwölf Stunden pro Woche arbeiten, vor allem dienstags und freitags. Ich könnte nächsten Monat anfangen.', 'I can work twelve hours a week, especially on Tuesdays and Fridays. I could start next month.'],
      ['Interviewer', 'Was möchten Sie über uns wissen?', 'What would you like to know about us?'],
      ['Amir', 'Wie groß ist Ihr Team?', 'How big is your team?'],
    ], [
      ['hours', 'Wie viele Stunden ist Amir verfügbar?', 'How many hours is Amir available?', [['Zwölf pro Woche', 'Twelve per week'], ['Sechzehn pro Woche', 'Sixteen per week'], ['Zwanzig pro Woche', 'Twenty per week']], 0],
      ['days', 'Welche Tage passen besonders gut?', 'Which days work especially well?', [['Montag und Donnerstag', 'Monday and Thursday'], ['Dienstag und Freitag', 'Tuesday and Friday'], ['Mittwoch und Freitag', 'Wednesday and Friday']], 1],
      ['project', 'Was hat Amir im Uni-Projekt entwickelt?', 'What did Amir develop in the university project?', [['Eine Ausstellung', 'An exhibition'], ['Eine Umfrage', 'A survey'], ['Eine Webseite', 'A website']], 2],
    ]),
    d('Erfahrungen aus dem Ehrenamt', [
      ['Interviewer', 'Mia, was interessiert Sie an dieser Stelle?', 'Mia, what interests you about this position?'],
      ['Mia', 'Ich studiere Sozialwissenschaften und helfe ehrenamtlich bei einer Beratungsstelle. Ich arbeite gerne mit Menschen.', 'I study social sciences and volunteer at an advice centre. I enjoy working with people.'],
      ['Interviewer', 'Wie viel Zeit hätten Sie?', 'How much time would you have?'],
      ['Mia', 'Acht Stunden pro Woche wären möglich, mittwochs am Nachmittag und freitags.', 'Eight hours a week would be possible, on Wednesday afternoons and Fridays.'],
      ['Interviewer', 'Wann könnten Sie anfangen?', 'When could you start?'],
      ['Mia', 'Ab Januar. Wer wäre am Anfang meine Ansprechperson?', 'From January. Who would be my contact person at the start?'],
    ], [
      ['experience', 'Wo hilft Mia ehrenamtlich?', 'Where does Mia volunteer?', [['Bei einer Beratungsstelle', 'At an advice centre'], ['In einem Sportverein', 'At a sports club'], ['In einem Labor', 'In a laboratory']], 0],
      ['hours', 'Wie viele Stunden pro Woche passen?', 'How many hours per week fit?', [['Zwölf', 'Twelve'], ['Acht', 'Eight'], ['Sechzehn', 'Sixteen']], 1],
      ['start', 'Ab wann könnte Mia anfangen?', 'From when could Mia start?', [['Ab November', 'From November'], ['Ab Dezember', 'From December'], ['Ab Januar', 'From January']], 2],
    ]),
  ],
  'clear-instructions': [
    d('Eine Liste aktualisieren', [
      ['Lea', 'Kannst du bitte die Kontaktliste aktualisieren? Die neue Datei liegt im Team-Ordner.', 'Could you update the contact list? The new file is in the team folder.'],
      ['Sam', 'Was soll ich zuerst prüfen?', 'What should I check first?'],
      ['Lea', 'Bitte prüfe zuerst die E-Mail-Adressen. Die Telefonnummern machen wir später.', 'Please check the email addresses first. We will do the phone numbers later.'],
      ['Sam', 'Bis wann brauchst du die Liste?', 'When do you need the list by?'],
      ['Lea', 'Morgen bis zwölf Uhr. Wenn etwas unklar ist, frag mich einfach.', 'Tomorrow by noon. If anything is unclear, just ask me.'],
    ], [
      ['first', 'Was soll zuerst geprüft werden?', 'What should be checked first?', [['Die Telefonnummern', 'Phone numbers'], ['Die E-Mail-Adressen', 'Email addresses'], ['Der Kalender', 'The calendar']], 1],
      ['when', 'Bis wann wird die Liste gebraucht?', 'By when is the list needed?', [['Heute um zwölf', 'Today at noon'], ['Morgen um zehn', 'Tomorrow at ten'], ['Morgen um zwölf', 'Tomorrow at noon']], 2],
      ['where', 'Wo liegt die neue Datei?', 'Where is the new file?', [['Im Team-Ordner', 'In the team folder'], ['Auf Papier', 'On paper'], ['Auf Sams Handy', 'On Sam’s phone']], 0],
    ]),
    d('Zwei Aufgaben', [
      ['Lea', 'Heute gibt es zwei Aufgaben: die Meeting-Unterlagen und die Kontaktliste.', 'Today there are two tasks: the meeting documents and the contact list.'],
      ['Sam', 'Was soll ich zuerst machen?', 'What should I do first?'],
      ['Lea', 'Bitte bereite zuerst die Unterlagen vor. Das Meeting beginnt um vierzehn Uhr.', 'Please prepare the documents first. The meeting starts at two pm.'],
      ['Sam', 'Und wann muss die Liste fertig sein?', 'And when does the list need to be finished?'],
      ['Lea', 'Erst am Freitag. Wenn du Hilfe brauchst, bin ich bis elf Uhr im Büro.', 'Not until Friday. If you need help, I will be in the office until eleven.'],
    ], [
      ['first', 'Was hat Priorität?', 'What is the priority?', [['Die Kontaktliste', 'The contact list'], ['Die Meeting-Unterlagen', 'The meeting documents'], ['Ein Telefonat', 'A phone call']], 1],
      ['when', 'Wann wird die Kontaktliste gebraucht?', 'When is the contact list needed?', [['Heute', 'Today'], ['Morgen', 'Tomorrow'], ['Am Freitag', 'On Friday']], 2],
      ['meeting', 'Wann beginnt das Meeting?', 'When does the meeting begin?', [['Um 14 Uhr', 'At two pm'], ['Um 11 Uhr', 'At eleven'], ['Um 16 Uhr', 'At four pm']], 0],
    ]),
    d('Eine Anweisung bestätigen', [
      ['Lea', 'Bitte prüfe die Anmeldungen und markiere die fehlenden Angaben.', 'Please check the registrations and mark missing information.'],
      ['Sam', 'Soll ich die Personen auch gleich anschreiben?', 'Should I also contact those people straight away?'],
      ['Lea', 'Noch nicht. Schick mir zuerst die Übersicht bis morgen um zehn Uhr.', 'Not yet. First send me the overview by ten tomorrow.'],
      ['Sam', 'Also zuerst die Angaben prüfen und dir die Übersicht schicken?', 'So first check the information and send you the overview?'],
      ['Lea', 'Genau. Danach entscheiden wir gemeinsam, wen wir kontaktieren.', 'Exactly. Afterwards we will decide together whom to contact.'],
    ], [
      ['check', 'Was soll geprüft werden?', 'What should be checked?', [['Die Anmeldungen', 'The registrations'], ['Die Rechnungen', 'The invoices'], ['Die Räume', 'The rooms']], 0],
      ['contact', 'Soll Sam sofort Personen anschreiben?', 'Should Sam contact people immediately?', [['Ja, alle', 'Yes, everyone'], ['Nein, noch nicht', 'No, not yet'], ['Nur neue Personen', 'Only new people']], 1],
      ['deadline', 'Wann ist die Übersicht fällig?', 'When is the overview due?', [['Heute um zwölf', 'Today at noon'], ['Morgen um vierzehn', 'Tomorrow at two'], ['Morgen um zehn', 'Tomorrow at ten']], 2],
    ]),
  ],
  'project-story': [
    d('Eine Präsentation im Team', [
      ['Interviewer', 'Erzählen Sie von einem Uni-Projekt.', 'Tell us about a university project.'],
      ['Sam', 'Letztes Semester haben wir zu dritt eine Präsentation vorbereitet. Meine Aufgabe war, die Ergebnisse zusammenzufassen.', 'Last semester three of us prepared a presentation. My task was to summarise the results.'],
      ['Interviewer', 'Gab es eine Schwierigkeit?', 'Was there a difficulty?'],
      ['Sam', 'Am Anfang fehlten einige Daten. Wir haben die Dozentin gefragt und konnten die Präsentation danach fertigstellen.', 'Some data was missing at first. We asked the lecturer and were then able to finish the presentation.'],
      ['Interviewer', 'Was haben Sie gelernt?', 'What did you learn?'],
      ['Sam', 'Beim nächsten Mal würde ich die Aufgaben früher verteilen.', 'Next time I would distribute the tasks earlier.'],
    ], [
      ['task', 'Was war Sams Aufgabe?', 'What was Sam’s task?', [['Alle Daten sammeln', 'Collect all the data'], ['Die Ergebnisse zusammenfassen', 'Summarise the results'], ['Den Kurs unterrichten', 'Teach the course']], 1],
      ['problem', 'Was war das Problem am Anfang?', 'What was the initial problem?', [['Fehlende Daten', 'Missing data'], ['Ein kaputter Rechner', 'A broken computer'], ['Ein verspäteter Zug', 'A late train']], 0],
      ['lesson', 'Was würde Sam früher machen?', 'What would Sam do earlier?', [['Den Raum buchen', 'Book the room'], ['Die Folien drucken', 'Print the slides'], ['Die Aufgaben verteilen', 'Distribute the tasks']], 2],
    ]),
    d('Bei einer Veranstaltung helfen', [
      ['Interviewer', 'Haben Sie schon organisatorische Aufgaben übernommen?', 'Have you taken on organisational tasks before?'],
      ['Sam', 'Ja, bei einer Uni-Veranstaltung war ich für die Anmeldung zuständig.', 'Yes, I was responsible for registration at a university event.'],
      ['Interviewer', 'Was war dabei schwierig?', 'What was difficult about that?'],
      ['Sam', 'Einige Namen fehlten auf der Liste. Ich habe mit einer Kollegin die E-Mails geprüft und die Namen ergänzt.', 'Some names were missing from the list. I checked the emails with a colleague and added the names.'],
      ['Interviewer', 'Hat die Anmeldung danach funktioniert?', 'Did registration work after that?'],
      ['Sam', 'Ja, danach konnten wir alle Teilnehmenden begrüßen.', 'Yes, then we could welcome all participants.'],
    ], [
      ['task', 'Wobei hat Sam geholfen?', 'What did Sam help with?', [['Bei der Präsentation', 'The presentation'], ['Bei der Anmeldung', 'Registration'], ['Beim Essen', 'Catering']], 1],
      ['solution', 'Wie wurde das Problem gelöst?', 'How was the problem solved?', [['Die Veranstaltung wurde abgesagt', 'The event was cancelled'], ['E-Mails wurden geprüft und Namen ergänzt', 'Emails were checked and names added'], ['Ein Stundenplan wurde gedruckt', 'A timetable was printed']], 1],
      ['team', 'Hat Sam die E-Mails allein geprüft?', 'Did Sam check the emails alone?', [['Nein, mit einer Kollegin', 'No, with a colleague'], ['Ja, ganz allein', 'Yes, entirely alone'], ['Das steht nicht im Gespräch', 'The conversation does not say']], 0],
    ]),
    d('Eine Umfrage auswerten', [
      ['Interviewer', 'Welches Projekt hat Ihnen besonders gefallen?', 'Which project did you particularly enjoy?'],
      ['Sam', 'Wir haben Studierende zu ihrem Weg zur Universität befragt. Ich habe die Antworten in einer Tabelle sortiert.', 'We asked students about their journey to university. I sorted the answers in a spreadsheet.'],
      ['Interviewer', 'Gab es unklare Antworten?', 'Were any answers unclear?'],
      ['Sam', 'Ja. Wir haben sie gemeinsam besprochen und einige Teilnehmende noch einmal gefragt.', 'Yes. We discussed them together and asked some participants again.'],
      ['Interviewer', 'Was war das Ergebnis?', 'What was the result?'],
      ['Sam', 'Am Ende konnten wir drei häufige Verkehrsprobleme beschreiben.', 'In the end we could describe three common transport problems.'],
    ], [
      ['topic', 'Worum ging es in der Umfrage?', 'What was the survey about?', [['Essen in der Mensa', 'Canteen food'], ['Prüfungen', 'Exams'], ['Den Weg zur Uni', 'The journey to university']], 2],
      ['role', 'Was hat Sam gemacht?', 'What did Sam do?', [['Antworten in einer Tabelle sortiert', 'Sorted answers in a spreadsheet'], ['Eine App programmiert', 'Programmed an app'], ['Fahrkarten verkauft', 'Sold tickets']], 0],
      ['result', 'Wie viele häufige Probleme wurden beschrieben?', 'How many common problems were described?', [['Zwei', 'Two'], ['Drei', 'Three'], ['Fünf', 'Five']], 1],
    ]),
  ],
  'colleague-smalltalk': [
    d('Am Montagmorgen', [
      ['Lea', 'Wie war dein Wochenende?', 'How was your weekend?'],
      ['Sam', 'Ich habe Freunde besucht. Wir haben zusammen gekocht und einen Film gesehen.', 'I visited friends. We cooked together and watched a film.'],
      ['Lea', 'Und was hast du am Sonntag gemacht?', 'And what did you do on Sunday?'],
      ['Sam', 'Da bin ich im Park spazieren gegangen. Das Wetter war schön. Und wie war es bei dir?', 'I went for a walk in the park. The weather was nice. And how was it for you?'],
      ['Lea', 'Ich war auch draußen. Hast du heute Lust, zusammen in die Mensa zu gehen?', 'I was outside too. Would you like to go to the canteen together today?'],
    ], [
      ['sunday', 'Was hat Sam am Sonntag gemacht?', 'What did Sam do on Sunday?', [['Einen Film im Kino gesehen', 'Watched a film at the cinema'], ['Im Park spazieren gegangen', 'Walked in the park'], ['Im Büro gearbeitet', 'Worked in the office']], 1],
      ['invite', 'Wozu lädt Lea ein?', 'What does Lea invite Sam to?', [['Zum Essen in der Mensa', 'Lunch in the canteen'], ['Zu einer Reise', 'A trip'], ['Zu einem Meeting', 'A meeting']], 0],
      ['friends', 'Was hat Sam mit Freunden gemacht?', 'What did Sam do with friends?', [['Eine Prüfung geschrieben', 'Sat an exam'], ['Fußball gespielt', 'Played football'], ['Gekocht und einen Film gesehen', 'Cooked and watched a film']], 2],
    ]),
    d('Ein ruhiges Wochenende', [
      ['Lea', 'Hast du am Wochenende etwas Schönes gemacht?', 'Did you do anything nice at the weekend?'],
      ['Sam', 'Am Samstag habe ich für eine Prüfung gelernt. Am Sonntag war ich mit einer Freundin im Café.', 'On Saturday I studied for an exam. On Sunday I went to a café with a friend.'],
      ['Lea', 'Das klingt gemütlich. Was hast du nächste Woche vor?', 'That sounds cosy. What are your plans for next week?'],
      ['Sam', 'Ich möchte wieder mehr Sport machen. Kennst du einen guten Sportkurs an der Uni?', 'I would like to do more sport again. Do you know a good sports class at the university?'],
      ['Lea', 'Ja, ich kann dir nachher den Link schicken.', 'Yes, I can send you the link later.'],
    ], [
      ['saturday', 'Was hat Sam am Samstag gemacht?', 'What did Sam do on Saturday?', [['Einen Sportkurs besucht', 'Attended a sports class'], ['Für eine Prüfung gelernt', 'Studied for an exam'], ['Eine Freundin im Café getroffen', 'Met a friend at a café']], 1],
      ['question', 'Wonach fragt Sam?', 'What does Sam ask about?', [['Einem Sportkurs an der Uni', 'A university sports class'], ['Einem Café', 'A café'], ['Der nächsten Prüfung', 'The next exam']], 0],
      ['help', 'Was bietet Lea an?', 'What does Lea offer?', [['Ein Buch mitzubringen', 'To bring a book'], ['Einen Platz zu buchen', 'To book a place'], ['Einen Link zu schicken', 'To send a link']], 2],
    ]),
    d('Gemeinsam Mittag essen', [
      ['Sam', 'Ich bin noch neu hier. Wo geht ihr normalerweise Mittag essen?', 'I am still new here. Where do you usually have lunch?'],
      ['Lea', 'Meistens gehen wir in die Mensa. Heute wollen wir um halb eins losgehen.', 'We usually go to the canteen. Today we want to leave at half past twelve.'],
      ['Sam', 'Das klingt gut. Kann ich mitkommen?', 'That sounds good. Can I come along?'],
      ['Lea', 'Natürlich. Wir treffen uns am Haupteingang.', 'Of course. We meet at the main entrance.'],
      ['Sam', 'Super, bis halb eins!', 'Great, see you at half past twelve!'],
    ], [
      ['where', 'Wohin geht die Gruppe?', 'Where is the group going?', [['Ins Restaurant', 'To a restaurant'], ['In die Bibliothek', 'To the library'], ['In die Mensa', 'To the canteen']], 2],
      ['time', 'Wann geht die Gruppe los?', 'When does the group leave?', [['Um 12:30', 'At 12:30'], ['Um 13:30', 'At 13:30'], ['Um 12:00', 'At 12:00']], 0],
      ['meeting', 'Wo treffen sie sich?', 'Where do they meet?', [['Im Büro', 'In the office'], ['Am Haupteingang', 'At the main entrance'], ['An der Haltestelle', 'At the bus stop']], 1],
    ]),
  ],
};

const meta = {
  'first-interview': { titleDe: 'Stell dich vor', goalDe: 'Stelle dich vor, erkläre deine Verfügbarkeit und frage nach der Stelle.', situationDe: 'Du führst ein erstes Gespräch über eine Werkstudentenstelle. Antworte kurz, konkret und mit deinen echten Erfahrungen.', stage: 1, phraseIds: ['study', 'work-goal', 'experience', 'hours', 'days', 'start', 'motivation', 'repeat', 'strength', 'onboarding'], resources: ['nicos-interview', 'vhs', 'ba-interview'], shadowEn: 'I would like to gain practical experience alongside my studies.' },
  'clear-instructions': { titleDe: 'Aufgaben verstehen', goalDe: 'Kläre eine Anweisung und bestätige Aufgabe und Frist.', situationDe: 'Eine Kollegin gibt dir eine neue Aufgabe. Frage nach, bis du weißt, was du tun sollst.', stage: 3, phraseIds: ['clarify', 'confirm', 'deadline', 'priority', 'help', 'thanks', 'understood-part', 'mean-word', 'briefly-confirm', 'take-notes'], resources: ['vhs', 'goethe-office'], shadowEn: 'Have I understood correctly: I should check the email addresses first?' },
  'project-story': { titleDe: 'Von einem Projekt erzählen', goalDe: 'Erkläre ein echtes Projekt, deinen Beitrag und das Ergebnis.', situationDe: 'Wähle ein Projekt aus Uni, Ehrenamt, Arbeit oder Alltag. Ein kleiner eigener Beitrag ist ein gutes Beispiel.', stage: 5, phraseIds: ['experience', 'task', 'problem', 'suggest', 'result', 'reason', 'example', 'learned', 'teamwork', 'explain-simply'], resources: ['nicos-interview', 'slow-interview', 'vhs'], shadowEn: 'My task was to summarise the results.' },
  'colleague-smalltalk': { titleDe: 'Das Gespräch am Laufen halten', goalDe: 'Erzähle ein Erlebnis, frage zurück und verabrede einen nächsten Schritt.', situationDe: 'Du triffst jemanden in der Pause. Erzähle etwas Kleines und zeige echtes Interesse.', stage: 4, phraseIds: ['weekend', 'follow', 'opinion', 'agree', 'join', 'thinking', 'usually', 'prefer', 'plans', 'tell-more', 'new-here', 'where-find'], resources: ['easy-routine', 'dw-workday', 'goethe-a2'], shadowEn: 'My weekend was quiet. And how was yours?' },
};

const retries = {
  'first-interview': ['Stelle dich noch einmal vor und nenne deine Verfügbarkeit. Sprich 60–90 Sekunden mit weniger Hilfe.', 'Stellen Sie sich vor und sagen Sie uns, wann Sie arbeiten könnten.', 'Introduce yourself and tell us when you could work.', 'Ich studiere Wirtschaft und möchte praktische Erfahrung sammeln. In einem Uni-Projekt habe ich im Team gearbeitet. Ich könnte an zwei Tagen pro Woche arbeiten. Wie läuft die Einarbeitung bei Ihnen ab?', 'I study business and would like practical experience. I worked in a team on a university project. I could work on two days a week. How does onboarding work here?', ['study', 'work-goal', 'experience', 'hours', 'days', 'onboarding']],
  'clear-instructions': ['Erkläre Aufgabe, Frist und Priorität in 45–60 Sekunden. Ergänze eine Rückfrage.', 'Was machst du zuerst, bis wann und welche Frage ist noch offen?', 'What will you do first, by when, and what question remains?', 'Ich prüfe zuerst die E-Mail-Adressen und schicke dir die Liste morgen vor zwölf. Danach bereite ich die Unterlagen vor. Wo finde ich die aktuelle Vorlage?', 'I will check the email addresses first and send you the list before noon tomorrow. Then I will prepare the documents. Where can I find the current template?', ['confirm', 'deadline', 'priority', 'where-find']],
  'project-story': ['Erzähle dein Projekt in 60–90 Sekunden: Aufgabe, Schwierigkeit, nächster Schritt und Ergebnis.', 'Erzählen Sie das Projekt bitte noch einmal mit Ihrem eigenen Beitrag.', 'Please tell the project story again, including your own contribution.', 'Wir haben zu dritt eine Präsentation vorbereitet. Ich habe die Ergebnisse zusammengefasst. Zuerst fehlten Daten, deshalb haben wir bei der Dozentin nachgefragt. Am Ende war die Präsentation pünktlich fertig.', 'Three of us prepared a presentation. I summarised the results. At first data was missing, so we asked the lecturer. In the end the presentation was finished on time.', ['task', 'problem', 'result', 'learned']],
  'colleague-smalltalk': ['Erzähle dein Wochenende noch einmal und stelle danach zwei passende Rückfragen.', 'Erzähl noch einmal von deinem Wochenende und frage mich danach auch etwas.', 'Tell me about your weekend again and then ask me something too.', 'Am Wochenende habe ich Freunde besucht und wir haben zusammen gekocht. Am Sonntag war ich im Park. Und wie war es bei dir? Hast du nächste Woche schon etwas vor?', 'At the weekend I visited friends and we cooked together. On Sunday I went to the park. And how was it for you? Do you already have plans for next week?', ['weekend', 'follow', 'plans', 'tell-more']],
};

export function coreMissions() {
  return structuredClone(LEGACY).map(original => {
    const extra = structuredClone(meta[original.id]);
    const turns = original.turns.map((turn, index) => {
      const [goalDe, promptsEn, rephraseEn, modelEn, criteriaDe] = translations[original.id][index];
      return { ...turn, goalDe, promptsEn, rephraseEn, modelEn, criteriaDe,
        essential: original.id === 'first-interview' ? ['intro', 'availability'].includes(turn.id) : index < 2 };
    });
    const [goalDe, prompt, promptEn, model, modelEn, phraseIds] = retries[original.id];
    if (original.id === 'first-interview') extra.phraseIds = [...extra.phraseIds, 'could-slower', 'thinking'];
    if (original.id === 'clear-instructions') extra.phraseIds = [...extra.phraseIds, 'not-sure'];
    if (original.id === 'colleague-smalltalk') extra.phraseIds = ['weekend', 'follow', 'opinion', 'usually', 'after-that', 'prefer', 'join-lunch', 'plans', 'tell-more', 'sounds-interesting', 'new-here', 'where-find'];
    return { ...original, ...extra, turns, listening: listenings[original.id], retryDe: goalDe,
      retryTask: { prompt, promptEn, model, modelEn, phraseIds, goalDe, rephrase: prompt, rephraseEn: promptEn,
        criteria: RETRY_CHECKS.map(item => item[1]), criteriaDe: RETRY_CHECKS.map(item => item[0]) } };
  });
}
