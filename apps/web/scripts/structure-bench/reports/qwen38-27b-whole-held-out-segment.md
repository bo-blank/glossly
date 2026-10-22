# Structure bench — qwen38-27b, 1 round(s), split: held-out, segmentation: whole

## Latency (warm model)

1472 words, 83 units, 33 blocks.

- segmentation: 32.7 s (11 blocks)
- red-thread check: 89.4 s (33 gist lines)

## Segmentation

Pass: boundary F1 ≥ 0.70 on held-out, both languages (one unit off = ½). An invalid answer scores 0.

| language · variant · split | mean F1 | invalid |
| --- | --- | --- |
| de · headings · held-out | 0.88 | 0/5 |
| de · no headings · held-out | 0.72 | 0/5 |
| en · headings · held-out | 0.87 | 0/5 |
| en · no headings · held-out | 0.79 | 0/5 |

Median 11.4 s per text.

| text | variant | split | F1 | gold starts | predicted starts | time |
| --- | --- | --- | --- | --- | --- | --- |
| de cover-letter | headings | held-out | 0.83 | 4 5 6 | 3 5 6 | 11.3 s |
| de cover-letter | no headings | held-out | 0.83 | 4 5 6 | 3 5 6 | 11.4 s |
| de meeting-notes | headings | held-out | 0.80 | 3 7 9 | 3 7 | 8.4 s |
| de meeting-notes | no headings | held-out | 0.83 | 2 4 5 | 2 4 6 | 9.3 s |
| de video-script | headings | held-out | 0.75 | 3 6 16 | 3 6 9 13 16 | 15.1 s |
| de video-script | no headings | held-out | 0.43 | 2 4 11 | 3 6 9 11 | 13.2 s |
| de blog-article | headings | held-out | 1.00 | 3 6 8 11 13 15 | 3 6 8 11 13 15 | 22.0 s |
| de blog-article | no headings | held-out | 0.50 | 2 4 5 7 8 9 | 4 7 | 9.8 s |
| de essay | headings | held-out | 1.00 | 4 7 9 | 4 7 9 | 10.9 s |
| de essay | no headings | held-out | 1.00 | 2 4 5 | 2 4 5 | 11.7 s |
| en cover-letter | headings | held-out | 0.75 | 3 4 5 | 2 3 4 5 6 | 12.3 s |
| en cover-letter | no headings | held-out | 0.75 | 3 4 5 | 2 3 4 5 6 | 10.7 s |
| en meeting-notes | headings | held-out | 0.86 | 3 7 9 | 3 5 7 9 | 10.4 s |
| en meeting-notes | no headings | held-out | 0.83 | 2 4 5 | 2 4 6 | 10.0 s |
| en video-script | headings | held-out | 0.75 | 3 6 16 | 3 6 9 13 16 | 13.1 s |
| en video-script | no headings | held-out | 0.57 | 2 4 11 | 4 6 9 11 | 11.6 s |
| en blog-article | headings | held-out | 1.00 | 3 6 8 11 13 15 | 3 6 8 11 13 15 | 16.9 s |
| en blog-article | no headings | held-out | 0.80 | 2 4 5 7 8 9 | 4 7 8 9 | 11.4 s |
| en essay | headings | held-out | 1.00 | 4 7 9 | 4 7 9 | 9.7 s |
| en essay | no headings | held-out | 1.00 | 2 4 5 | 2 4 5 | 10.1 s |

### Names and purposes (first round, for reading)

**de cover-letter · headings** — gold: Einstieg / Beleg / Warum diese Firma / Schluss

- 1–2 **Betreff und Anrede**: Den Kontext der Bewerbung und die direkte Ansprache der Ansprechperson herstellen.
- 3–4 **Relevanz und Erfolge**: Die fachliche Eignung durch konkrete Erfahrung und messbare Ergebnisse belegen.
- 5–5 **Unternehmensbezug**: Das spezifische Interesse am Unternehmen und die Wertschätzung für dessen Kommunikationsstil zeigen.
- 6–7 **Abschluss und Gruß**: Den Wunsch nach einem Gespräch formulieren und die E-Mail höflich beenden.

**de cover-letter · no headings** — gold: Einstieg / Beleg / Warum diese Firma / Schluss

