// Fixed samples for bench-context.run.ts. Each is built so that something the
// model needs — the form of address, the setting, a term defined earlier —
// sits further from the selection than the old ±1-block context reached.

export interface BenchCase {
  doc: string;
  selection: string;
  modifier?: 'tighter' | 'vivid' | 'plain';
  /** What a good answer respects — for the reader of the results. */
  watch: string;
  /** An objective failure, counted across every answer: the wrong form of address. */
  forbid?: RegExp;
}

// Informal and formal German address. "Sie" only counts mid-sentence, where it
// can't be "she/they" starting a sentence.
const DU = /\b(du|dir|dich|dein\w*)\b/i;
const SIE = /\b(Ihnen|Ihre?[mnrs]?)\b|(?<!^|[.!?]\s)\bSie\b/;

const FAEHRE = `# Die letzte Fähre

## Kapitel 1 – Abreise

Es war der dritte November, und der Nebel lag so dicht über dem Hafen von Norddeich, dass Marta die Möwen nur hörte. Sie hatte ihren Koffer seit dem Morgen nicht aus der Hand gegeben, als könnte ihn jemand an sich nehmen, sobald sie ihn abstellte. Im Koffer lagen die Briefe ihrer Großmutter, zusammengebunden mit einem Band, das früher einmal rot gewesen war.

Ihr Bruder Jonas hatte sie zum Bahnhof gebracht und dabei kaum gesprochen. „Du musst das nicht machen", hatte er schließlich gesagt, als der Zug schon einfuhr. „Du kannst das Haus auch verkaufen, ohne es noch einmal zu sehen." Marta hatte genickt und war trotzdem eingestiegen.

Der Fährmann war ein alter Mann mit einer Stimme, die nach Diesel und Salz klang. Er siezte jeden, auch die Kinder, und er siezte auch Marta, als er ihr Ticket abriss. „Sie sind spät dran, junge Frau", sagte er. „Die letzte Fähre wartet auf niemanden, auch nicht im November."

Auf dem Oberdeck war es kalt. Marta zog den Schal enger und sah zu, wie das Festland im Grau verschwand, erst die Kräne, dann die Dächer, zuletzt das rote Licht am Ende der Mole. Sie dachte an den Sommer, in dem sie zum letzten Mal hier gewesen war, an den Geruch von Teer und Sonnencreme, an die Großmutter, die am Anleger gestanden und mit beiden Armen gewunken hatte.

Die Überfahrt dauerte fünfzig Minuten. Marta zählte sie nicht, aber sie spürte jede einzelne. Einmal kam der Fährmann an ihr vorbei, blieb stehen und sagte, ohne sie anzusehen: „Das Haus am Deich, nicht wahr? Ihre Großmutter hat oft von Ihnen erzählt." Dann ging er weiter, bevor sie antworten konnte.

## Kapitel 2 – Die Insel

Die Insel empfing sie mit Wind. Der Nebel war hier dünner, zerrissen in lange Fahnen, die über die Dünen zogen, und dazwischen lag das Dorf mit seinen niedrigen Häusern, die Fenster schon erleuchtet, obwohl es kaum vier Uhr war. Marta blieb am Anleger stehen, genau dort, wo die Großmutter immer gestanden hatte.

Sie hatte sich vorgenommen, nicht zu weinen, und sie weinte nicht. Sie ging die Hauptstraße hinauf, am Kaufmann vorbei, dessen Schaufenster noch dieselben verblichenen Postkarten zeigte, an der Kirche vorbei, deren Tür offen stand, obwohl niemand darin war. Die Pflastersteine waren nass und glatt, und der Koffer holperte hinter ihr her.

Das Haus am Deich war kleiner, als sie es in Erinnerung hatte. Die Farbe an den Fensterläden blätterte ab, und im Vorgarten stand das Gras kniehoch, braun und niedergedrückt vom Regen. Marta suchte in ihrer Manteltasche nach dem Schlüssel, den Jonas ihr gegeben hatte, und fand ihn erst beim zweiten Versuch.

Drinnen roch es nach kaltem Ofen und nach Lavendel. Die Großmutter hatte überall kleine Säckchen verteilt, in den Schränken, unter den Kissen, sogar in der Brottrommel. Marta stellte den Koffer im Flur ab und ging langsam durch die Räume, berührte die Stuhllehnen, den Rand des Küchentischs, die kalte Scheibe des Fensters, hinter dem der Deich wie eine dunkle Wand lag.

Im Schlafzimmer lag auf dem Nachttisch ein Umschlag, auf dem ihr Name stand. Die Schrift war zittrig, aber unverkennbar. Marta setzte sich auf die Bettkante und hielt den Umschlag lange in den Händen, ohne ihn zu öffnen. Draußen schlug ein Fensterladen gegen die Wand, immer wieder, in einem Rhythmus, der fast wie ein Herzschlag klang.

Als es an der Tür klopfte, schrak sie zusammen. Es war der Fährmann. Er hielt eine Thermoskanne in der Hand und sah verlegen auf seine Stiefel. „Ich dachte, Sie haben vielleicht noch nichts Warmes", sagte er. „Und Sie sollten heute Nacht nicht allein in diesem kalten Haus sitzen, wenn Sie es nicht müssen."
`;

