// Hand-counted cases for textUnits.test.ts. Syllables as in a dictionary's
// hyphenation (Duden / Merriam-Webster); passives judged by grammar.

export const DE_SYLLABLES: [string, number][] = [
  ['Seite', 2], ['Seiten', 2], ['Woche', 2], ['Entscheidung', 3], ['Besprechung', 3], ['Zuständige', 4], ['Workshops', 2],
  ['über', 2], ['Gespräch', 2], ['freue', 2], ['Kunde', 2], ['Feuer', 2], ['Bäume', 2], ['heute', 2], ['Abend', 2],
  ['Haus', 1], ['Ziel', 1], ['Theater', 3], ['Erfahrung', 3], ['mittelständischen', 5], ['ich', 1], ['eine', 2], ['Ende', 2],
  ['Idee', 2], ['Zeile', 2], ['Quelle', 2], ['bequem', 2], ['Verständlichkeit', 4], ['Universität', 5], ['Zeitplan', 2],
  ['Budget', 2], ['Präsentation', 4], ['Newsletter', 3], ['Anliegen', 3], ['Hintergrund', 3], ['Leserinnen', 4],
  ['schreibe', 2], ['Augen', 2], ['Meer', 1], ['Boot', 1], ['Saal', 1], ['beobachten', 4], ['geeignet', 3], ['Familie', 4],
  ['Lösung', 2], ['Möglichkeiten', 4], ['Teilnehmende', 4], ['zusammenarbeiten', 6], ['Bahnsteigkante', 4], ['Getränkeautomat', 6]
];

export const EN_SYLLABLES: [string, number][] = [
  ['page', 1], ['pages', 2], ['decided', 3], ['meeting', 2], ['create', 2], ['the', 1], ['every', 3], ['simple', 2],
  ['wanted', 2], ['people', 2], ['idea', 3], ['area', 3], ['make', 1], ['made', 1], ['writing', 2], ['decision', 3],
  ['budget', 2], ['workshops', 2], ['really', 3], ['business', 2], ['table', 2], ['little', 2], ['jumped', 1], ['started', 2],
  ['readable', 3], ['quiet', 2], ['science', 2], ['naturally', 4], ['understand', 3], ['comprehension', 4], ['newsletter', 3],
  ['customer', 3], ['every', 3], ['finally', 3], ['problem', 2], ['answer', 2], ['analysis', 4], ['agenda', 3], ['schedule', 2],
  ['create', 2], ['video', 3], ['ruin', 2], ['fluent', 2], ['being', 2], ['going', 2], ['through', 1], ['thought', 1],
  ['education', 4], ['experience', 4], ['language', 2]
];

export const DE_PASSIVE: [string, boolean][] = [
  ['Der Entwurf wird morgen an den Kunden geschickt.', true],
  ['Die Seiten werden archiviert.', true],
  ['Das Budget wurde gestern beschlossen.', true],
  ['Die Einladung ist schon verschickt worden.', true],
  ['Bis Freitag wird die Liste ausgewertet.', true],
  ['Der Start wurde verschoben.', true],
  ['Die Agenda wird angepasst.', true],
  ['Es wird viel geredet.', true],
  ['Die Fehler wurden erklärt.', true],
  ['Die Texte werden von allen Teams gelesen.', true],
  ['Ich werde morgen kommen.', false],
  ['Das Projekt wird groß.', false],
  ['Wir werden gegen zehn Uhr da sein.', false],
  ['Sie wird Ärztin.', false],
  ['Der Kunde hat sechs Workshops gewünscht.', false],
  ['Wir haben die Liste ausgewertet.', false],
  ['Die Arbeit wurde kleiner und abschließbar.', false],
  ['Das wird genug sein.', false],
  ['Er wird gehen, sobald es geht.', false],
  ['Ich habe das gestern gesagt.', false]
];

