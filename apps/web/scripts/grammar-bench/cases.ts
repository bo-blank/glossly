// Test set for the grammar-check measurement (Phase 4 WP7, story 6.7).
//
// Error cases hold exactly one error; `expected` is the only correct fix.
// Commas are tested only where German makes them mandatory, and nothing here
// is disputed between style guides. Correct cases include the hard ones a
// checker must leave alone: fragments, dialect in dialogue, names, invented
// words, Swiss and British spelling, an optional comma, the subjunctive.

export type Lang = 'de' | 'en';

export interface ErrorCase {
  lang: Lang;
  category: string;
  text: string;
  expected: string;
  /** Other fixes that are just as correct. */
  alternatives?: string[];
}

export interface CorrectCase {
  lang: Lang;
  /** Why it is in the set — what a careless checker would "fix". */
  trap: string;
  text: string;
}

// Added after the first run (2026-10-03), which counted "Standardeinstellungen"
// as wrong although Duden prefers it to the hyphenated form.
const ALTERNATIVES: Record<string, string[]> = {
  'Die Standart-Einstellungen reichen für die meisten Nutzer.': ['Die Standardeinstellungen reichen für die meisten Nutzer.']
};

const e = (lang: Lang, category: string, pairs: [string, string][]): ErrorCase[] =>
  pairs.map(([text, expected]) => ({ lang, category, text, expected, alternatives: ALTERNATIVES[text] }));
const c = (lang: Lang, pairs: [string, string][]): CorrectCase[] => pairs.map(([trap, text]) => ({ lang, trap, text }));