const DESK = `# Why I stopped using my standing desk

I bought a standing desk in 2021, at the height of the "sitting is the new smoking" panic. I used it faithfully for about four months. Then, slowly, I stopped. This post is about why — and about the one habit that actually fixed my back, which turned out to have nothing to do with furniture.

## The promise

The pitch for standing desks is simple: humans were not built to sit for nine hours a day, so don't. Stand for part of the day, alternate, and your back, your circulation and your focus all improve. I bought the most boring, most reviewed model I could find, a motorized frame with a bamboo top and four memory presets.

For the first few weeks I loved it. I stood through my morning emails, sat for deep work, stood again for calls. I felt virtuous. I told people about it, which, in hindsight, should have been a warning sign.

## What actually happened

By week six I noticed that I was standing less. Not deliberately — I would sit down "for a minute" to concentrate and look up two hours later. By month three, the desk spent most of its life at seated height, and the presets were just a way to feel bad about myself four times a day.

Worse, the standing I did do was bad standing. I locked my knees, shifted my weight to one hip, and leaned on the desk with my forearms. My lower back hurt more on standing days than on sitting days. A physiotherapist later told me this is extremely common: people swap one static posture for another static posture and call it progress.

## The real problem was stillness

The physiotherapist's point, which I now repeat to anyone who will listen, is that the enemy is not sitting. The enemy is stillness. Any position held for a long time loads the same tissues in the same way, and those tissues complain. The best posture, she said, is the next one.

That reframing changed everything. I did not need a better position; I needed more transitions between positions. A standing desk can help with that, but only if you actually move it, and I clearly was not going to.

## What I do now

I set a quiet timer for every 40 minutes. When it goes off, I get up and do something that requires walking: refill water, take the stairs to the mailbox, stretch in the doorway for one minute. It is not heroic. It is barely exercise. But it breaks the stillness, and after two months my back pain is mostly gone.

The desk is still here. I use it as a very expensive regular desk, and occasionally I stand at it for a call. I do not feel guilty about that anymore. The furniture was never the point; the movement was.
`;

