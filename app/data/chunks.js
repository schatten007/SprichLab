// Reusable conversational frames (spec section 7). Each has slots.
export const CHUNKS=[
{id:"c01",frame:"Ich glaube, dass …",en:"I believe that …",use:"opinions",ex:"Ich glaube, dass das Team nett ist.",slot:"+ Nebensatz (Verb am Ende)"},
{id:"c02",frame:"Ich denke, dass …",en:"I think that …",use:"opinions",ex:"Ich denke, dass wir das schaffen.",slot:"+ Nebensatz"},
{id:"c03",frame:"Ich bin nicht sicher, ob …",en:"I'm not sure whether …",use:"hedging",ex:"Ich bin nicht sicher, ob der Zug pünktlich ist.",slot:"+ ob-Satz"},
{id:"c04",frame:"Meiner Meinung nach …",en:"In my opinion …",use:"opinions",ex:"Meiner Meinung nach ist die Mensa ok.",slot:"+ Hauptsatz (Verb an 2. Stelle)"},
{id:"c05",frame:"Das kommt darauf an.",en:"It depends.",use:"hedging",ex:"Das kommt darauf an, wann du Zeit hast.",slot:"+ ob/wann-Satz"},
{id:"c06",frame:"Ich habe gerade …",en:"I just … / I'm currently …",use:"narrating",ex:"Ich habe gerade mit dem Projekt angefangen.",slot:"+ Partizip II"},
{id:"c07",frame:"Ich würde gerne …",en:"I would like to …",use:"wishes",ex:"Ich würde gerne im Team arbeiten.",slot:"+ Infinitiv"},
{id:"c08",frame:"Könnten Sie bitte …?",en:"Could you please …?",use:"polite request",ex:"Könnten Sie bitte das Fenster öffnen?",slot:"+ Infinitiv"},
{id:"c09",frame:"Was meinen Sie damit?",en:"What do you mean by that?",use:"clarify",ex:"Was meinen Sie damit genau?",slot:"standalone"},
{id:"c10",frame:"Wie sagt man … auf Deutsch?",en:"How do you say … in German?",use:"survival",ex:"Wie sagt man deadline auf Deutsch?",slot:"+ English word"},
{id:"c11",frame:"Ich habe das nicht ganz verstanden.",en:"I didn't quite understand.",use:"clarify",ex:"Ich habe das nicht ganz verstanden.",slot:"standalone"},
{id:"c12",frame:"Könnten Sie das noch einmal sagen?",en:"Could you say that again?",use:"clarify",ex:"Könnten Sie das noch einmal sagen, bitte?",slot:"standalone"},
{id:"c13",frame:"Das liegt daran, dass …",en:"That's because …",use:"explaining",ex:"Das liegt daran, dass ich neu hier bin.",slot:"+ dass-Satz"},
{id:"c14",frame:"Ich bin gerade dabei, … zu …",en:"I'm in the middle of …",use:"narrating",ex:"Ich bin gerade dabei, Deutsch zu lernen.",slot:"+ zu-Infinitiv"},
{id:"c15",frame:"Ich habe keine Ahnung, …",en:"I have no idea …",use:"hedging",ex:"Ich habe keine Ahnung, wo er ist.",slot:"+ w-Frage / ob"},
{id:"c16",frame:"Könnten wir …?",en:"Could we …?",use:"suggesting",ex:"Könnten wir uns morgen treffen?",slot:"+ Infinitiv"},
{id:"c17",frame:"Was hältst du von …?",en:"What do you think of …?",use:"opinions",ex:"Was hältst du von Homeoffice?",slot:"+ noun"},
{id:"c18",frame:"Lass uns …",en:"Let's …",use:"suggesting",ex:"Lass uns um zehn anfangen.",slot:"+ Infinitiv"},
{id:"c19",frame:"Ich freue mich auf …",en:"I'm looking forward to …",use:"social",ex:"Ich freue mich auf das Wochenende.",slot:"+ Akkusativ"},
{id:"c20",frame:"Es tut mir leid, aber …",en:"I'm sorry, but …",use:"polite",ex:"Es tut mir leid, aber ich habe keine Zeit.",slot:"+ Hauptsatz"}
];