export const ERROR_CASES: ErrorCase[] = [
  ...e('de', 'Rechtschreibung', [
    ['Das Ergebniss der Umfrage war eindeutig.', 'Das Ergebnis der Umfrage war eindeutig.'],
    ['Wir haben das Packet gestern abgeschickt.', 'Wir haben das Paket gestern abgeschickt.'],
    ['Bitte schicken Sie mir die Unterlagen bis Freitag zurrück.', 'Bitte schicken Sie mir die Unterlagen bis Freitag zurück.'],
    ['Der Vortrag war interresant, aber zu lang.', 'Der Vortrag war interessant, aber zu lang.'],
    ['Das war vorraussichtlich die letzte Sitzung.', 'Das war voraussichtlich die letzte Sitzung.'],
    ['Wir treffen uns morgen in der Bibliotek.', 'Wir treffen uns morgen in der Bibliothek.'],
    ['Die Standart-Einstellungen reichen für die meisten Nutzer.', 'Die Standard-Einstellungen reichen für die meisten Nutzer.'],
    ['Seid gestern funktioniert der Drucker nicht mehr.', 'Seit gestern funktioniert der Drucker nicht mehr.']
  ]),
  ...e('de', 'das/dass', [
    ['Ich hoffe, das du gut angekommen bist.', 'Ich hoffe, dass du gut angekommen bist.'],
    ['Sie wusste, das es schwierig werden würde.', 'Sie wusste, dass es schwierig werden würde.'],
    ['Das Buch, dass ich dir geliehen habe, gehört meiner Schwester.', 'Das Buch, das ich dir geliehen habe, gehört meiner Schwester.'],
    ['Es ist wichtig, das wir rechtzeitig anfangen.', 'Es ist wichtig, dass wir rechtzeitig anfangen.'],
    ['Das Projekt, dass wir im Frühjahr gestartet haben, ist fast fertig.', 'Das Projekt, das wir im Frühjahr gestartet haben, ist fast fertig.'],
    ['Er sagte, das er später kommt.', 'Er sagte, dass er später kommt.'],
    ['Dass ist genau der Punkt, um den es geht.', 'Das ist genau der Punkt, um den es geht.'],
    ['Ich glaube nicht, das sich das noch ändert.', 'Ich glaube nicht, dass sich das noch ändert.']
  ]),
  ...e('de', 'Komma', [
    ['Ich komme morgen wenn ich Zeit habe.', 'Ich komme morgen, wenn ich Zeit habe.'],
    ['Der Mann der neben mir saß, schlief die ganze Fahrt.', 'Der Mann, der neben mir saß, schlief die ganze Fahrt.'],
    ['Sie fuhr in die Stadt um neue Schuhe zu kaufen.', 'Sie fuhr in die Stadt, um neue Schuhe zu kaufen.'],
    ['Weil es regnete blieben wir zu Hause.', 'Weil es regnete, blieben wir zu Hause.'],
    ['Ich weiß nicht ob er kommt.', 'Ich weiß nicht, ob er kommt.'],
    ['Das Haus, das wir gekauft haben ist über hundert Jahre alt.', 'Das Haus, das wir gekauft haben, ist über hundert Jahre alt.'],
    ['Er ging ohne sich zu verabschieden.', 'Er ging, ohne sich zu verabschieden.'],
    ['Wir hatten kaum angefangen als es schon dunkel wurde.', 'Wir hatten kaum angefangen, als es schon dunkel wurde.']
  ]),
  ...e('de', 'Kongruenz', [
    ['Die Ergebnisse der Studie zeigt, dass mehr Bewegung hilft.', 'Die Ergebnisse der Studie zeigen, dass mehr Bewegung hilft.'],
    ['Mit dem neuen Kollege arbeite ich gern zusammen.', 'Mit dem neuen Kollegen arbeite ich gern zusammen.'],
    ['Jeder der Teilnehmer haben ein Zertifikat erhalten.', 'Jeder der Teilnehmer hat ein Zertifikat erhalten.'],
    ['Ich habe mit meinem Bruder und seiner Frau gesprochen, die beide sehr nett ist.', 'Ich habe mit meinem Bruder und seiner Frau gesprochen, die beide sehr nett sind.'],
    ['Die Kinder spielte den ganzen Nachmittag im Garten.', 'Die Kinder spielten den ganzen Nachmittag im Garten.'],
    ['Sie gab dem Kind ein Apfel.', 'Sie gab dem Kind einen Apfel.'],
    ['Ich bin mit der neue Version sehr zufrieden.', 'Ich bin mit der neuen Version sehr zufrieden.'],
    ['Meine Eltern wohnt seit zwanzig Jahren in Köln.', 'Meine Eltern wohnen seit zwanzig Jahren in Köln.']
  ]),
  ...e('de', 'Großschreibung', [
    ['Beim essen sprechen wir nicht über Arbeit.', 'Beim Essen sprechen wir nicht über Arbeit.'],
    ['Das Treffen findet am nächsten montag statt.', 'Das Treffen findet am nächsten Montag statt.'],
    ['Wir haben viel neues gelernt.', 'Wir haben viel Neues gelernt.'],
    ['Ich wünsche dir alles gute zum Geburtstag.', 'Ich wünsche dir alles Gute zum Geburtstag.'],
    ['Im allgemeinen sind die Rückmeldungen positiv.', 'Im Allgemeinen sind die Rückmeldungen positiv.'],
    ['Das ist das wichtigste, was du wissen musst.', 'Das ist das Wichtigste, was du wissen musst.'],
    ['Wir fahren mit dem Zug nach berlin.', 'Wir fahren mit dem Zug nach Berlin.'],
    ['Sie hat beim Lesen einen fehler entdeckt.', 'Sie hat beim Lesen einen Fehler entdeckt.']
  ]),
  ...e('en', 'spelling', [
    ['We recieved your message this morning.', 'We received your message this morning.'],
    ['The results were definately better than last year.', 'The results were definitely better than last year.'],
    ['Please seperate the old files from the new ones.', 'Please separate the old files from the new ones.'],
    ['It was a wierd coincidence.', 'It was a weird coincidence.'],
    ['The hotel can accomodate forty guests.', 'The hotel can accommodate forty guests.'],
    ['She is a very independant thinker.', 'She is a very independent thinker.'],
    ['The goverment announced new rules.', 'The government announced new rules.'],
    ['Untill then, nothing changes.', 'Until then, nothing changes.']
  ]),
  ...e('en', 'confusables', [
    ['Their going to announce the results tomorrow.', "They're going to announce the results tomorrow."],
    ["The company changed it's logo last year.", 'The company changed its logo last year.'],
    ['Your welcome to join us for lunch.', "You're welcome to join us for lunch."],
    ['This plan is better then the old one.', 'This plan is better than the old one.'],
    ['The new policy will effect everyone in the team.', 'The new policy will affect everyone in the team.'],
    ['I could of finished earlier.', 'I could have finished earlier.'],
    ['We put the boxes over their by the door.', 'We put the boxes over there by the door.'],
    ["Who's notebook is this?", 'Whose notebook is this?']
  ]),
  ...e('en', 'apostrophes', [
    ['The companys new office opens in May.', "The company's new office opens in May."],
    ['Its been a long week.', "It's been a long week."],
    ['Lets start with the second point.', "Let's start with the second point."],
    ['The childrens books are on the top shelf.', "The children's books are on the top shelf."],
    ["We sold over two hundred ticket's.", 'We sold over two hundred tickets.'],
    ['The two managers offices are next to each other.', "The two managers' offices are next to each other."],
    ['She doesnt know yet.', "She doesn't know yet."],
    ["The apple's are in the basket.", 'The apples are in the basket.']
  ]),
  ...e('en', 'agreement', [
    ['The list of names are on the table.', 'The list of names is on the table.'],
    ['Each of the students have a laptop.', 'Each of the students has a laptop.'],
    ["She don't like long meetings.", "She doesn't like long meetings."],
    ['The results of the survey shows a clear trend.', 'The results of the survey show a clear trend.'],
    ['There is three reasons for this.', 'There are three reasons for this.'],
    ['He go to the gym every morning.', 'He goes to the gym every morning.'],
    ['My brother and I was late.', 'My brother and I were late.'],
    ['Everyone in the room were quiet.', 'Everyone in the room was quiet.']
  ]),
  ...e('en', 'capitalisation', [
    ['We will meet again on monday.', 'We will meet again on Monday.'],
    ['She moved to paris last year.', 'She moved to Paris last year.'],
    ['i think we should wait.', 'I think we should wait.'],
    ['The report is written in english.', 'The report is written in English.'],
    ['Our next meeting is in january.', 'Our next meeting is in January.'],
    ['He works for google in Zurich.', 'He works for Google in Zurich.'],
    ['the meeting starts at ten.', 'The meeting starts at ten.'],
    ['We spent a week in the alps.', 'We spent a week in the Alps.']
  ])
];