const UMZUG = `# Projektplan Büroumzug Q1

## Ausgangslage

Der Mietvertrag für die Räume in der Lindenstraße endet am 31. März. Die neuen Räume im Hafenquartier sind ab dem 1. März verfügbar. Wir haben also vier Wochen Überlappung, die wir nutzen, um ohne Betriebsunterbrechung umzuziehen. Alle Mitarbeitenden werden in diesem Dokument geduzt, wie in unserer internen Kommunikation üblich.

## Verantwortlichkeiten

- Gesamtkoordination: Petra (Office Management)
- IT und Netzwerk: Deniz, unterstützt vom externen Dienstleister
- Möbel und Einrichtung: Lukas
- Kommunikation an Kundinnen und Kunden: Anna
- Budget und Freigaben: Geschäftsführung

## Zeitplan

- KW 9: Netzwerk im Hafenquartier wird eingerichtet und getestet
- KW 10: Möbel werden geliefert und aufgebaut, Arbeitsplätze nummeriert
- KW 11: Umzug der Teams in zwei Wellen (Montag Vertrieb und Support, Donnerstag Entwicklung und Verwaltung)
- KW 12: Puffer für Nacharbeiten, Rückbau in der Lindenstraße
- KW 13: Übergabe der alten Räume an den Vermieter

## Was du vorbereiten musst

- Räume deinen Schreibtisch bis zum Freitag vor deiner Umzugswelle leer. Persönliche Gegenstände kommen in die beschrifteten Kisten, die Petra verteilt.
- Beschrifte deinen Monitor und deine Dockingstation mit dem Aufkleber, den du per Hauspost bekommst.
- Nimm deinen Laptop am Umzugstag mit nach Hause und arbeite von dort, bis dein neuer Platz fertig ist.
- Melde dich bei Deniz, wenn du besondere Hardware nutzt, zum Beispiel einen zweiten Monitor oder ein Grafiktablett.

## Offene Punkte

- Parkplätze: Im Hafenquartier gibt es nur zwölf Stellplätze. Die Vergabe wird noch geklärt.
- Kantine: Die Kantine im Erdgeschoss öffnet erst im April. Bis dahin gibt es Essensgutscheine für die umliegenden Restaurants.
- Schließanlage: Die neuen Transponder werden in KW 10 ausgegeben. Bitte gib deinen alten Schlüssel erst nach dem Umzug ab.

## Kantine

Die Kantine im Erdgeschoss wird von einem externen Caterer betrieben. Der Vertrag beginnt am 1. April, vorher bleibt die Küche geschlossen.

## Essensgutscheine

Die Gutscheine liegen ab KW 10 am Empfang bereit. Wer sie nicht bis Ende März einlöst, verliert sie.
`;

const EMAIL = `Dear Ms. Okafor,

Thank you for your detailed feedback on the draft contract. We have reviewed each of your comments with our legal team and are happy to accept most of the proposed changes.

Regarding clause 7.2, we would prefer to keep the original notice period of ninety days, as our production planning depends on it. However, we are open to adding a clause that allows either party to shorten the period by mutual written agreement.

We will send a revised version by Friday. Please let me know if you would like to discuss the remaining points in a short call beforehand.

Kind regards,
Daniel Brandt
`;

export const BENCH_CASES: BenchCase[] = [
  {
    doc: FAEHRE,
    selection: 'ging langsam durch die Räume',
    modifier: 'vivid',
    watch: 'past tense, Marta as "sie", the cold empty-house mood set a chapter earlier'
  },
  {
    doc: FAEHRE,
    selection: 'Sie sollten heute Nacht nicht allein in diesem kalten Haus sitzen',
    watch: 'the ferryman always says "Sie" (established in chapter 1); must not switch to "du"',
    forbid: DU
  },
  {
    doc: DESK,
    selection: 'I get up and do something that requires walking',
    modifier: 'tighter',
    watch: 'the post\'s point is "movement breaks stillness" (defined two sections earlier)'
  },
  {
    doc: DESK,
    selection: 'The furniture was never the point',
    watch: 'callback to the thesis; first person, conversational register'
  },
  {
    doc: UMZUG,
    selection: 'Räume deinen Schreibtisch bis zum Freitag vor deiner Umzugswelle leer',
    modifier: 'plain',
    watch: '"du" is stated in the Ausgangslage section, far above; must stay "du"',
    forbid: SIE
  },
  {
    doc: UMZUG,
    selection: 'Die Vergabe wird noch geklärt',
    watch: 'terse project-document register, no invented details about parking'
  },
  {
    doc: EMAIL,
    selection: 'we would prefer to keep the original notice period of ninety days',
    modifier: 'plain',
    watch: 'formal business English; short document — every budget sees all of it (control case)'
  },
  {
    doc: EMAIL,
    selection: 'Please let me know if you would like to discuss',
    watch: 'formal, polite; control case'
  },
  {
    doc: UMZUG,
    selection: 'Wer sie nicht bis Ende März einlöst, verliert sie',
    modifier: 'plain',
    watch: 'the distance test: no address form within ±1 block; "du" only further up. Must not become "Sie"',
    forbid: SIE
  },
  {
    // The samples above are 1–4k characters, so budgets past 4000 change nothing
    // for them. Three documents glued together make the 8000 budget cost something.
    doc: [UMZUG, DESK, FAEHRE].join('\n\n'),
    selection: 'Drinnen roch es nach kaltem Ofen und nach Lavendel',
    watch: 'timing only — the surrounding text is unrelated filler'
  }
];