- 1–2 **Betreff und Anrede**: Den Betreff der Bewerbung und die formelle Anrede der Ansprechperson festlegen.
- 3–4 **Erfahrung und Erfolg**: Die fachliche Eignung durch relevante Erfahrung und konkrete, messbare Erfolge im Newsletter-Bereich belegen.
- 5–5 **Unternehmensbezug**: Die spezifische Motivation für das Unternehmen durch die Wertschätzung des Quartalsberichts und die Bereitschaft zur Weiterentwicklung zeigen.
- 6–7 **Abschluss und Gruß**: Den Wunsch nach einem persönlichen Gespräch formulieren und die Bewerbung höflich beenden.

**de meeting-notes · headings** — gold: Kopf / Tagesordnungspunkte / Beschlüsse / Aufgaben

- 1–2 **Sitzungskopf**: Identifiziert Datum, Teilnehmer und Protokollführer der Projektrunde.
- 3–6 **Statusbericht**: Präsentiert den aktuellen Stand der Website-Migration und die Budgetoptionen für Phase zwei.
- 7–11 **Beschlüsse und Aufgaben**: Fasst die getroffenen Entscheidungen, die konkreten To-dos und den nächsten Termin zusammen.

**de meeting-notes · no headings** — gold: Kopf / Tagesordnungspunkte / Beschlüsse / Aufgaben

- 1–1 **Sitzungsdaten**: Die Anwesenden und die Protokollführung dokumentieren.
- 2–3 **Status und Optionen**: Den aktuellen Projektstand sowie die zwei angebotenen Workshop-Varianten zusammenfassen.
- 4–5 **Entscheidungen und Aufgaben**: Die festgelegten Konsequenzen und die konkreten nächsten Schritte für das Team definieren.
- 6–6 **Nächster Termin**: Den Zeitpunkt der nächsten Sitzung kommunizieren.

**de video-script · headings** — gold: Länge / Aufhänger / Hauptteil / Aufruf

- 1–2 **Titel und Metadaten**: Präsentiert den Titel des Videos und die technischen Formatvorgaben.
- 3–5 **Aufhänger**: Fängt die Aufmerksamkeit des Zuschers mit einer direkten Aussage über ein häufiges Problem.
- 6–8 **Problemdefinition**: Erklärt, warum lange E-Mails scheitern, indem sie den Fehler im Aufbau zeigt.
- 9–12 **Lösungsvorschlag**: Stellt die drei-Satz-Formel als effektive Alternative zur klassischen E-Mail-Struktur vor.
- 13–15 **Beispiel**: Demonstriert die Wirksamkeit der Methode anhand eines konkreten Vorher-Nachher-Vergleichs.
- 16–18 **Aufruf**: Motiviert den Zuschauer zur sofortigen Anwendung und Interaktion in den Kommentaren.

**de video-script · no headings** — gold: Länge / Aufhänger / Hauptteil / Aufruf

- 1–2 **Technische Angaben**: Definiert die technischen Parameter und das visuelle Setup des Videos.
- 3–5 **Problemstellung**: Identifiziert den Fehler in langen E-Mails und erklärt die Konsequenz für die Leserschaft.
- 6–8 **Lösungsansatz**: Präsentiert die dreistufige Struktur zur Lösung des Problems und die Reduktion von Inhalt.
- 9–10 **Beweisführung**: Demonstriert die Wirksamkeit der Methode durch ein konkretes Vorher-Nachher-Beispiel.
- 11–12 **Handlungsaufforderung**: Fasst die Kernpunkte zusammen und motiviert zur sofortigen Anwendung und Interaktion.

**de blog-article · headings** — gold: Titel und Vorspann / Das Problem / Der Hintergrund / Die Hauptidee / In der Praxis / Der Einwand / Was daraus folgt