export const CORRECT_CASES: CorrectCase[] = [
  ...c('de', [
    ['„dass“ richtig', 'Ich hoffe, dass du gut angekommen bist.'],
    ['„das“ als Relativpronomen', 'Das Buch, das ich dir geliehen habe, gehört meiner Schwester.'],
    ['Pflichtkomma vorhanden', 'Weil es regnete, blieben wir zu Hause.'],
    ['Kongruenz richtig', 'Die Ergebnisse der Studie zeigen, dass mehr Bewegung hilft.'],
    ['Fragment', 'Nicht heute, nicht morgen.'],
    ['Fragment, Aufzählung', 'Drei Wochen, zwei Absagen, ein Ergebnis.'],
    ['Dialekt im Dialog', '„Des passt scho“, sagte der Wirt.'],
    ['Umgangssprache im Dialog', '„Haste mal ’ne Minute?“, fragte sie.'],
    ['Eigennamen', 'Frau Brenneisen hat das Quellwerk gestern besichtigt.'],
    ['erfundenes Wort', 'Der Funkenwächter hob die Lampe über den Schacht.'],
    ['Schweizer Rechtschreibung (ss statt ß)', 'Das Ergebnis ist gross, und wir müssen es heute noch abschliessen.'],
    ['Konjunktiv I', 'Er sagte, er komme später.'],
    ['feste Wendung, groß', 'Im Großen und Ganzen sind wir zufrieden.'],
    ['Pflichtkomma bei „um … zu“', 'Sie fuhr in die Stadt, um neue Schuhe zu kaufen.'],
    ['Kann-Komma weggelassen', 'Er versprach sie anzurufen.'],
    ['Anglizismus', 'Das Meeting wurde auf Donnerstag verschoben.'],
    ['„im Voraus“', 'Wir haben uns im Voraus darauf geeinigt.'],
    ['„seit“ richtig', 'Seit gestern funktioniert der Drucker wieder.'],
    ['Stilmittel: Ellipse', 'Lang. Sehr lang. Zu lang.'],
    ['zwei Kommas richtig', 'Ich weiß nicht, ob er kommt, aber ich hoffe es.']
  ]),
  ...c('en', [
    ['spelling correct', 'We received your message this morning.'],
    ['"its" correct', 'The company changed its logo last year.'],
    ['"it\'s" correct', "It's been a long week."],
    ['agreement correct', 'The list of names is on the table.'],
    ['fragments', 'Not today. Maybe tomorrow.'],
    ['fragment, list', 'Three weeks, two rejections, one result.'],
    ['dialect in dialogue', '"Ain\'t nobody got time for that," she laughed.'],
    ['colloquial in dialogue', '"Gonna be late, sorry," he texted.'],
    ['names', 'Mara crossed the Glimmerfen at dawn.'],
    ['invented word', 'The sparkwarden raised the lamp above the shaft.'],
    ['British spelling', "The colour of the organisation's logo has changed."],
    ['"whom"', 'Whom did you invite?'],
    ['subjunctive', 'If I were you, I would wait.'],
    ['collective noun', 'The team is meeting on Monday.'],
    ['"data" as singular', 'Data is the new oil, they say.'],
    ['sentence starting with "And"', 'And that was the end of it.'],
    ['split infinitive', 'We need to quickly decide.'],
    ['no serial comma', 'We bought apples, pears and plums.'],
    ['"they\'re" correct', "They're going to announce the results tomorrow."],
    ['"let\'s" correct', "Let's meet after the call."]
  ])
];
