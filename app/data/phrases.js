import { PHRASES as LEGACY_PHRASES } from './legacy-content.js';

const originalCues = {
  study: 'Sag, was du studierst.', 'work-goal': 'Erkläre, was du durch eine studentische Tätigkeit lernen möchtest.',
  experience: 'Nenne eine Fähigkeit, die du schon praktisch benutzt hast.', hours: 'Sag, wie viele Stunden du pro Woche arbeiten kannst.',
  days: 'Nenne zwei Tage, an denen du Zeit hast.', start: 'Sag höflich, wann du anfangen könntest.',
  motivation: 'Begründe dein Interesse an der Stelle.', repeat: 'Bitte eine Person höflich, die Frage zu wiederholen.',
  clarify: 'Frage einen Kollegen, was eine unklare Anweisung genau bedeutet.', confirm: 'Prüfe, ob du die Aufgabe richtig verstanden hast.',
  priority: 'Du hast zwei Aufgaben. Frage, welche zuerst kommt.', deadline: 'Frage nach dem Abgabetermin.',
  help: 'Bitte eine Kollegin kurz um Hilfe.', status: 'Beginne ein kurzes Update zu deiner Arbeit.',
  task: 'Beschreibe deinen eigenen Beitrag zu einem Projekt.', problem: 'Sprich ein Problem an und nenne danach ein Detail.',
  suggest: 'Schlage dem Team einen nächsten Schritt vor.', result: 'Erzähle, wie ein Projekt ausgegangen ist.',
  reason: 'Erkläre die Ursache eines Problems.', weekend: 'Erzähle etwas über dein Wochenende.',
  follow: 'Stelle deinem Gesprächspartner eine Frage zurück.', opinion: 'Sag, was dir gefällt, und begründe es.',
  agree: 'Reagiere positiv auf einen Vorschlag.', join: 'Frage, ob du beim Mittagessen mitkommen kannst.',
  thanks: 'Bedanke dich bei einer Kollegin für ihre Hilfe.', thinking: 'Gib dir höflich etwas Zeit zum Nachdenken.',
};

function phrase(row, tag) {
  const [id, de, en, example, cueDe] = row;
  return { id, de, en, example, cueDe, cue: `Express this in German: ${en}`, tags: [tag],
    noteDe: de.includes('…') ? 'Setze deine eigenen Angaben ein. Das Beispiel zeigt eine mögliche Verwendung.' : 'Benutze die Wendung in einem passenden Gespräch und ergänze ein konkretes Detail.',
    note: de.includes('…') ? 'Fill the frame with your own information. The example shows one possible use.' : 'Use this expression in a suitable conversation and add a specific detail.' };
}

