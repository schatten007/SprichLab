import { dialogue as d, turn as t, mission, RETRY_CHECKS } from '../content-helpers.js';

export const workUpdate = mission({
  id: 'work-update', title: 'Give a clear work update.', titleDe: 'Ein klares Update geben', shortTitle: 'Work updates & deadlines',
  subtitle: 'What is done, what comes next, and what is blocking you.', icon: 'layers', register: 'du · colleagues', level: 'A2 → B1', stage: 3,
  goal: ['Erkläre den Stand deiner Arbeit und vereinbare den nächsten Schritt.', 'Explain your progress and agree on the next step.'],
  situation: ['Dein Team fragt nach dem aktuellen Stand. Gib ein kurzes und ehrliches Update.', 'Your team asks for a progress update. Keep it short and accurate.'],
  phraseIds: ['status', 'finished', 'next-step', 'in-progress', 'still-missing', 'need-until', 'on-track', 'update-later', 'sent-file', 'checked', 'nearly-done'], resources: ['dw-workday', 'vhs', 'goethe-office'],
  listening: [
    d('Die Kontaktliste ist fertig', [
      ['Lea', 'Wie weit bist du mit der Kontaktliste?', 'How far have you got with the contact list?'],
      ['Sam', 'Ich bin mit der Liste fertig. Die E-Mail-Adressen habe ich geprüft.', 'I have finished the list. I checked the email addresses.'],
      ['Lea', 'Sehr gut. Was machst du als Nächstes?', 'Very good. What will you do next?'],
      ['Sam', 'Als Nächstes kümmere ich mich um die Präsentation. Dafür brauche ich noch die aktuellen Zahlen.', 'Next I will take care of the presentation. I still need the current figures for that.'],
      ['Lea', 'Die schicke ich dir bis zwölf Uhr.', 'I will send them to you by noon.'],
      ['Sam', 'Danke, dann kann ich heute Nachmittag weitermachen.', 'Thanks, then I can continue this afternoon.'],
    ], [
      ['done', 'Was ist fertig?', 'What is finished?', [['Die Präsentation', 'The presentation'], ['Die Kontaktliste', 'The contact list'], ['Der Bericht', 'The report']], 1],
      ['missing', 'Was fehlt Sam noch?', 'What does Sam still need?', [['Aktuelle Zahlen', 'Current figures'], ['Ein Passwort', 'A password'], ['Eine Telefonnummer', 'A phone number']], 0],
      ['when', 'Bis wann schickt Lea die Zahlen?', 'By when will Lea send the figures?', [['Bis 10 Uhr', 'By ten'], ['Bis morgen', 'By tomorrow'], ['Bis 12 Uhr', 'By noon']], 2],
    ]),
    d('Eine realistische Frist', [
      ['Lea', 'Ist der Bericht schon fertig?', 'Is the report finished yet?'],
      ['Sam', 'Noch nicht. Ich bin gerade dabei, die Ergebnisse zu prüfen.', 'Not yet. I am currently checking the results.'],
      ['Lea', 'Wie viel Zeit brauchst du noch?', 'How much more time do you need?'],
      ['Sam', 'Ich brauche dafür noch bis morgen Vormittag. Zwei Angaben stimmen noch nicht.', 'I will need until tomorrow morning. Two pieces of information are not correct yet.'],
      ['Lea', 'In Ordnung. Schick mir heute bitte den bisherigen Stand.', 'All right. Please send me the current version today.'],
      ['Sam', 'Mache ich. Die endgültige Version bekommst du morgen.', 'I will. You will get the final version tomorrow.'],
    ], [
      ['status', 'Ist der Bericht fertig?', 'Is the report finished?', [['Ja, ganz fertig', 'Yes, completely'], ['Er wurde abgesagt', 'It was cancelled'], ['Nein, noch nicht', 'No, not yet']], 2],
      ['why', 'Warum braucht Sam noch Zeit?', 'Why does Sam need more time?', [['Zwei Angaben stimmen noch nicht', 'Two details are not correct yet'], ['Der Rechner ist kaputt', 'The computer is broken'], ['Lea ist im Urlaub', 'Lea is on holiday']], 0],
      ['next', 'Was soll Sam heute schicken?', 'What should Sam send today?', [['Die endgültige Version', 'The final version'], ['Den bisherigen Stand', 'The current version'], ['Einen neuen Kalender', 'A new calendar']], 1],
    ]),
    d('Auf eine Rückmeldung warten', [
      ['Sam', 'Ein kurzes Update: Die Folien sind vorbereitet, aber mir fehlt noch die Freigabe.', 'A quick update: the slides are prepared, but I am still waiting for approval.'],
      ['Lea', 'Von wem brauchst du die Freigabe?', 'Whose approval do you need?'],
      ['Sam', 'Von Frau Keller. Ich habe ihr gestern die Datei geschickt.', 'Ms Keller’s. I sent her the file yesterday.'],
      ['Lea', 'Frag bitte heute noch einmal nach. Das Meeting ist am Freitag.', 'Please ask again today. The meeting is on Friday.'],
      ['Sam', 'Gut, ich frage nach und gebe dir später ein Update.', 'Good, I will ask and update you later.'],
    ], [
      ['missing', 'Was fehlt noch?', 'What is still missing?', [['Die Folien', 'The slides'], ['Die Freigabe', 'Approval'], ['Der Raum', 'The room']], 1],
      ['person', 'Wer soll die Datei freigeben?', 'Who should approve the file?', [['Frau Keller', 'Ms Keller'], ['Sam', 'Sam'], ['Ein Kunde', 'A customer']], 0],
      ['meeting', 'Wann ist das Meeting?', 'When is the meeting?', [['Heute', 'Today'], ['Am Mittwoch', 'On Wednesday'], ['Am Freitag', 'On Friday']], 2],
    ]),
  ],
  shadow: ['Ich bin mit der Liste fertig. Als Nächstes kümmere ich mich um die Präsentation.', 'I have finished the list. Next I will work on the presentation.'],
  turns: [
    t('intro', { essential: true, ask: ['Woran arbeitest du gerade, und wie weit bist du?', 'What are you working on, and how far along are you?'], simpler: ['Was machst du gerade? Was ist schon fertig?', 'What are you doing now? What is already finished?'], goal: ['Nenne deine Aufgabe und ihren aktuellen Stand.', 'Name your task and its current status.'], model: ['Ich arbeite gerade an der Präsentation. Die ersten drei Folien sind fertig.', 'I am working on the presentation. The first three slides are finished.'], phrases: ['status', 'finished', 'in-progress'], checks: [['Ich habe meine Aufgabe genannt.', 'I named my task.'], ['Ich habe den Stand beschrieben.', 'I described its status.'], ['Meine Angaben waren konkret.', 'My information was specific.']] }),
    t('next', { essential: true, ask: ['Was ist dein nächster Schritt?', 'What is your next step?'], simpler: ['Was machst du danach?', 'What will you do afterwards?'], goal: ['Nenne einen konkreten nächsten Schritt.', 'Give a concrete next step.'], model: ['Als Nächstes prüfe ich die Zahlen und ergänze die letzte Folie.', 'Next I will check the figures and complete the last slide.'], phrases: ['next-step', 'checked'], checks: [['Ich habe einen nächsten Schritt genannt.', 'I named a next step.'], ['Der Schritt passt zur Aufgabe.', 'The step fits the task.'], ['Ich konnte frei antworten.', 'I could respond freely.']] }),
    t('blocker', { ask: ['Fehlt dir noch etwas, um weiterzumachen?', 'Are you missing anything you need to continue?'], simpler: ['Brauchst du Informationen oder Hilfe?', 'Do you need information or help?'], goal: ['Nenne einen möglichen Engpass oder sage, dass alles nach Plan läuft.', 'Describe a possible blocker or say that everything is going to plan.'], model: ['Mir fehlen noch die aktuellen Zahlen. Könntest du sie mir schicken?', 'I am still missing the current figures. Could you send them to me?'], phrases: ['still-missing', 'on-track', 'help'], checks: [['Ich habe einen Engpass oder freien Fortschritt beschrieben.', 'I described a blocker or clear progress.'], ['Ich habe meinen Bedarf konkret genannt.', 'I stated what I need specifically.'], ['Meine Antwort war verständlich.', 'My answer was understandable.']] }),
    t('deadline', { ask: ['Bis wann kannst du die Aufgabe abschließen?', 'By when can you complete the task?'], simpler: ['Wann bist du fertig?', 'When will you be finished?'], goal: ['Gib eine realistische Zeitangabe.', 'Give a realistic time estimate.'], model: ['Ich brauche dafür noch bis morgen Vormittag. Falls sich etwas ändert, sage ich dir Bescheid.', 'I will need until tomorrow morning. If anything changes, I will let you know.'], phrases: ['need-until', 'nearly-done'], checks: [['Ich habe einen Zeitpunkt genannt.', 'I gave a time.'], ['Die Angabe war realistisch.', 'The estimate was realistic.'], ['Ich habe klar formuliert.', 'I expressed it clearly.']] }),
    t('handover', { ask: ['Wie hältst du mich auf dem Laufenden?', 'How will you keep me informed?'], simpler: ['Wann bekomme ich dein nächstes Update?', 'When will I get your next update?'], goal: ['Vereinbare, wann und wie du dich meldest.', 'Agree when and how you will update the other person.'], model: ['Ich schicke dir morgen Vormittag die Datei und gebe dir danach ein kurzes Update.', 'I will send you the file tomorrow morning and give you a short update afterwards.'], phrases: ['update-later', 'sent-file'], checks: [['Ich habe einen Zeitpunkt vereinbart.', 'I agreed on a time.'], ['Ich habe den Kommunikationsweg genannt.', 'I named the communication method.'], ['Ich habe einen vollständigen Satz benutzt.', 'I used a complete sentence.']] }),
  ],
  retry: { ask: ['Gib bitte ein kurzes Update ohne Stichwortliste.', 'Please give a short update without a cue list.'], simpler: ['Was ist fertig, was fehlt, und was kommt als Nächstes?', 'What is done, what is missing, and what comes next?'], goal: ['Fasse Stand, Engpass und nächsten Schritt in 45–60 Sekunden zusammen.', 'Summarise progress, a blocker, and the next step in 45–60 seconds.'], model: ['Die Kontaktliste ist fertig. Für die Präsentation fehlen mir noch die aktuellen Zahlen. Sobald ich sie habe, ergänze ich die Folien. Morgen Vormittag schicke ich dir die Datei.', 'The contact list is finished. I still need the current figures for the presentation. Once I have them, I will complete the slides. I will send you the file tomorrow morning.'], phrases: ['finished', 'still-missing', 'next-step', 'update-later'], checks: RETRY_CHECKS },
});

