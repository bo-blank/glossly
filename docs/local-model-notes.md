# Lokale Modelle: Messungen und Empfehlungen

Gemessen am 2026-09-20 gegen llama-swap auf `http://127.0.0.1:8080/v1`
(RTX 4060 Ti, 16 GB). Alle Zahlen aus echten Requests, nicht geschätzt.

## TL;DR

`gemma4-e2b-qat` (der aktuelle Default in `settingsStore.ts`) ist die richtige Wahl.
Aber Glossly schaltet das Reasoning nicht ab und zahlt dafür bei **jedem** Request:

| Glossly-Request (3 Vorschläge, förmlicher, deutsch, JSON-Schema) | Latenz (3 Läufe) | reasoning_content |
|---|---|---|
| wie heute | 4.19 / 4.61 / 5.28 s | **2034 Zeichen** |
| `enable_thinking: false` | 0.64 / 0.67 / 0.72 s | 0 |

**6.9x schneller bei gleicher Qualität.** Die Vorschläge sind in beiden Fällen
brauchbares, förmliches Deutsch — das Nachdenken landet ohnehin nicht im Ergebnis.

## Die Änderung

In `apps/server/src/providers/openaiCompatible.ts` gibt es drei Request-Bodies
(Zeilen ~95, ~151, ~256). Allen drei fehlt die Abschaltung:

```ts
body: JSON.stringify({
  model,
  messages: buildMessages(...),
  response_format: { type: 'json_schema', json_schema: SUGGESTIONS_JSON_SCHEMA },
  temperature: 0.8,
  chat_template_kwargs: { enable_thinking: false }   // <— fehlt
}),
```

Alternativ `reasoning_effort: 'none'` — beides funktioniert, gemessen identisch.
Sinnvoll wäre, das nicht hart zu verdrahten, sondern an das Modell zu koppeln:
Nicht-Reasoning-Modelle ignorieren den Parameter, es schadet also nicht, aber ein
Schalter in `settingsStore.ts` neben `model` wäre ehrlicher.

Nebeneffekt: der `<think>`-Stripper in `streamParse.ts` (siehe
`streamParse.test.ts:60`) wird dadurch für gemma4 zum Totgewicht — er sollte
bleiben (andere Modelle), aber er ist dann nicht mehr der Normalfall, sondern
Fallback.

## Modellvergleich für die Chips

Fünf Operationen, deutsch, mit striktem System-Prompt und abgeschaltetem Reasoning:

| Chip | gemma4-e2b-qat | lfm2-exp-2.6b |
|---|---|---|
| Synonyme | ok | ok |
| Umformulieren | sinntreu | **driftet** (Ergebnisse → Analyse → Daten) |
| förmlicher | „die Ergebnisse sind zufriedenstellend" | „in weiten Teilen passend" (schief) |
| lockerer | Inhalt erhalten, Register einheitlich | „Klar, alles in Ordnung." (Inhalt weg) |
| knapper | „Bitte melden Sie sich bis Ende der Woche zurück." | „Bis Ende der Woche Rückmeldung." (verblos) |

`gemma4-e2b-qat` gewinnt 4 von 5 — und genau die zwei Operationen, an denen das
Alternativmodell scheitert. Es ist außerdem kleiner (2600 MiB) und teilt sich
Chat-Template und Sprachqualität mit `gemma4-12b-qat-mtp`.

Rechtschreibung und Kommasetzung löst e2b **identisch zu gemma4-12b**
(muß/dass/schliessen/draussen, Relativsatz-Kommas) — in Bruchteilen der Zeit.
Für Chips braucht es das große Modell also nicht.

## Grenzen — nicht dafür benutzen

- **Grammatik erklären.** Kleine Modelle erfinden Regeln (ein Testlauf behauptete,
  „wegen" verlange den Dativ, dann den Genitiv, dann sei es stilistisch). Falls
  Glossly je anzeigt, *warum* etwas geändert wurde: dafür `gemma4-12b-qat-mtp`.
- **Nominalstil → Verbalstil.** Beide 2.6B-Klassen liefern wieder ein
  Funktionsverbgefüge („führen die Überprüfung durch").

## Wenn Top-Qualität wichtiger ist als Tempo

`gemma4-12b-qat-mtp` ist bei „Kürzen" und „Lockerer" besser, aber:

- **Menü statt Satz.** Es antwortet auf eine Ton-Anfrage mit einer Auswahl von
  Varianten samt Überschriften, statt mit dem Satz. Das JSON-Schema fängt das in
  Glossly ab — bei Freitext-Pfaden aber nicht.
- **Leere Antworten bei knappem Budget.** Bei `max_tokens: 400` kam auf zwei
  deutschen Aufgaben **leerer Content** zurück: das Reasoning hatte das Budget
  aufgebraucht. Für gemma-12b-Pfade `max_tokens` großzügig setzen (2000+) —
  oder eben auch dort `enable_thinking: false`.

## Kontext

Beide Modelle liegen gleichzeitig im VRAM (12605 MiB zusammen, 0 % Verlust), ein
hybrides Routing löst also keinen Modellwechsel aus.

`-rea` steht bei den gemma4-Einträgen in `~/llama-swap-config/config.yaml` auf
Default (= auto = an). Der Request-Parameter ist der sichere Weg; ein `-rea off`
im Eintrag würde auch das Hermes-Kanban-Profil `tiny` betreffen, das dasselbe
Modell nutzt.

## Verifiziert end-to-end (2026-09-20)

Die Änderung ist in `openaiCompatible.ts` drin (`NO_THINKING`, in alle drei Request-Bodies
gespreadet). Geprüft über Glossly's eigene Route, nicht über einen nachgebauten Request:

```
POST /api/suggest  provider=openai-compatible  model=gemma4-e2b-qat  mode=sentence
  -> 612ms / 511ms / 489ms / 571ms / 580ms
```

Antwortqualität unverändert ("Nach einer Durchsicht ist alles in Ordnung." usw.).
`reasoning_content` ist 0, kein `<think>` im Content. Tests: 14 server + 53 web, alle
gruen; `tsc --noEmit` sauber. `dist/` ist gitignored und veraltet - `npm run dev` nutzt
ts-node auf `src/`, die Aenderung wirkt also sofort; vor einem `npm run build` nichts zu tun.

### Noch offen: Latenz-Ausreisser durch temperature 0.8

Bei den Messungen kamen vereinzelt Laeufe mit 4.5s statt 0.5s. Das ist **nicht** das
Reasoning (das ist aus), sondern die Ausgabelaenge: die schnellen Laeufe erzeugen 50-80
Tokens, die langsamen 529-620 - bei identischen ~130 tok/s.

| temperature | completion_tokens ueber 5 Laeufe | Latenz |
|---|---|---|
| 0.8 (aktuell) | 73, **529**, 72, 80, 75 | 0.68 / **4.09** / 0.62 / 0.67 / 0.63 s |
| 0.3 | 66, 78, 89, 71, 73 | 0.56 - 0.73 s |

Etwa jeder fuenfte Request bei 0.8 entgleist. `temperature: 0.8` steht in
`openaiCompatible.ts` an zwei Stellen (Vorschlaege, Streaming); 0.3 wird nur fuer
AI-Likeness benutzt. Absenken wuerde den Ausreisser beseitigen, kostet aber Varianz
zwischen den drei Vorschlaegen. Alternativen: `max_tokens` deckeln (z.B. 200) oder das
JSON-Schema um eine `maxLength` pro Vorschlag erweitern. **Bewusst nicht geaendert** -
das ist eine Produktentscheidung, kein Bugfix.