- 1–2 **Titel und Zielgruppe**: Den Leser sofort über den Kern des Themas (Website-Relaunch) und den Nutzen (weniger Seiten) informieren.
- 3–5 **Problemstellung**: Die Dringlichkeit des Problems durch die unübersichtliche Struktur der alten Website und die daraus resultierende Ineffizienz verdeutlichen.
- 6–7 **Hintergrund**: Die psychologischen und historischen Gründe für das Wachstum der Website erklären, um das Behalten statt Löschen zu verstehen.
- 8–10 **Kernregel**: Die zentrale Strategie zur Reduktion der Seiten durch klare Zuständigkeiten und ein automatisches Archivierungsprinzip vorstellen.
- 11–12 **Umsetzung**: Den konkreten, schrittweisen Prozess der Inventarisierung, Zuweisung und Archivierung mit den erzielten Ergebnissen darlegen.
- 13–14 **Einwandbehandlung**: Die Sorge um den Verlust von SEO-Traffic durch Daten und die Umleitung auf aktuelle Seiten entkräften.
- 15–16 **Fazit und Handlung**: Dem Leser eine konkrete, sofort anwendbare Empfehlung für den Start eines eigenen Relaunch-Projekts geben.

**de blog-article · no headings** — gold: Titel und Vorspann / Das Problem / Der Hintergrund / Die Hauptidee / In der Praxis / Der Einwand / Was daraus folgt

- 1–3 **Problemstellung**: Die Notwendigkeit einer Reduktion der Website-Seiten durch ein konkretes Beispiel und die zentrale These einführen.
- 4–6 **Regel und Motivation**: Die psychologische Hürde beim Löschen erklären und die spezifische Zuständigkeitsregel als Lösung präsentieren.
- 7–9 **Umsetzung und Fazit**: Den konkreten Prozess der Seite-Reduktion beschreiben, das Hauptgegenargument entkräften und eine handlungsorientierte Empfehlung geben.

**de essay · headings** — gold: Die Frage / Das Argument / Der Einwand / Der Schluss

- 1–3 **Problemstellung**: Die Leser mit der Blockade des perfekten ersten Entwurfs konfrontieren.
- 4–6 **Kernaussage**: Die Trennung von Schreiben und Beurteilen als Lösung erklären.
- 7–8 **Einwandbehandlung**: Die Sorge um verschwendete Zeit durch den Wert der Entwürfe entkräften.
- 9–10 **Fazit**: Die Reihenfolge 'erst schlecht, dann gut' als Prinzip festigen.

**de essay · no headings** — gold: Die Frage / Das Argument / Der Einwand / Der Schluss

- 1–1 **Schreibblockade**: Die Frustration und den Stillstand beim Schreiben vor der leeren Seite schildern.
- 2–3 **Lösung Entwurf**: Die Ursache des Problems erklären und die Trennung von Entwurf und Beurteilung als Lösung vorschlagen.
- 4–4 **Einwand Zeit**: Die Sorge um verschwendete Zeit durch den Nutzen des schlechten Entwurfs entkräften.
- 5–5 **Fazit Sorgfalt**: Klären, dass Sorgfalt nicht fehlt, sondern nur in die Überarbeitung verlagert wird.

**en cover-letter · headings** — gold: Opening / Proof / Why them / Close

- 1–1 **Salutation**: Address the recipient formally to open the correspondence.
- 2–2 **Relevance Hook**: Establish immediate alignment between the candidate's experience and the job requirement.
- 3–3 **Evidence of Impact**: Demonstrate specific achievements and the underlying editorial philosophy through a concrete case study.
- 4–4 **Company Fit**: Show genuine interest in the company's specific voice and quality standards.
- 5–5 **Call to Action**: Propose a next step to discuss immediate value contribution.
- 6–6 **Sign-off**: Close the letter with professional courtesy and identification.

**en cover-letter · no headings** — gold: Opening / Proof / Why them / Close

- 1–1 **Salutation**: To formally address the recipient.
- 2–2 **Opening Hook**: To establish immediate relevance by connecting the job requirement with the candidate's specific expertise.
- 3–3 **Evidence**: To provide concrete proof of capability through a specific project and measurable results.
- 4–4 **Company Fit**: To demonstrate genuine interest in the specific company and its values.
- 5–5 **Call to Action**: To propose the next step in the hiring process.
- 6–6 **Closing**: To formally end the letter.

**en meeting-notes · headings** — gold: Header / Agenda items / Decisions / Action items

- 1–2 **Meeting Header**: Establish the meeting context, date, and attendees.
- 3–4 **Website Status**: Report progress on the website relaunch and highlight content migration delays.
- 5–6 **Budget Options**: Present two budget proposals to address the client's request for additional workshops.
- 7–8 **Key Decisions**: Define the launch date condition and the policy for unowned pages.
- 9–11 **Next Steps**: Assign specific action items to team members and schedule the next meeting.