export const EN_PASSIVE: [string, boolean][] = [
  ['The draft was sent to the client.', true],
  ['The pages were archived.', true],
  ['The budget has been approved.', true],
  ['Decisions are made in the weekly meeting.', true],
  ['The report was quickly written.', true],
  ['The invitation is being prepared.', true],
  ['The list was shared with every team.', true],
  ['Mistakes were made.', true],
  ['The start date is set for December.', true],
  ['The old pages were kept as redirects.', true],
  ['We sent the draft to the client.', false],
  ['The team is ready.', false],
  ['She was happy with the result.', false],
  ['It is a simple rule.', false],
  ['They were in the meeting.', false],
  ['We need more time.', false],
  ['He started the project in March.', false],
  ['The plan is to start in December.', false],
  ['Nobody missed the old pages.', false],
  ['This is indeed hard.', false]
];

/** [text, sentences] */
export const SENTENCES: [string, number][] = [
  ['Projektrunde am 14. Oktober. Alle waren da.', 2],
  ['Das kostet z. B. mehr Zeit. Wirklich.', 2],
  ['Dr. Krüger kommt um 10 Uhr. Gut.', 2],
  ['Die Hauptidee\nEine Seite ohne Zuständige zieht nicht um.', 2],
  ['Drei Dinge:\nEntscheidungen dauerten Stunden\nFeedback wurde konkret', 3],
  ['Version 2.5 ist da. Endlich.', 2],
  ['„Wohin denn?“ fragte sie. Er schwieg.', 2],
  ['„Wir könnten ein Taxi nehmen“, sagte er. „Wohin denn?“', 2],
  ['Er kam am 14. Danach ging er.', 2],
  ['Es kostet ca. drei Euro, d. h. weniger. Gut so.', 2],
  ['The meeting is at 10 a.m. tomorrow. Bring notes.', 2],
  ['Ask Dr. Smith, e.g. about the budget. Then decide.', 2],
  ['Really?! Yes.', 2],
  ['Done. still typing', 1],
  ['Wait… What happened? Nothing.', 3],
  ['Viele Grüße\nJana Weiß', 2]
];

// Held out: written after the rules were tuned on the lists above, so these
// show how the counters do on words they were not fitted to.
export const DE_SYLLABLES_HELD_OUT: [string, number][] = [
  ['Rückmeldung', 3], ['Ausschreibung', 3], ['Unternehmen', 4], ['Öffnungsrate', 4], ['Vertrieb', 2], ['Interessenten', 5],
  ['Gewohnheit', 3], ['Quartalsbericht', 4], ['Abwägungen', 4], ['Gespräch', 2], ['Nachmittag', 3], ['Suchmaschinen', 4],
  ['Weiterleitung', 4], ['Leiterin', 3], ['Kundenservice', 4], ['Anzeigetafel', 5], ['Getränk', 2], ['Schwester', 2],
  ['Taube', 2], ['Krümel', 2], ['Mantel', 2], ['einverstanden', 4], ['Kommunikation', 5], ['Bewerbung', 3], ['Erkenntnis', 3],
  ['Geschichte', 3], ['Situation', 4], ['Reihenfolge', 4], ['Feierabend', 4], ['neuere', 3], ['Euro', 2], ['Region', 3],
  ['Video', 3], ['Ozean', 3], ['beeindruckend', 4], ['Projektleitung', 4], ['vierzehn', 2], ['Entwürfe', 3], ['Leser', 2], ['Saison', 2]
];

export const EN_SYLLABLES_HELD_OUT: [string, number][] = [
  ['posting', 2], ['readers', 2], ['relevant', 3], ['project', 2], ['weekly', 2], ['opinion', 3], ['rate', 1], ['brochures', 2],
  ['habit', 2], ['quarterly', 3], ['report', 2], ['explains', 2], ['tradeoffs', 2], ['without', 2], ['talking', 2],
  ['useful', 2], ['months', 1], ['background', 2], ['attachment', 3], ['surprised', 2], ['engines', 2], ['visitors', 3],
  ['redirect', 3], ['smallest', 2], ['version', 2], ['changes', 2], ['honestly', 3], ['station', 2], ['cancelled', 2],
  ['departure', 3], ['vending', 2], ['machine', 2], ['pigeon', 2], ['decided', 3], ['against', 2], ['answered', 2],
  ['flickered', 2], ['orange', 2], ['smoothed', 1], ['another', 3]
];