export const problemHelp = mission({
  id: 'problem-help', title: 'Explain the problem. Get unstuck.', titleDe: 'Ein Problem verständlich erklären', shortTitle: 'Problems & asking for help',
  subtitle: 'Describe what happened, what you tried, and what you need.', icon: 'messages', register: 'du · colleagues', level: 'A2 → B1', stage: 3,
  goal: ['Beschreibe ein Problem und bitte gezielt um Hilfe.', 'Describe a problem and ask for specific help.'],
  situation: ['Etwas funktioniert bei einer Aufgabe nicht. Eine Kollegin hilft dir, wenn sie das Problem versteht.', 'Something is not working during a task. A colleague can help when they understand the problem.'],
  phraseIds: ['stuck', 'cannot-open', 'tried', 'show-me', 'error-message', 'access', 'explain-again', 'works-now', 'same-problem', 'solve-together'], resources: ['goethe-office', 'vhs', 'goethe-a2-words'],
  listening: [
    d('Die Datei geht nicht auf', [
      ['Sam', 'Kannst du mir kurz helfen? Die Datei lässt sich nicht öffnen.', 'Can you help me briefly? The file will not open.'],
      ['Lea', 'Was passiert, wenn du sie öffnest?', 'What happens when you open it?'],
      ['Sam', 'Es erscheint eine Fehlermeldung. Ich habe schon versucht, das Programm neu zu starten.', 'An error message appears. I have already tried restarting the program.'],
      ['Lea', 'Vielleicht ist die Datei beschädigt. Ich schicke dir eine neue Kopie.', 'Perhaps the file is damaged. I will send you a new copy.'],
      ['Sam', 'Danke. Mit der neuen Kopie funktioniert es.', 'Thanks. It works with the new copy.'],
    ], [
      ['problem', 'Was ist das Problem?', 'What is the problem?', [['Eine Datei öffnet sich nicht', 'A file will not open'], ['Das Internet ist langsam', 'The internet is slow'], ['Ein Termin fehlt', 'An appointment is missing']], 0],
      ['tried', 'Was hat Sam schon versucht?', 'What has Sam already tried?', [['Den Rechner gekauft', 'Buying a computer'], ['Das Programm neu gestartet', 'Restarting the program'], ['Die Kollegin angerufen', 'Calling the colleague']], 1],
      ['solution', 'Was hilft am Ende?', 'What helps in the end?', [['Ein neuer Termin', 'A new appointment'], ['Ein anderes Passwort', 'Another password'], ['Eine neue Dateikopie', 'A new copy of the file']], 2],
    ]),
    d('Zugriff auf den Ordner', [
      ['Sam', 'Ich habe keinen Zugriff auf den Team-Ordner. Dort liegen die Unterlagen für meine Aufgabe.', 'I do not have access to the team folder. It contains the documents for my task.'],
      ['Lea', 'Bist du mit deinem Arbeitskonto angemeldet?', 'Are you signed in with your work account?'],
      ['Sam', 'Ja, aber die Seite zeigt „Zugriff verweigert“.', 'Yes, but the page says “access denied”.'],
      ['Lea', 'Dann fehlt dir wahrscheinlich die Freigabe. Ich frage bei der IT nach.', 'Then you are probably missing permission. I will ask IT.'],
      ['Sam', 'Danke. Kannst du mir bis dahin die benötigte Liste schicken?', 'Thanks. Can you send me the list I need in the meantime?'],
    ], [
      ['missing', 'Worauf hat Sam keinen Zugriff?', 'What can Sam not access?', [['Den Kalender', 'The calendar'], ['Den Team-Ordner', 'The team folder'], ['Die Mensa', 'The canteen']], 1],
      ['account', 'Mit welchem Konto ist Sam angemeldet?', 'Which account is Sam using?', [['Mit dem Arbeitskonto', 'The work account'], ['Mit einem privaten Konto', 'A personal account'], ['Mit keinem Konto', 'No account']], 0],
      ['help', 'Was möchte Sam in der Zwischenzeit?', 'What does Sam want in the meantime?', [['Einen neuen Rechner', 'A new computer'], ['Eine Pause', 'A break'], ['Die benötigte Liste', 'The required list']], 2],
    ]),
    d('Ein Arbeitsschritt ist unklar', [
      ['Sam', 'Ich komme beim Export nicht weiter. Den ersten Teil habe ich verstanden.', 'I am stuck at the export step. I understood the first part.'],
      ['Lea', 'Du musst zuerst das richtige Dateiformat auswählen.', 'First you need to choose the correct file format.'],
      ['Sam', 'Welches Format brauchen wir für den Bericht?', 'Which format do we need for the report?'],
      ['Lea', 'Bitte wähle PDF und danach „Speichern“.', 'Please choose PDF and then “Save”.'],
      ['Sam', 'PDF und dann speichern. Jetzt funktioniert es. Danke für die Erklärung.', 'PDF and then save. It works now. Thank you for explaining.'],
    ], [
      ['step', 'Bei welchem Schritt braucht Sam Hilfe?', 'Which step does Sam need help with?', [['Beim Export', 'Exporting'], ['Beim Anmelden', 'Signing in'], ['Beim Drucken', 'Printing']], 0],
      ['format', 'Welches Format wird benötigt?', 'Which format is needed?', [['JPG', 'JPG'], ['PDF', 'PDF'], ['MP3', 'MP3']], 1],
      ['next', 'Was kommt nach der Formatauswahl?', 'What follows choosing the format?', [['Neu starten', 'Restart'], ['Abmelden', 'Sign out'], ['Speichern', 'Save']], 2],
    ]),
  ],
  shadow: ['Ich habe schon versucht, das Programm neu zu starten, aber das Problem tritt immer noch auf.', 'I have already tried restarting the program, but the problem is still occurring.'],
  turns: [
    t('intro', { essential: true, ask: ['Du brauchst Hilfe? Was genau funktioniert nicht?', 'Do you need help? What exactly is not working?'], simpler: ['Was ist das Problem?', 'What is the problem?'], goal: ['Beschreibe ein konkretes Problem in zwei Sätzen.', 'Describe a specific problem in two sentences.'], model: ['Die Datei lässt sich nicht öffnen. Es erscheint eine Fehlermeldung.', 'The file will not open. An error message appears.'], phrases: ['cannot-open', 'error-message', 'access'], checks: [['Ich habe das konkrete Problem genannt.', 'I named the specific problem.'], ['Ich habe beschrieben, was passiert.', 'I described what happens.'], ['Ich habe verständlich gesprochen.', 'I spoke understandably.']] }),
    t('tried', { ask: ['Was hast du schon ausprobiert?', 'What have you already tried?'], simpler: ['Hast du schon etwas gemacht, um das Problem zu lösen?', 'Have you already tried to solve the problem?'], goal: ['Erkläre einen bisherigen Lösungsversuch.', 'Explain one attempted solution.'], model: ['Ich habe schon versucht, das Programm neu zu starten. Das hat nicht geholfen.', 'I have already tried restarting the program. That did not help.'], phrases: ['tried', 'same-problem'], checks: [['Ich habe einen Versuch genannt.', 'I named an attempt.'], ['Ich habe gesagt, ob er geholfen hat.', 'I said whether it helped.'], ['Die Reihenfolge war klar.', 'The sequence was clear.']] }),
    t('request', { essential: true, ask: ['Wie kann ich dir jetzt am besten helfen?', 'How can I best help you now?'], simpler: ['Was brauchst du von mir?', 'What do you need from me?'], goal: ['Bitte um eine konkrete Hilfe oder Demonstration.', 'Ask for specific help or a demonstration.'], model: ['Könntest du mir zeigen, wie ich die Datei richtig exportiere?', 'Could you show me how to export the file correctly?'], phrases: ['show-me', 'solve-together', 'help'], checks: [['Meine Bitte war konkret.', 'My request was specific.'], ['Ich habe höflich gefragt.', 'I asked politely.'], ['Ich habe gesagt, was ich brauche.', 'I stated what I need.']] }),
    t('check', { ask: ['Wähle zuerst PDF und klicke dann auf Speichern. Ist das klar?', 'Choose PDF first, then click Save. Is that clear?'], simpler: ['Zuerst PDF, danach speichern. Kannst du die Schritte wiederholen?', 'First PDF, then save. Can you repeat the steps?'], goal: ['Bestätige die zwei Schritte in der richtigen Reihenfolge.', 'Confirm the two steps in the correct order.'], model: ['Ja, zuerst wähle ich PDF und danach speichere ich die Datei.', 'Yes, first I select PDF and then save the file.'], phrases: ['confirm', 'after-that', 'understood-part'], checks: [['Ich habe beide Schritte genannt.', 'I named both steps.'], ['Die Reihenfolge war richtig.', 'The order was correct.'], ['Ich habe mein Verständnis überprüft.', 'I checked my understanding.']] }),
    t('result', { ask: ['Hat es jetzt funktioniert?', 'Did it work now?'], simpler: ['Ist das Problem gelöst?', 'Is the problem solved?'], goal: ['Melde das Ergebnis und bedanke dich oder frage weiter.', 'Report the result and thank the person or ask for further help.'], model: ['Ja, jetzt funktioniert es. Danke für deine Hilfe.', 'Yes, it works now. Thank you for your help.'], phrases: ['works-now', 'same-problem', 'thanks'], checks: [['Ich habe das Ergebnis genannt.', 'I stated the result.'], ['Ich habe passend reagiert.', 'I responded appropriately.'], ['Ich habe in eigenen Worten gesprochen.', 'I used my own words.']] }),
  ],
  retry: { ask: ['Erkläre ein anderes Problem und bitte um Hilfe.', 'Explain a different problem and ask for help.'], simpler: ['Was geht nicht, was hast du versucht, und was brauchst du?', 'What is not working, what have you tried, and what do you need?'], goal: ['Beschreibe in 45–60 Sekunden ein neues Problem mit Versuch und Bitte.', 'In 45–60 seconds, describe a new problem, an attempted solution, and a request.'], model: ['Ich habe keinen Zugriff auf den Ordner. Ich habe mich mit meinem Arbeitskonto angemeldet, aber es klappt immer noch nicht. Könntest du bitte prüfen, ob mir die Freigabe fehlt?', 'I do not have access to the folder. I signed in with my work account, but it still does not work. Could you check whether I am missing permission?'], phrases: ['access', 'tried', 'same-problem', 'solve-together'], checks: RETRY_CHECKS },
});