const groups = {
  phone: [
    ['call-about', 'Ich rufe wegen … an.', 'I am calling about …', 'Ich rufe wegen Ihrer Werkstudentenstelle an.', 'Erkläre kurz den Grund deines Anrufs.'],
    ['phone-intro', 'Guten Tag, hier spricht …', 'Hello, this is … speaking.', 'Guten Tag, hier spricht Sam Becker.', 'Melde dich am Telefon mit deinem Namen.'],
    ['position-open', 'Ist die Stelle noch frei?', 'Is the position still available?', 'Ich interessiere mich für Ihre Anzeige. Ist die Stelle noch frei?', 'Frage, ob man sich noch auf eine Stelle bewerben kann.'],
    ['speak-person', 'Könnte ich bitte … sprechen?', 'Could I speak to …, please?', 'Könnte ich bitte Frau Weber sprechen?', 'Bitte darum, mit einer bestimmten Person zu sprechen.'],
    ['leave-message', 'Kann ich eine Nachricht hinterlassen?', 'Can I leave a message?', 'Frau Weber ist nicht da? Kann ich eine Nachricht hinterlassen?', 'Die Person ist nicht erreichbar. Biete eine Nachricht an.'],
    ['callback', 'Könnten Sie mich bitte zurückrufen?', 'Could you call me back, please?', 'Könnten Sie mich bitte heute Nachmittag zurückrufen?', 'Bitte höflich um einen Rückruf.'],
    ['spell', 'Könnten Sie das bitte buchstabieren?', 'Could you spell that, please?', 'Ich habe den Namen nicht verstanden. Könnten Sie das bitte buchstabieren?', 'Bitte darum, einen Namen Buchstabe für Buchstabe zu nennen.'],
    ['email-address', 'Meine E-Mail-Adresse lautet …', 'My email address is …', 'Meine E-Mail-Adresse lautet sam.becker@example.org.', 'Gib eine E-Mail-Adresse an.'],
    ['application-docs', 'Welche Unterlagen benötigen Sie?', 'Which documents do you need?', 'Für meine Bewerbung: Welche Unterlagen benötigen Sie?', 'Frage, welche Dokumente zur Bewerbung gehören.'],
    ['reach-again', 'Wann kann ich Sie am besten erreichen?', 'When is the best time to reach you?', 'Wann kann ich Sie morgen am besten erreichen?', 'Frage nach einem passenden Zeitpunkt für einen weiteren Anruf.'],
  ],
  time: [
    ['appointment-request', 'Ich würde gerne einen Termin vereinbaren.', 'I would like to arrange an appointment.', 'Ich würde gerne einen Termin für ein kurzes Gespräch vereinbaren.', 'Bitte um einen Gesprächstermin.'],
    ['reschedule', 'Könnten wir den Termin verschieben?', 'Could we move the appointment?', 'Am Donnerstag habe ich eine Prüfung. Könnten wir den Termin verschieben?', 'Bitte darum, einen Termin auf einen anderen Zeitpunkt zu legen.'],
    ['would-time-work', 'Wäre … möglich?', 'Would … be possible?', 'Wäre Freitag um zehn Uhr möglich?', 'Schlage höflich einen anderen Zeitpunkt vor.'],
    ['unavailable-day', 'Am … bin ich leider verhindert.', 'Unfortunately, I am unavailable on …', 'Am Dienstag bin ich leider verhindert.', 'Sage höflich, dass ein Tag nicht passt.'],
    ['available-after', 'Ab … hätte ich Zeit.', 'I would be available from …', 'Ab vierzehn Uhr hätte ich Zeit.', 'Nenne den frühesten möglichen Zeitpunkt.'],
    ['confirm-time', 'Dann halten wir … fest.', 'Then let us confirm …', 'Dann halten wir Freitag um zehn Uhr fest.', 'Bestätige den vereinbarten Termin.'],
    ['online-or-onsite', 'Findet das Gespräch online oder vor Ort statt?', 'Will the conversation be online or in person?', 'Findet das Gespräch online oder vor Ort statt?', 'Frage nach dem Ort oder Format des Gesprächs.'],
    ['send-link', 'Könnten Sie mir den Link per E-Mail schicken?', 'Could you email me the link?', 'Vielen Dank. Könnten Sie mir den Link per E-Mail schicken?', 'Bitte um den Zugangslink für ein Onlinegespräch.'],
    ['repeat-time', 'Habe ich Sie richtig verstanden: …?', 'Have I understood you correctly: …?', 'Habe ich Sie richtig verstanden: Donnerstag um halb zehn?', 'Prüfe eine Uhrzeit noch einmal nach.'],
    ['thanks-flexibility', 'Vielen Dank für Ihr Entgegenkommen.', 'Thank you for accommodating me.', 'Freitag passt gut. Vielen Dank für Ihr Entgegenkommen.', 'Bedanke dich dafür, dass ein Termin angepasst wurde.'],
    ['timetable', 'Mein Stundenplan steht noch nicht fest.', 'My timetable has not been finalised yet.', 'Mein Stundenplan steht noch nicht fest. Ich kann Ihnen nächste Woche mehr sagen.', 'Erkläre, warum du deine Zeiten noch nicht genau nennen kannst.'],
    ['lecture', 'An diesem Tag habe ich eine Vorlesung.', 'I have a lecture that day.', 'Am Montag kann ich nicht. An diesem Tag habe ich eine Vorlesung.', 'Erkläre einen Konflikt zwischen Studium und Arbeit.'],
    ['exam-period', 'Während der Prüfungsphase …', 'During the exam period …', 'Während der Prüfungsphase müsste ich etwas weniger arbeiten.', 'Beschreibe, was sich während deiner Prüfungen ändern könnte.'],
    ['agree-hours', 'Können wir die Arbeitszeiten vorher absprechen?', 'Can we agree on the working hours in advance?', 'Können wir die Arbeitszeiten für nächsten Monat vorher absprechen?', 'Bitte um eine rechtzeitige Absprache der Arbeitszeiten.'],
    ['fixed-days', 'Feste Arbeitstage wären für mich hilfreich.', 'Fixed working days would be helpful for me.', 'Feste Arbeitstage wären für mich hilfreich, weil ich dann besser planen kann.', 'Erkläre, welche Planung dir Studium und Arbeit erleichtert.'],
    ['flexible', 'An den anderen Tagen bin ich flexibel.', 'I am flexible on the other days.', 'Montags habe ich Vorlesungen. An den anderen Tagen bin ich flexibel.', 'Nenne deine Flexibilität nach einer Einschränkung.'],
    ['work-until', 'Ich kann bis … arbeiten.', 'I can work until …', 'Ich kann am Freitag bis fünfzehn Uhr arbeiten.', 'Sag, wann du spätestens aufhören musst.'],
    ['weekly-hours', 'Mehr als … Stunden pro Woche schaffe ich momentan nicht.', 'At the moment, I cannot manage more than … hours a week.', 'Mehr als sechzehn Stunden pro Woche schaffe ich momentan nicht.', 'Setze eine realistische Grenze für deine Wochenstunden.'],
    ['notify-schedule', 'Ich gebe Ihnen bis … Bescheid.', 'I will let you know by …', 'Ich gebe Ihnen bis Freitag Bescheid.', 'Versprich eine Rückmeldung zu einem konkreten Zeitpunkt.'],
    ['availability-check', 'Ich prüfe das kurz in meinem Kalender.', 'Let me quickly check my calendar.', 'Einen Moment bitte, ich prüfe das kurz in meinem Kalender.', 'Bitte um einen Moment, bevor du einen Termin zusagst.'],
  ],
  work: [
    ['finished', 'Ich bin mit … fertig.', 'I have finished …', 'Ich bin mit der Kontaktliste fertig.', 'Melde, dass eine Aufgabe abgeschlossen ist.'],
    ['next-step', 'Als Nächstes kümmere ich mich um …', 'Next, I will take care of …', 'Als Nächstes kümmere ich mich um die Präsentation.', 'Sag, welche Aufgabe du danach übernimmst.'],
    ['in-progress', 'Ich bin gerade dabei, … zu …', 'I am in the middle of …', 'Ich bin gerade dabei, die Daten zu prüfen.', 'Beschreibe, was du in diesem Moment bearbeitest.'],
    ['still-missing', 'Mir fehlt noch …', 'I am still missing …', 'Mir fehlt noch die Rückmeldung von Frau Weber.', 'Nenne etwas, das du zum Weiterarbeiten brauchst.'],
    ['need-until', 'Ich brauche dafür noch bis …', 'I will need until … to finish this.', 'Ich brauche dafür noch bis morgen Nachmittag.', 'Gib eine realistische neue Zeitangabe.'],
    ['on-track', 'Bis jetzt läuft alles nach Plan.', 'So far, everything is going to plan.', 'Bis jetzt läuft alles nach Plan. Die ersten Daten sind schon geprüft.', 'Gib ein positives Update mit einem Detail.'],
    ['update-later', 'Ich gebe dir später ein kurzes Update.', 'I will give you a short update later.', 'Ich gebe dir nach dem Meeting ein kurzes Update.', 'Sag, wann du eine Kollegin über den Stand informierst.'],
    ['sent-file', 'Ich habe dir die Datei geschickt.', 'I have sent you the file.', 'Ich habe dir die Datei gerade per E-Mail geschickt.', 'Melde, dass du ein Dokument verschickt hast.'],
    ['checked', 'Ich habe … schon geprüft.', 'I have already checked …', 'Ich habe die E-Mail-Adressen schon geprüft.', 'Sag, welchen Teil einer Aufgabe du bereits erledigt hast.'],
    ['nearly-done', 'Ich bin fast fertig.', 'I am almost finished.', 'Ich bin fast fertig. Ich muss nur noch die Zahlen prüfen.', 'Beschreibe den Stand kurz vor dem Abschluss.'],
    ['request-detail', 'Worum geht es genau?', 'What exactly is it about?', 'Gerne helfe ich Ihnen. Worum geht es genau?', 'Bitte um eine genauere Beschreibung eines Anliegens.'],
    ['handle-request', 'Ich kümmere mich darum.', 'I will take care of it.', 'Die Datei fehlt? Ich kümmere mich darum.', 'Übernimm ein Anliegen, das du bearbeiten kannst.'],
    ['moment', 'Einen Moment bitte.', 'One moment, please.', 'Einen Moment bitte, ich schaue nach.', 'Bitte um eine kurze Wartezeit.'],
    ['forward', 'Ich leite Ihre Anfrage weiter.', 'I will forward your request.', 'Ich leite Ihre Anfrage an unsere Kollegin weiter.', 'Erkläre, dass du eine andere zuständige Person kontaktierst.'],
    ['colleague-responsible', 'Dafür ist meine Kollegin zuständig.', 'My colleague is responsible for that.', 'Für die Rechnungen ist meine Kollegin zuständig.', 'Nenne eine zuständige Person.'],
    ['check-first', 'Das muss ich zuerst prüfen.', 'I need to check that first.', 'Ob die Datei schon fertig ist, muss ich zuerst prüfen.', 'Vermeide eine Zusage, bevor du die Information geprüft hast.'],
    ['get-back', 'Ich melde mich bei Ihnen, sobald ich mehr weiß.', 'I will get back to you as soon as I know more.', 'Ich frage im Team nach und melde mich bei Ihnen, sobald ich mehr weiß.', 'Kündige eine Rückmeldung an, ohne etwas zu erfinden.'],
    ['understood-request', 'Wenn ich Sie richtig verstehe, möchten Sie …', 'If I understand you correctly, you would like …', 'Wenn ich Sie richtig verstehe, möchten Sie die Unterlagen heute erhalten.', 'Fasse ein Anliegen zusammen, um Missverständnisse zu vermeiden.'],
    ['alternative', 'Ich kann Ihnen stattdessen … anbieten.', 'I can offer you … instead.', 'Ich kann Ihnen stattdessen einen Termin am Freitag anbieten.', 'Biete eine passende Alternative an.'],
    ['apology', 'Es tut mir leid, dass …', 'I am sorry that …', 'Es tut mir leid, dass Sie so lange warten mussten.', 'Entschuldige dich für eine konkrete Unannehmlichkeit.'],
  ],
  repair: [
    ['stuck', 'Ich komme hier nicht weiter.', 'I am stuck here.', 'Ich komme hier nicht weiter. Ich finde die richtige Datei nicht.', 'Sag offen, an welcher Stelle du Hilfe brauchst.'],
    ['cannot-open', 'Die Datei lässt sich nicht öffnen.', 'The file will not open.', 'Die Datei lässt sich nicht öffnen. Kannst du sie noch einmal schicken?', 'Beschreibe ein Problem mit einem Dokument.'],
    ['tried', 'Ich habe schon versucht, …', 'I have already tried to …', 'Ich habe schon versucht, das Programm neu zu starten.', 'Sag, was du bereits zur Lösung versucht hast.'],
    ['show-me', 'Könntest du mir zeigen, wie das geht?', 'Could you show me how to do that?', 'Ich benutze das Programm zum ersten Mal. Könntest du mir zeigen, wie das geht?', 'Bitte eine Kollegin um eine kurze Demonstration.'],
    ['error-message', 'Es erscheint eine Fehlermeldung.', 'An error message appears.', 'Wenn ich die Datei öffne, erscheint eine Fehlermeldung.', 'Beschreibe, was bei einem technischen Problem passiert.'],
    ['access', 'Ich habe keinen Zugriff auf …', 'I do not have access to …', 'Ich habe keinen Zugriff auf den Team-Ordner.', 'Erkläre, welche Freigabe dir fehlt.'],
    ['explain-again', 'Könntest du mir das noch einmal erklären?', 'Could you explain that to me again?', 'Den letzten Schritt habe ich nicht verstanden. Könntest du mir das noch einmal erklären?', 'Bitte um eine zweite Erklärung eines Arbeitsschritts.'],
    ['works-now', 'Jetzt funktioniert es.', 'It works now.', 'Jetzt funktioniert es. Danke für deine Hilfe.', 'Melde, dass das Problem gelöst ist.'],
    ['same-problem', 'Das Problem tritt immer noch auf.', 'The problem is still occurring.', 'Ich habe das Programm neu gestartet, aber das Problem tritt immer noch auf.', 'Sag, dass ein Lösungsversuch nicht geholfen hat.'],
    ['solve-together', 'Können wir das zusammen prüfen?', 'Can we check that together?', 'Ich finde den Fehler nicht. Können wir das zusammen prüfen?', 'Schlage vor, gemeinsam nach der Ursache zu suchen.'],
    ['not-sure', 'Ich bin mir noch nicht sicher, ob …', 'I am not yet sure whether …', 'Ich bin mir noch nicht sicher, ob die Angaben aktuell sind.', 'Drücke Unsicherheit aus, bevor du etwas bestätigst.'],
    ['understood-part', 'Den ersten Teil habe ich verstanden.', 'I understood the first part.', 'Den ersten Teil habe ich verstanden. Was soll ich danach machen?', 'Sag, welchen Teil du verstanden hast, und frage gezielt nach.'],
    ['could-slower', 'Könnten Sie bitte etwas langsamer sprechen?', 'Could you speak a little more slowly, please?', 'Entschuldigung, könnten Sie bitte etwas langsamer sprechen?', 'Bitte höflich um ein langsameres Sprechtempo.'],
    ['mean-word', 'Was bedeutet … in diesem Zusammenhang?', 'What does … mean in this context?', 'Was bedeutet „freigeben“ in diesem Zusammenhang?', 'Frage nach der Bedeutung eines Wortes in der aktuellen Situation.'],
    ['briefly-confirm', 'Ich möchte nur kurz sicherstellen, dass …', 'I just want to make sure that …', 'Ich möchte nur kurz sicherstellen, dass ich die richtige Version benutze.', 'Sichere eine wichtige Information ab.'],
  ],
  meeting: [
    ['meeting-question', 'Ich habe dazu eine Frage.', 'I have a question about that.', 'Ich habe dazu eine Frage: Wann soll die Aufgabe fertig sein?', 'Melde dich in einem Gespräch mit einer Frage.'],
    ['add-point', 'Ich möchte noch etwas ergänzen.', 'I would like to add something.', 'Ich möchte noch etwas ergänzen: Wir brauchen auch die neuen Zahlen.', 'Ergänze einen wichtigen Punkt.'],
    ['different-view', 'Ich sehe das etwas anders, weil …', 'I see it slightly differently because …', 'Ich sehe das etwas anders, weil wir noch nicht alle Informationen haben.', 'Widersprich höflich und begründe deine Meinung.'],
    ['agree-with', 'Da stimme ich dir zu.', 'I agree with you on that.', 'Da stimme ich dir zu. Der Termin wäre zu knapp.', 'Stimme einem konkreten Argument zu.'],
    ['if-understood', 'Wenn ich dich richtig verstehe, …', 'If I understand you correctly, …', 'Wenn ich dich richtig verstehe, sollen wir zuerst die Daten prüfen.', 'Prüfe, ob du einen Vorschlag richtig verstanden hast.'],
    ['take-notes', 'Ich schreibe das kurz mit.', 'I will briefly note that down.', 'Einen Moment, ich schreibe das kurz mit.', 'Sag, dass du wichtige Informationen notierst.'],
    ['decision', 'Was haben wir jetzt genau beschlossen?', 'What exactly have we decided?', 'Was haben wir jetzt genau beschlossen? Wer informiert das Team?', 'Frage am Ende nach der konkreten Entscheidung.'],
    ['responsible', 'Wer übernimmt diese Aufgabe?', 'Who will take on this task?', 'Wer übernimmt diese Aufgabe? Ich könnte die Liste prüfen.', 'Kläre die Zuständigkeit für eine Aufgabe.'],
    ['clarify-point', 'Können wir diesen Punkt kurz klären?', 'Can we briefly clarify this point?', 'Können wir diesen Punkt kurz klären, bevor wir weitermachen?', 'Halte kurz an, um eine offene Frage zu klären.'],
    ['summarize', 'Ich fasse kurz zusammen: …', 'Let me briefly summarise: …', 'Ich fasse kurz zusammen: Ich prüfe die Daten und du bereitest die Folien vor.', 'Fasse die vereinbarten nächsten Schritte zusammen.'],
  ],
  interview: [
    ['strength', 'Eine meiner Stärken ist …', 'One of my strengths is …', 'Eine meiner Stärken ist meine Geduld.', 'Nenne eine echte Stärke.'],
    ['example', 'Ein Beispiel dafür ist …', 'An example of that is …', 'Ein Beispiel dafür ist unser Gruppenprojekt im letzten Semester.', 'Belege eine Aussage mit einem konkreten Beispiel.'],
    ['learned', 'Dabei habe ich gelernt, …', 'Through that, I learned to …', 'Dabei habe ich gelernt, Aufgaben im Team klar zu verteilen.', 'Erkläre, was du durch eine Erfahrung gelernt hast.'],
    ['still-learning', 'Damit habe ich noch wenig Erfahrung.', 'I have little experience with that so far.', 'Damit habe ich noch wenig Erfahrung, aber ich würde es gerne lernen.', 'Sprich ehrlich über eine Fähigkeit, die du noch entwickeln möchtest.'],
    ['learn-fast', 'Ich bin bereit, mich einzuarbeiten.', 'I am ready to learn the role.', 'Das Programm kenne ich noch nicht. Ich bin bereit, mich einzuarbeiten.', 'Zeige Lernbereitschaft, ohne Erfahrung zu erfinden.'],
    ['own-question', 'Wie würde ein typischer Arbeitstag aussehen?', 'What would a typical working day look like?', 'Wie würde ein typischer Arbeitstag in Ihrem Team aussehen?', 'Stelle eine konkrete Frage zur täglichen Arbeit.'],
    ['onboarding', 'Wie läuft die Einarbeitung ab?', 'How does onboarding work?', 'Wie läuft die Einarbeitung ab, und wer wäre meine Ansprechperson?', 'Frage nach Unterstützung am Anfang.'],
    ['teamwork', 'Im Team ist mir wichtig, dass …', 'In a team, it is important to me that …', 'Im Team ist mir wichtig, dass wir offen miteinander sprechen.', 'Beschreibe, was dir bei der Zusammenarbeit wichtig ist.'],
    ['feedback', 'Ich freue mich über eine Rückmeldung.', 'I would appreciate hearing back.', 'Vielen Dank für das Gespräch. Ich freue mich über eine Rückmeldung.', 'Beende ein Bewerbungsgespräch freundlich.'],
    ['explain-simply', 'Ich versuche, es anders zu erklären.', 'Let me try to explain it another way.', 'Ich versuche, es anders zu erklären: Wir haben die Arbeit in drei Schritte aufgeteilt.', 'Formuliere deine Aussage neu, wenn sie nicht klar war.'],
  ],
  smalltalk: [
    ['usually', 'Normalerweise …', 'Usually …', 'Normalerweise fahre ich mit dem Fahrrad zur Uni.', 'Beschreibe eine Gewohnheit.'],
    ['after-that', 'Danach …', 'After that …', 'Morgens habe ich eine Vorlesung. Danach gehe ich in die Bibliothek.', 'Verbinde zwei Ereignisse in einer Erzählung.'],
    ['prefer', 'Am liebsten …', 'Most of all, I like to …', 'Am liebsten koche ich mit Freunden.', 'Erzähle von einer Vorliebe.'],
    ['join-lunch', 'Gehen wir zusammen Mittag essen?', 'Shall we have lunch together?', 'Gehen wir heute zusammen Mittag essen?', 'Lade einen Kollegen zum Mittagessen ein.'],
    ['plans', 'Hast du schon Pläne für …?', 'Do you already have plans for …?', 'Hast du schon Pläne für das Wochenende?', 'Stelle eine freundliche Frage zu Freizeitplänen.'],
    ['tell-more', 'Erzähl mal, wie war das?', 'Tell me, what was that like?', 'Du warst am Wochenende wandern? Erzähl mal, wie war das?', 'Zeige Interesse und frage nach einem Erlebnis.'],
    ['sounds-interesting', 'Das klingt interessant.', 'That sounds interesting.', 'Das klingt interessant. Wie bist du auf die Idee gekommen?', 'Reagiere interessiert und frage weiter.'],
    ['new-here', 'Ich bin noch neu hier.', 'I am still new here.', 'Ich bin noch neu hier. Kannst du mir zeigen, wo die Küche ist?', 'Erkläre, warum du eine praktische Frage hast.'],
    ['where-find', 'Wo finde ich …?', 'Where can I find …?', 'Wo finde ich den Besprechungsraum?', 'Frage nach einem Ort oder einem Gegenstand.'],
  ],
};