**en meeting-notes · no headings** — gold: Header / Agenda items / Decisions / Action items

- 1–1 **Meeting Metadata**: Identify the participants and the note-taker for the session.
- 2–3 **Status Update**: Summarize the current progress on templates and content, and outline the strategic options for the client's scope change.
- 4–5 **Decisions and Actions**: Define the conditions for launch and archival, and assign specific next steps to team members.
- 6–6 **Next Meeting**: Schedule the date and time for the subsequent check-in.

**en video-script · headings** — gold: Length / Hook / Main part / Call to action

- 1–2 **Video Metadata**: Identifies the video title and technical specifications for the production team.
- 3–5 **Opening Hook**: Grabs attention by directly stating the viewer's problem with their email length.
- 6–8 **Problem Context**: Explains why standard email structures fail to engage readers.
- 9–12 **Core Solution**: Defines the three-sentence structure required to shorten emails effectively.
- 13–15 **Proof of Concept**: Demonstrates the solution's effectiveness through a concrete before-and-after example.
- 16–18 **Call to Action**: Encourages immediate application of the tip and engagement via comments.

**en video-script · no headings** — gold: Length / Hook / Main part / Call to action

- 1–3 **Hook**: Capture attention by stating the problem with long emails and promising a solution.
- 4–5 **Problem Context**: Illustrate the common mistake of burying the main point in background details.
- 6–8 **Solution Framework**: Present the specific three-sentence structure for effective emails and advise on trimming excess.
- 9–10 **Proof of Concept**: Demonstrate the framework's effectiveness by showing a before-and-after example with a positive result.
- 11–12 **Call to Action**: Summarize the key takeaway and encourage immediate application and audience engagement.

**en blog-article · headings** — gold: Title and standfirst / The problem / The background / The main idea / In practice / The objection / What follows

- 1–2 **Opening Hook**: To state the core result and define the scope for teams planning a website relaunch.
- 3–5 **Problem Statement**: To illustrate the inefficiency of the old site and introduce the simple rule that solved it.
- 6–7 **Contextual Background**: To explain the historical reasons why the site grew unmanaged and why deletion was avoided.
- 8–10 **Core Principle**: To define the specific ownership rule and provide a supporting quote to validate the decision.
- 11–12 **Implementation Steps**: To outline the practical steps taken to execute the ownership audit and archive unclaimed pages.
- 13–14 **Objection Handling**: To address the concern about losing search traffic by presenting data that validates the archiving decision.
- 15–16 **Actionable Takeaway**: To provide a concrete starting point and a minimal viable exercise for readers planning their own relaunch.

**en blog-article · no headings** — gold: Title and standfirst / The problem / The background / The main idea / In practice / The objection / What follows

- 1–3 **Problem Context**: Establish the pain point of an unmanageable, bloated website to justify the need for reduction.
- 4–6 **Core Principle**: Define the specific ownership rule that drives the pruning process and provide a supporting quote.
- 7–7 **Execution Steps**: Outline the practical steps taken to implement the ownership rule and archive unclaimed pages.
- 8–8 **Objection Handling**: Address the concern about losing search traffic by presenting data that validates the decision to archive.
- 9–9 **Actionable Advice**: Provide a concrete starting point for readers planning their own website relaunch.

**en essay · headings** — gold: The question / The argument / The objection / The ending

- 1–3 **The Problem**: To identify the common paralysis writers face when trying to create a perfect first sentence.
- 4–6 **The Solution**: To explain that separating the creative and critical processes allows for effective drafting.
- 7–8 **The Rebuttal**: To address the concern that bad drafts are inefficient by arguing they provide necessary clarity.
- 9–10 **The Conclusion**: To summarize the core principle that quality is achieved through sequential writing and editing.

**en essay · no headings** — gold: The question / The argument / The objection / The ending

- 1–1 **The Writer's Block**: To illustrate the common frustration of staring at an empty page while trying to write perfectly.
- 2–3 **Separating the Jobs**: To explain that writing and judging are distinct mental tasks that should be performed sequentially rather than simultaneously.
- 4–4 **Addressing the Objection**: To counter the argument that bad drafts are a waste of time by highlighting their diagnostic value.
- 5–5 **Final Principle**: To conclude that care belongs to the revision process, not the initial drafting phase.