export const customerRequest = mission({
  id: 'customer-request', title: 'Handle the request calmly.', titleDe: 'Ein Anliegen ruhig bearbeiten', shortTitle: 'Requests & handovers',
  subtitle: 'Clarify the request, check the facts, and agree on a useful next step.', icon: 'briefcase', register: 'Sie · customer or visitor', level: 'A2+ → B1', stage: 4,
  goal: ['Kläre ein Anliegen und leite es bei Bedarf an die richtige Person weiter.', 'Clarify a request and pass it to the right person when needed.'],
  situation: ['Du hilfst am Empfang oder im Büro. Gib klare Informationen und prüfe, was du noch nicht weißt.', 'You are helping at reception or in an office. Give clear information and check what you do not yet know.'],
  phraseIds: ['request-detail', 'handle-request', 'moment', 'forward', 'colleague-responsible', 'check-first', 'get-back', 'understood-request', 'alternative', 'apology'], resources: ['vhs', 'dw-phone', 'dw-profis'],
  listening: [
    d('Fehlende Unterlagen', [
      ['Kundin', 'Guten Tag. Ich habe die Unterlagen für den Termin noch nicht bekommen.', 'Hello. I have not received the documents for the appointment yet.'],
      ['Sam', 'Es tut mir leid, dass Sie warten mussten. Um welchen Termin geht es?', 'I am sorry you had to wait. Which appointment is it about?'],
      ['Kundin', 'Um das Gespräch am Montag um zehn Uhr.', 'The conversation on Monday at ten.'],
      ['Sam', 'Einen Moment bitte. Ich prüfe die E-Mail-Adresse und schicke die Unterlagen noch einmal.', 'One moment, please. I will check the email address and send the documents again.'],
      ['Kundin', 'Vielen Dank. Eine E-Mail wäre am besten.', 'Thank you. An email would be best.'],
    ], [
      ['missing', 'Was fehlt der Kundin?', 'What is the customer missing?', [['Ein Passwort', 'A password'], ['Die Unterlagen', 'The documents'], ['Eine Rechnung', 'An invoice']], 1],
      ['appointment', 'Wann ist ihr Termin?', 'When is her appointment?', [['Montag um 10 Uhr', 'Monday at ten'], ['Dienstag um 12 Uhr', 'Tuesday at noon'], ['Freitag um 14 Uhr', 'Friday at two']], 0],
      ['next', 'Was macht Sam zuerst?', 'What will Sam do first?', [['Den Termin absagen', 'Cancel the appointment'], ['Die Kollegin anrufen', 'Call a colleague'], ['Die E-Mail-Adresse prüfen', 'Check the email address']], 2],
    ]),
    d('Die zuständige Person finden', [
      ['Besucher', 'Ich habe eine Frage zu meiner Rechnung.', 'I have a question about my invoice.'],
      ['Sam', 'Dafür ist meine Kollegin Frau Lange zuständig. Sie ist gerade nicht im Büro.', 'My colleague Ms Lange is responsible for that. She is not in the office right now.'],
      ['Besucher', 'Kann sie mich heute zurückrufen?', 'Can she call me back today?'],
      ['Sam', 'Ich leite Ihre Anfrage weiter. Einen Rückruf heute kann ich noch nicht versprechen.', 'I will pass on your request. I cannot promise a callback today yet.'],
      ['Besucher', 'Gut. Bitte sagen Sie ihr, dass ich bis siebzehn Uhr erreichbar bin.', 'All right. Please tell her I can be reached until five pm.'],
    ], [
      ['topic', 'Worum geht es?', 'What is it about?', [['Eine Rechnung', 'An invoice'], ['Eine Bewerbung', 'An application'], ['Einen Raum', 'A room']], 0],
      ['person', 'Wer ist zuständig?', 'Who is responsible?', [['Sam', 'Sam'], ['Frau Lange', 'Ms Lange'], ['Frau Weber', 'Ms Weber']], 1],
      ['callback', 'Ist der Rückruf heute sicher zugesagt?', 'Is a callback today definitely promised?', [['Ja', 'Yes'], ['Nur am Vormittag', 'Only in the morning'], ['Nein', 'No']], 2],
    ]),
    d('Eine Alternative anbieten', [
      ['Besucherin', 'Kann ich die Bescheinigung heute abholen?', 'Can I collect the certificate today?'],
      ['Sam', 'Heute ist sie leider noch nicht fertig. Ich kann Ihnen stattdessen eine Abholung morgen anbieten.', 'Unfortunately it is not ready today. I can offer collection tomorrow instead.'],
      ['Besucherin', 'Morgen bin ich nicht in der Stadt. Können Sie sie mir schicken?', 'I am not in town tomorrow. Can you send it to me?'],
      ['Sam', 'Ich prüfe, ob ein Versand per Post möglich ist. Ich melde mich heute Nachmittag bei Ihnen.', 'I will check whether it can be posted. I will get back to you this afternoon.'],
      ['Besucherin', 'Danke, dann warte ich auf Ihre Rückmeldung.', 'Thank you, then I will wait to hear from you.'],
    ], [
      ['today', 'Ist die Bescheinigung heute fertig?', 'Is the certificate ready today?', [['Ja', 'Yes'], ['Nein', 'No'], ['Nur eine Kopie', 'Only a copy']], 1],
      ['alternative', 'Was wird zuerst angeboten?', 'What is offered first?', [['Abholung morgen', 'Collection tomorrow'], ['Sofortiger Versand', 'Immediate dispatch'], ['Ein neuer Antrag', 'A new application']], 0],
      ['reply', 'Wann meldet sich Sam?', 'When will Sam get back to the visitor?', [['Nächste Woche', 'Next week'], ['Morgen Abend', 'Tomorrow evening'], ['Heute Nachmittag', 'This afternoon']], 2],
    ]),
  ],
  shadow: ['Ich leite Ihre Anfrage weiter und melde mich bei Ihnen, sobald ich mehr weiß.', 'I will forward your request and get back to you as soon as I know more.'],
  turns: [
    t('intro', { essential: true, ask: ['Guten Tag, ich brauche Hilfe mit meinen Unterlagen.', 'Hello, I need help with my documents.'], simpler: ['Können Sie mir bei meinen Unterlagen helfen?', 'Can you help me with my documents?'], goal: ['Frage höflich nach dem genauen Anliegen.', 'Politely ask what exactly the person needs.'], model: ['Gerne. Worum geht es genau? Welche Unterlagen fehlen Ihnen?', 'Gladly. What exactly is it about? Which documents are you missing?'], phrases: ['request-detail', 'moment'], checks: [['Ich habe höflich reagiert.', 'I responded politely.'], ['Ich habe eine konkrete Rückfrage gestellt.', 'I asked a specific follow-up question.'], ['Meine Frage war verständlich.', 'My question was understandable.']] }),
    t('confirm', { ask: ['Ich habe den Termin am Montag, aber die Bestätigung fehlt noch.', 'I have an appointment on Monday, but the confirmation is still missing.'], simpler: ['Die Terminbestätigung ist noch nicht angekommen.', 'The appointment confirmation has not arrived yet.'], goal: ['Fasse das Anliegen in deinen eigenen Worten zusammen.', 'Summarise the request in your own words.'], model: ['Wenn ich Sie richtig verstehe, haben Sie am Montag einen Termin und benötigen noch die Bestätigung.', 'If I understand you correctly, you have an appointment on Monday and still need the confirmation.'], phrases: ['understood-request'], checks: [['Ich habe den Termin erwähnt.', 'I mentioned the appointment.'], ['Ich habe die fehlende Bestätigung genannt.', 'I named the missing confirmation.'], ['Ich habe das Verständnis geprüft.', 'I checked my understanding.']] }),
    t('next', { essential: true, ask: ['Können Sie mir die Bestätigung gleich schicken?', 'Can you send me the confirmation straight away?'], simpler: ['Was können Sie jetzt für mich tun?', 'What can you do for me now?'], goal: ['Nenne einen nächsten Schritt, den du wirklich prüfen oder erledigen kannst.', 'Give a next step you can genuinely check or carry out.'], model: ['Ich prüfe zuerst Ihre E-Mail-Adresse. Danach kann ich die zuständige Kollegin informieren.', 'I will first check your email address. Then I can inform the responsible colleague.'], phrases: ['check-first', 'handle-request', 'forward'], checks: [['Ich habe einen konkreten Schritt genannt.', 'I named a concrete step.'], ['Ich habe nichts Ungeprüftes versprochen.', 'I did not make an unverified promise.'], ['Ich habe klar gesprochen.', 'I spoke clearly.']] }),
    t('handover', { ask: ['Und wenn Sie das nicht selbst bearbeiten können?', 'And if you cannot handle it yourself?'], simpler: ['Wer kann mir dann helfen?', 'Who can help me then?'], goal: ['Erkläre eine Weiterleitung an die zuständige Person.', 'Explain how you will pass the request to the responsible person.'], model: ['Dafür ist meine Kollegin zuständig. Ich leite Ihre Anfrage an sie weiter.', 'My colleague is responsible for that. I will forward your request to her.'], phrases: ['colleague-responsible', 'forward'], checks: [['Ich habe eine Zuständigkeit erklärt.', 'I explained who is responsible.'], ['Ich habe die Weiterleitung angekündigt.', 'I said I would pass on the request.'], ['Meine Antwort war höflich.', 'My answer was polite.']] }),
    t('reply', { ask: ['Wie erfahre ich, ob es geklappt hat?', 'How will I find out whether it worked?'], simpler: ['Bekomme ich eine Rückmeldung?', 'Will I hear back?'], goal: ['Vereinbare eine Rückmeldung und verabschiede dich.', 'Agree on a follow-up and end the exchange.'], model: ['Ich melde mich per E-Mail bei Ihnen, sobald ich mehr weiß. Vielen Dank für Ihre Geduld.', 'I will email you as soon as I know more. Thank you for your patience.'], phrases: ['get-back', 'apology'], checks: [['Ich habe eine Rückmeldung angekündigt.', 'I said I would follow up.'], ['Ich habe den Kommunikationsweg genannt.', 'I named the communication method.'], ['Ich habe das Gespräch höflich beendet.', 'I ended the exchange politely.']] }),
  ],
  retry: { ask: ['Eine Person wartet auf ein Dokument. Klären Sie das Anliegen und schlagen Sie einen nächsten Schritt vor.', 'Someone is waiting for a document. Clarify the request and suggest a next step.'], simpler: ['Was fehlt? Wer hilft? Wann melden Sie sich?', 'What is missing? Who can help? When will you get back to them?'], goal: ['Sprich ein neues Gespräch von etwa einer Minute: klären, prüfen, weiterleiten, rückmelden.', 'Practise a new one-minute exchange: clarify, check, pass on, and follow up.'], model: ['Guten Tag, welche Unterlagen fehlen Ihnen genau? Ich prüfe das kurz. Für dieses Dokument ist meine Kollegin zuständig. Ich leite Ihre Anfrage weiter und melde mich heute Nachmittag per E-Mail bei Ihnen.', 'Hello, which documents are you missing exactly? I will check. My colleague is responsible for this document. I will pass on your request and email you this afternoon.'], phrases: ['request-detail', 'check-first', 'forward', 'get-back'], checks: RETRY_CHECKS },
});
