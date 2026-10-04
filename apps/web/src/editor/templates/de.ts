import type { TemplateText } from './types';

// Written in German, not translated from en.ts: the letters use German
// conventions and formal "Sie", the LinkedIn post and the video script the
// "du" usual there, the newsletter "ihr". The guide notes address nobody,
// like the rest of the interface.
export const DE: TemplateText[] = [
  {
    id: 'blank',
    name: 'Leere Seite',
    blurb: 'Nur der Cursor.',
    content: '<p></p>',
    guide: []
  },
  {
    id: 'business-email',
    name: 'Geschäftliche E-Mail',
    blurb: 'Anliegen, Kontext, nächster Schritt.',
    content: `
      <section data-block="Betreff">
        <p><strong>Betreff:</strong> Review auf Donnerstag verschieben – vorher zwei offene Punkte</p>
      </section>
      <section data-block="Erster Absatz">
        <p>Guten Tag Frau Krüger,</p>
        <p>könnten wir das Review von Dienstag auf Donnerstag um zehn Uhr verschieben? Aus der letzten Runde sind noch zwei Punkte offen. Die würde ich gern klären, bevor wir dem Kunden den Entwurf zeigen.</p>
      </section>
      <section data-block="Kontext">
        <p>Der erste ist das Budget für die zweite Phase. Unsere Zahlen vom März gingen von vier Workshops aus, inzwischen wünscht sich der Kunde sechs. Entweder wird der Umfang kleiner oder die Summe größer. Diese Entscheidung sollte beim Kunden liegen.</p>
        <p>Der zweite ist der Zeitplan. Bleibt es bei den zusätzlichen Workshops, verschiebt sich der Start um etwa drei Wochen. Ich habe beide Varianten skizziert und angehängt, damit Sie sehen, was jede kostet.</p>
      </section>
      <section data-block="Nächster Schritt">
        <p>Wenn Ihnen Donnerstag passt, schicke ich heute noch die Einladung und passe die Agenda an. Falls nicht, nennen Sie mir gern einen Termin, der Ihnen besser liegt.</p>
        <p>Viele Grüße<br>Jana Weiß</p>
      </section>
    `,
    guide: [
      { section: 'Betreff', hint: 'Das Anliegen gehört in den Betreff, damit man direkt aus dem Posteingang antworten kann.' },
      { section: 'Erster Absatz', hint: 'Zuerst die Bitte: was, von wem, bis wann.' },
      { section: 'Kontext', hint: 'Nur der Hintergrund, den man zum Antworten braucht. Der Rest kommt in den Anhang.' },
      { section: 'Nächster Schritt', hint: 'Sagen, was bei einem Ja passiert, und ein Nein leicht machen.' }
    ]
  },
  {
    id: 'cover-letter',
    name: 'Anschreiben',
    blurb: 'Erfahrung, Motivation, Bezug zur Firma.',
    content: `
      <section data-block="Einstieg">
        <p><strong>Bewerbung als Content Lead</strong></p>
        <p>Sehr geehrte Frau Berger,</p>
        <p>in Ihrer Ausschreibung steht, dass Ihre Leserinnen und Leser selbst vom Fach sind. Genau für solche Menschen schreibe ich seit sechs Jahren. Ich verantworte Newsletter und Blog eines mittelständischen Softwareunternehmens.</p>
      </section>
      <section data-block="Beleg">
        <p>Mein wichtigstes Projekt dort war der Newsletter. Aus einer monatlichen Produktübersicht wurde ein wöchentlicher Brief mit klarer Haltung. Innerhalb eines Jahres stieg die Öffnungsrate von 21 auf 38 Prozent. Der Vertrieb schickte Interessenten seitdem Ausgaben statt Broschüren. Mitbringen würde ich weniger das Format als die Gewohnheit dahinter. Zuerst festlegen, was jemand nach dem Lesen tun kann. Dann alles andere streichen.</p>
      </section>
      <section data-block="Warum diese Firma">
        <p>An Ihrem Unternehmen reizt mich besonders der Quartalsbericht. Er erklärt schwierige Abwägungen in klarer Sprache, ohne von oben herab zu reden. Das ist seltener, als es sein sollte. Ich würde gern dazu beitragen, dass mehr Ihrer Texte so klingen.</p>
      </section>
      <section data-block="Schluss">
        <p>Über ein Gespräch, in dem wir klären, wo ich Ihnen in den ersten sechs Monaten am meisten nützen kann, freue ich mich sehr.</p>
        <p>Mit freundlichen Grüßen<br>Jana Weiß</p>
      </section>
    `,
    guide: [
      { section: 'Einstieg', hint: 'Bei etwas aus der Ausschreibung anfangen, nicht bei sich selbst. Das zeigt, dass man sie gelesen hat.' },
      { section: 'Beleg', hint: 'Ein Erfolg mit einer Zahl wirkt mehr als eine Liste von Eigenschaften.' },
      { section: 'Warum diese Firma', hint: 'Etwas Konkretes und Wahres über das Unternehmen. Passt es auf jede Firma, streichen.' },
      { section: 'Schluss', hint: 'In einem Satz um das Gespräch bitten, ohne sich zu entschuldigen.' }
    ]
  },
  {
    id: 'meeting-notes',
    name: 'Besprechungsprotokoll',
    blurb: 'Beschlüsse, Zuständige, Fristen.',
    content: `
      <section data-block="Kopf">
        <h1>Projektrunde – 14. Oktober</h1>
        <p><strong>Anwesend:</strong> Priya, Jonas, Mei, Jana · <strong>Protokoll:</strong> Jana</p>
      </section>
      <section data-block="Tagesordnungspunkte">
        <h2>1. Relaunch der Website</h2>
        <p>Die neuen Seitenvorlagen sind fertig und in allen drei Browsern getestet. Bei der Migration der Inhalte hängen wir hinterher. Für etwa ein Drittel der alten Seiten fehlt die Entscheidung: umziehen, zusammenlegen oder löschen.</p>
        <h2>2. Budget für Phase zwei</h2>
        <p>Der Kunde wünscht sich sechs statt vier Workshops. Wir bieten zwei Varianten an und überlassen dem Kunden die Wahl. Die eine behält Umfang und Preis. Die andere bringt mehr Workshops und einen späteren Start.</p>
      </section>
      <section data-block="Beschlüsse">
        <h2>Beschlüsse</h2>
        <ul>
          <li><p>Der Start bleibt am 2. Dezember, sofern sich der Kunde nicht für den größeren Umfang entscheidet.</p></li>
          <li><p>Seiten, die bis Monatsende niemand übernimmt, werden archiviert statt migriert.</p></li>
        </ul>
      </section>
      <section data-block="Aufgaben">
        <h2>Aufgaben</h2>
        <ul data-type="taskList">
          <li data-type="taskItem" data-checked="false"><p>Priya schickt dem Kunden bis Freitag beide Budgetvarianten.</p></li>
          <li data-type="taskItem" data-checked="false"><p>Jonas listet die Seiten ohne Zuständige auf und teilt die Liste bis Mittwoch.</p></li>
          <li data-type="taskItem" data-checked="false"><p>Mei bucht einen Raum für die Kundenpräsentation am 28.</p></li>
        </ul>
        <p><strong>Nächster Termin:</strong> 21. Oktober, 10 Uhr.</p>
      </section>
    `,
    guide: [
      { section: 'Kopf', hint: 'Datum, Anwesende, wer protokolliert: genug, um es in einem Jahr wiederzufinden.' },
      { section: 'Tagesordnungspunkte', hint: 'Pro Punkt der Stand in zwei, drei Sätzen.' },
      { section: 'Beschlüsse', hint: 'Nur, was wirklich beschlossen wurde, und so formuliert, dass es niemand zweideutig lesen kann.' },
      { section: 'Aufgaben', hint: 'Jede Aufgabe bekommt genau einen Namen und ein Datum, sonst passiert sie nicht.' }
    ]
  },
  {
    id: 'linkedin-post',
    name: 'LinkedIn-Post',
    blurb: 'Aufhänger, Geschichte, Erkenntnis, Frage.',
    content: `
      <section data-block="Die ersten zwei Zeilen">
        <p>Drei Jahre lang habe ich das auf die harte Tour gemacht. Das hier würde ich meinem früheren Ich am ersten Tag sagen.</p>
        <p>Kurzfassung: Der schwierige Teil liegt woanders, als alle denken.</p>
      </section>
      <section data-block="Geschichte">
        <p>Etwas Kontext: Am Anfang dachte ich, uns fehlt es an Einsatz. Dabei hatte nur nie jemand aufgeschrieben, wie „fertig“ aussieht. Also begann mit jeder Runde dieselbe Diskussion von vorn.</p>
      </section>
      <section data-block="Erkenntnis">
        <p>Als wir das geändert hatten, passierten drei Dinge:</p>
        <ul>
          <li><p>Entscheidungen dauerten Stunden statt Wochen, weil die Kriterien auf dem Tisch lagen.</p></li>
          <li><p>Feedback wurde konkret. Man stritt über den Maßstab statt miteinander.</p></li>
          <li><p>Die Arbeit wurde kleiner und damit endlich abschließbar.</p></li>
        </ul>
        <p>Clever ist daran wenig. Es steht einfach irgendwo geschrieben, und das findet man erstaunlich selten.</p>
        <p>Falls du gerade mittendrin steckst: Schreib zuerst auf, was „fertig“ heißt. Alles danach wird leichter.</p>
      </section>
      <section data-block="Frage">
        <p>Was hätte dir jemand früher aufschreiben sollen? Und was schreibst du heute für andere auf?</p>
        <p>#schreiben #zusammenarbeit #lernen</p>
      </section>
    `,
    guide: [
      { section: 'Die ersten zwei Zeilen', hint: 'Nur sie sind vor „mehr anzeigen“ sichtbar. Sie müssen zum Klicken bringen.' },
      { section: 'Geschichte', hint: 'Eine konkrete Situation, kurz erzählt. Wer liest, soll die eigene wiedererkennen.' },
      { section: 'Erkenntnis', hint: 'Höchstens drei Punkte, jeder ein ganzer Satz.' },
      { section: 'Frage', hint: 'Mit einer Frage enden, die man aus eigener Erfahrung beantworten kann.' }
    ]
  },
  {
    id: 'video-script',
    name: 'Videoskript',
    blurb: 'Aufhänger, Abschnitte mit Bild, Aufruf.',
    content: `
      <section data-block="Länge">
        <h1>Drei Sätze, die jede E-Mail kürzer machen</h1>
        <p><strong>Länge:</strong> etwa 75 Sekunden · <strong>Format:</strong> Talking Head, hochkant 9:16</p>
      </section>
      <section data-block="Aufhänger">
        <h2>0:00–0:05 · Aufhänger</h2>
        <p><em>Bild: Nahaufnahme, direkt in die Kamera. Einblendung: „Deine E-Mails sind zu lang.“</em></p>
        <p>Deine E-Mails sind zu lang. Nicht, weil du schlecht schreibst, sondern weil du an der falschen Stelle anfängst.</p>
      </section>
      <section data-block="Hauptteil">
        <h2>0:05–0:20 · Das Problem</h2>
        <p><em>Bild: Bildschirmaufnahme einer langen E-Mail, die nach unten scrollt.</em></p>
        <p>Die meisten E-Mails beginnen mit dem Hintergrund: was passiert ist, wer was gesagt hat, warum das wichtig ist. Die eigentliche Frage steht im vierten Absatz. Bis dahin hat die Hälfte schon aufgehört zu lesen.</p>
        <h2>0:20–0:55 · Die drei Sätze</h2>
        <p><em>Bild: zurück zur Kamera. Jeder Satz erscheint als Einblendung.</em></p>
        <p>Dreh es also um. Der erste Satz ist das Anliegen: Was brauchst du, von wem, bis wann? Der zweite ist der eine Hintergrund, ohne den niemand antworten kann. Der dritte ist der nächste Schritt, falls die Antwort Ja lautet.</p>
        <p>Alles andere kommt in den Anhang oder fällt ganz weg. Du wirst überrascht sein, wie oft „ganz weg“ völlig reicht.</p>
        <h2>0:55–1:10 · Beispiel</h2>
        <p><em>Bild: die lange E-Mail vom Anfang, umgeschrieben in drei Sätze.</em></p>
        <p>Hier ist die E-Mail von vorhin. Aus vierzehn Zeilen wurden drei, und die Antwort kam innerhalb einer Stunde.</p>
      </section>
      <section data-block="Aufruf">
        <h2>1:10–1:15 · Aufruf</h2>
        <p><em>Bild: Nahaufnahme. Einblendung: „Anliegen · Kontext · nächster Schritt“.</em></p>
        <p>Probier es bei der nächsten E-Mail aus, die du heute schreibst, und schreib mir in die Kommentare, wie schnell die Antwort kam.</p>
      </section>
    `,
    guide: [
      { section: 'Länge', hint: 'Etwa 150 gesprochene Wörter pro Minute: Das Skript bestimmt die Länge des Videos.' },
      { section: 'Aufhänger', hint: 'Die ersten fünf Sekunden entscheiden, ob jemand bleibt. Das Problem nennen, nicht sich selbst.' },
      { section: 'Bild und Einblendung', hint: 'Die kursiven Zeilen sind für den Schnitt, nicht zum Sprechen. Kurz halten.', general: true },
      { section: 'Hauptteil', hint: 'Kurze gesprochene Sätze. Einmal laut vorlesen und streichen, wo man stolpert.' },
      { section: 'Aufruf', hint: 'Eine einzige Sache zum Tun, klein genug für heute.' }
    ]
  },
  {
    id: 'blog-article',
    name: 'Blogartikel',
    blurb: 'Problem, Idee, Praxis, Einwand.',
    content: `
      <section data-block="Titel und Vorspann">
        <h1>Wie wir unsere Website mit halb so vielen Seiten neu gestartet haben</h1>
        <p><em>Für Teams vor einem Relaunch: welche Seiten gehen können und warum weniger besser funktioniert.</em></p>
      </section>
      <section data-block="Das Problem">
        <h2>Das Problem</h2>
        <p>Unsere alte Website hatte 240 Seiten. Bei der Hälfte wusste niemand mehr, wer sie geschrieben hatte. Stellte ein Kunde eine einfache Frage, suchten selbst unsere eigenen Leute vergeblich.</p>
        <p>Dieser Text erzählt von der einen Regel, die unsere Website halbiert hat. Vermisst hat niemand etwas.</p>
      </section>
      <section data-block="Der Hintergrund">
        <h2>Der Hintergrund</h2>
        <p>Jede dieser Seiten war einmal die gute Idee von jemandem. Eine Kampagne, ein Produkt, eine Frage aus dem Kundenservice. In acht Jahren ist die Website nur gewachsen. Löschen fühlte sich riskanter an als Behalten.</p>
      </section>
      <section data-block="Die Hauptidee">
        <h2>Die Hauptidee</h2>
        <p>Eine Seite ohne Zuständige zieht nicht um. Das war die ganze Regel. Bevor etwas umzog, brauchte jede Seite eine Person, die sie aktuell hält. Was bis zur Frist niemand übernommen hatte, wurde archiviert.</p>
        <blockquote>
          <p>„Wenn niemand sie aktualisiert, sollte sie auch niemand lesen.“ – unsere Leiterin des Kundenservice, als wir es beschlossen</p>
        </blockquote>
      </section>
      <section data-block="In der Praxis">
        <h2>In der Praxis</h2>
        <ol>
          <li><p>Wir haben eine Liste aller Seiten mit ihren Aufrufen aus dem letzten Jahr exportiert. Das hat einen Nachmittag gedauert.</p></li>
          <li><p>Die Liste ging an alle Teams mit der Bitte, ihre Seiten zu übernehmen. Hier stockt es meistens, deshalb unbedingt mit fester Frist.</p></li>
          <li><p>Den Rest haben wir archiviert und einen Monat lang die Suchanfragen beobachtet. Drei Seiten kamen zurück, 117 nicht.</p></li>
        </ol>
      </section>
      <section data-block="Der Einwand">
        <h2>Der Einwand</h2>
        <p>Das stärkste Gegenargument sind Suchmaschinen: Alte Seiten bringen Besucher, auch wenn sie veraltet sind. Wir haben nachgesehen. Zwei Drittel der archivierten Seiten hatten weniger als zehn Aufrufe im Jahr. Die übrigen leiten jetzt auf aktuelle Seiten weiter.</p>
      </section>
      <section data-block="Was daraus folgt">
        <h2>Was daraus folgt</h2>
        <p>Wer einen Relaunch plant, sollte mit der Liste der Zuständigen anfangen, nicht mit dem Design. Die kleinste Version davon: die zwanzig meistbesuchten Seiten nehmen. Dann fragen, wem es auffiele, wenn dort etwas Falsches stünde.</p>
      </section>
    `,
    guide: [
      { section: 'Titel und Vorspann', hint: 'Der Titel verspricht genau eine Sache. Der Vorspann sagt, für wen der Text ist und was man danach tun kann.' },
      { section: 'Das Problem', hint: 'Das Problem so beschreiben, wie die Lesenden es erleben, und dann sagen, worauf der Text hinauswill.' },
      { section: 'Der Hintergrund', hint: 'Nur der Kontext, auf den sich das Argument später stützt.' },
      { section: 'Die Hauptidee', hint: 'Die These in einem Satz, verteidigt mit einem konkreten Beispiel oder einer Zahl.' },
      { section: 'In der Praxis', hint: 'Ein echter Fall, der Reihe nach, mit genug Details zum Nachmachen.' },
      { section: 'Der Einwand', hint: 'Das stärkste Gegenargument, ehrlich beantwortet. Ein Strohmann wirkt wie ein schwaches Argument.' },
      { section: 'Was daraus folgt', hint: 'Der Schluss gehört den Lesenden: eine Veränderung, die sich lohnt, und die kleinste Version davon.' }
    ]
  },
  {
    id: 'newsletter',
    name: 'Newsletter-Ausgabe',
    blurb: 'Einstieg, ein großes Thema, Links, Gruß.',
    content: `
      <section data-block="Betreff">
        <h1>Ausgabe 12: Das Meeting, das sich selbst geschrieben hat</h1>
      </section>
      <section data-block="Einstieg">
        <p>Hallo zusammen,</p>
        <p>diese Woche saß ich in einer Besprechung, deren Protokoll schon fertig war, bevor sie anfing. Das klingt nach Bürokratie, war aber das Gegenteil. Darum geht es heute.</p>
      </section>
      <section data-block="Das eine große Thema">
        <h2>Das eine große Thema</h2>
        <p>Unsere Projektrunde dauerte früher eine Stunde und erzeugte ein Protokoll, das niemand las. Vor drei Wochen haben wir etwas Kleines ausprobiert. Vor jeder Runde stehen die erwarteten Beschlüsse schon im Protokoll. Das Treffen ist nur noch dazu da, sie zu ändern. Letzten Dienstag hat es zwanzig Minuten gedauert. Zwei der fünf erwarteten Beschlüsse haben sich geändert. Das war der Unterschied: Wir stritten mit einem Entwurf statt mit einem leeren Blatt.</p>
        <p>Ich glaube nicht, dass das für jede Besprechung funktioniert. Für die, die immer wieder mit derselben Tagesordnung kommen, aber schon. Bei mir sind das die meisten.</p>
      </section>
      <section data-block="Lohnt sich">
        <h2>Lohnt sich</h2>
        <ul>
          <li><p><strong>Ein Essay über schlechte erste Entwürfe</strong>: das beste Argument, das ich kenne, um Schreiben und Beurteilen zu trennen.</p></li>
          <li><p><strong>Eine Anleitung zum Archivieren alter Webseiten</strong>: trocken, hat uns aber einen Monat gespart.</p></li>
          <li><p><strong>Eine Kurzgeschichte über einen gestrichenen Zug.</strong> Mit Arbeit hat sie nichts zu tun, und deshalb steht sie hier.</p></li>
        </ul>
      </section>
      <section data-block="Eine Kleinigkeit">
        <h2>Eine Kleinigkeit</h2>
        <p>Die Betreffzeile einer E-Mail zuletzt schreiben. Etwas zu benennen ist viel leichter, wenn man weiß, was drinsteht.</p>
      </section>
      <section data-block="Gruß">
        <p>Das war alles für diese Woche. Antwortet mir gern und schreibt, wo ihr anderer Meinung seid. Ich lese jede Antwort.</p>
        <p>Bis nächste Woche<br>Jana</p>
      </section>
    `,
    guide: [
      { section: 'Betreff', hint: 'Wie ein Satz, den man sagen würde, nicht wie eine Schlagzeile.' },
      { section: 'Einstieg', hint: 'Zwei, drei Sätze: warum dieses Thema, warum jetzt.' },
      { section: 'Das eine große Thema', hint: 'Ein Schwerpunkt pro Ausgabe, mit eigener Meinung. Deshalb abonnieren die Leute.' },
      { section: 'Lohnt sich', hint: 'Pro Link eine Zeile dazu, warum er hier steht, keine Zusammenfassung.' },
      { section: 'Eine Kleinigkeit', hint: 'Ein Tipp, ein Werkzeug oder ein guter Satz, in einem Absatz.' },
      { section: 'Gruß', hint: 'Zum Antworten einladen. Ein Newsletter, auf den man antwortet, wird auch gelesen.' }
    ]
  },
  {
    id: 'essay',
    name: 'Essay',
    blurb: 'Eine Frage, ein Argument, ein ehrliches Ende.',
    content: `
      <section data-block="Die Frage">
        <h1>Der erste Entwurf darf schlecht sein</h1>
        <h2>Die Frage</h2>
        <p>Wer schreibt, kennt den Moment. Die Seite ist leer. Der Satz im Kopf ist perfekt, der auf dem Bildschirm nicht. Also löscht man ihn und wartet auf einen besseren. Eine Stunde später ist die Seite immer noch leer. Der perfekte Satz ist verschwunden, wohin perfekte Sätze eben verschwinden.</p>
      </section>
      <section data-block="Das Argument">
        <h2>Das Argument</h2>
        <p>Das Problem ist nicht fehlendes Talent, sondern eine Verwechslung zweier Aufgaben. Einen Entwurf schreiben und einen Entwurf beurteilen beanspruchen verschiedene Teile des Kopfes. Beides gleichzeitig zu tun ist, als führe man mit einem Fuß auf jedem Pedal. Der Wagen ruckelt, und niemand kommt voran.</p>
        <p>Ein schlechter erster Entwurf löst das, indem er die Aufgaben zeitlich trennt. Zuerst findet man heraus, was man denkt, in welchen Worten auch immer. Dann, mit etwas auf der Seite, wird man zum Lektor. Und der hat es leichter, denn ändern ist immer einfacher als erfinden.</p>
      </section>
      <section data-block="Der Einwand">
        <h2>Der Einwand</h2>
        <p>Der naheliegende Einwand: Schlechte Entwürfe kosten Zeit. Manchmal stimmt das, ganze Seiten landen im Papierkorb. Aber auch eine gelöschte Seite hat ihre Arbeit getan, wenn sie gezeigt hat, worum es in dem Text nicht geht. Ein leerer Nachmittag kostet mehr, und er lehrt nichts.</p>
      </section>
      <section data-block="Der Schluss">
        <h2>Der Schluss</h2>
        <p>Nichts davon heißt, dass der fertige Text nachlässig sein darf. Es heißt nur, dass die Sorgfalt in den zweiten Durchgang gehört. Erst schlecht schreiben, dann gut machen – in dieser Reihenfolge und nicht gleichzeitig.</p>
      </section>
    `,
    guide: [
      { section: 'Die Frage', hint: 'Mit einer Szene oder Frage beginnen, die man aus dem eigenen Leben kennt.' },
      { section: 'Das Argument', hint: 'Erst die Ursache, dann die These. Eine Idee entwickeln, nicht drei aufzählen.' },
      { section: 'Der Einwand', hint: 'Das stärkste Gegenargument ernst nehmen und zugeben, was daran stimmt.' },
      { section: 'Der Schluss', hint: 'Zum Anfang zurückkehren und sagen, was sich ändert. Keine Zusammenfassung.' }
    ]
  },
  {
    id: 'scene',
    name: 'Szene',
    blurb: 'Ein Ort, zwei Menschen, etwas Unausgesprochenes.',
    content: `
      <section data-block="Ort">
        <h1>Gleis vier</h1>
        <p>Der letzte Zug war vor zwanzig Minuten gestrichen worden, aber keiner von beiden rührte sich. Lena saß auf der Bank, den Mantel bis zum Kinn zugeknöpft. Tom stand an der Bahnsteigkante. Er las die Anzeigetafel, als könnte sie es sich noch anders überlegen.</p>
      </section>
      <section data-block="Dialog">
        <p>„Wir könnten ein Taxi nehmen“, sagte er.</p>
        <p>„Wohin denn?“</p>
        <p>Er antwortete nicht. Irgendwo hinter ihnen summte ein Getränkeautomat und verstummte. Eine Taube lief die gelbe Linie entlang, begutachtete einen Krümel und entschied sich dagegen.</p>
        <p>„Du hast es deiner Schwester nie gesagt“, sagte Lena. Es war keine Frage, und er behandelte es auch nicht als eine. Er nahm die Hände aus den Taschen, sah sie an und steckte sie wieder ein.</p>
        <p>„Ich wollte es. Heute Abend. Beim Essen.“</p>
        <p>„Und jetzt gibt es kein Essen.“</p>
        <p>„Jetzt gibt es keinen Zug.“ Fast lächelte er. „Fühlt sich an wie ein Zeichen.“</p>
      </section>
      <section data-block="Wendung">
        <p>Die Tafel flackerte. Einen Moment lang wurden alle Zeilen leer. Beide sahen hin, als würde das, was zurückkam, für sie entscheiden. Dann der alte Text, im selben müden Orange: fällt aus, fällt aus, fällt aus.</p>
        <p>Lena stand auf und strich ihren Mantel glatt. „Ruf sie an“, sagte sie. „Von hier aus. Bevor du das nächste Zeichen findest.“</p>
      </section>
    `,
    guide: [
      { section: 'Ort', hint: 'Mitten in der Situation beginnen. Den Ort in ein, zwei konkreten Details.' },
      { section: 'Dialog', hint: 'Menschen sagen selten, was sie meinen. Das Wichtige zwischen den Zeilen lassen.' },
      { section: 'Geste', hint: 'Ein Gefühl über das zeigen, was jemand mit den Händen tut, nicht über Adjektive.', general: true },
      { section: 'Wendung', hint: 'Am Ende ändert sich etwas Kleines: eine Entscheidung, ein Blick, ein Satz.' }
    ]
  }
];