export const PHRASES = [
  ...structuredClone(LEGACY_PHRASES).map(item => ({ ...item, cueDe: originalCues[item.id], noteDe: 'Benutze deine eigenen Angaben. Sprich zuerst selbst und vergleiche dann mit dem Beispiel.' })),
  ...Object.entries(groups).flatMap(([tag, rows]) => rows.map(row => phrase(row, tag))),
];

export function allPhrases(state) {
  const merged = new Map(PHRASES.map(phrase => [phrase.id, phrase]));
  for (const saved of state?.personalPhrases ?? []) {
    const core = corePhrase(saved.de, saved.en);
    if (core) merged.set(core.id, { ...core, example: saved.example || core.example,
      sourceUrl: saved.sourceUrl, sourceId: saved.sourceId, sourceTitle: saved.sourceTitle,
      personalId: saved.id, tags: [...new Set([...core.tags, 'personal'])] });
    else merged.set(saved.id, saved);
  }
  return [...merged.values()];
}

export function phraseById(id, state) {
  return allPhrases(state).find(phrase => phrase.id === id);
}

export function phraseIdentity(de, en) {
  const normalize = value => value.normalize('NFKC').toLocaleLowerCase('de').replace(/[\p{P}\p{S}]/gu, ' ').replace(/\s+/g, ' ').trim();
  return `${normalize(de)}\u0000${normalize(en)}`;
}

const coreIdentities = new Map(PHRASES.map(phrase => [phraseIdentity(phrase.de, phrase.en), phrase]));
export function corePhrase(de, en) { return coreIdentities.get(phraseIdentity(de, en)); }
