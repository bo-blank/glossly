# Glossly — Roadmap

Glossly's strength is that it does *little*: a quiet editor in the margin.
Every feature has to pass one of two filters:

1. **The loop:** does it make the phrase-suggestion loop faster, more
   trustworthy, or less disruptive to writing flow?
2. **The structure** (from Phase 5): does it help the writer see and shape how
   the text is built?

Three rules hold for both. Nothing interrupts the writer, nothing changes
without a click, and nothing leaves the machine. A feature that needs a model
is **measured before it is built**, against a pass rule written in advance.

An analysis may *report* against what the writer said they want (a block's
purpose, a word budget). It may not invent goals, grade the writer or rewrite
text on its own. That is the line to the dropped "writing coach".

Last reviewed: 2026-11-16.

---

## Where things stand

| Phase | Theme | Status | Plan |
| --- | --- | --- | --- |
| 1 (v1.1) | Core UX of the suggestion loop | ✅ shipped | `plans/phase-1-v1.1.md` |
| 2 (v1.2) | Documents you can trust | ✅ shipped | `plans/phase-2-v1.2.md` |
| 3 (v1.3) | Suggestion quality | ✅ shipped | `plans/phase-3-v1.3.md` |
| 4 (v1.4) | Waiting, trust, starting points | ✅ shipped | `plans/phase-4-v1.4.md` |
| 5 (v1.5) | Text architecture: blocks | ✅ shipped | `plans/phase-5-v1.5.md` |
| 5.1 | File safety: Obsidian round trip | **now** | `plans/obsidian-round-trip.md` |
| 6a (v1.6) | Structure without a model: purpose, budget | **now** | `plans/phase-6-v1.6.md` WP1–WP2 |
| 6b | "Find blocks" (outline analyzer) | **next**, bench passed for 27b | `plans/phase-6-v1.6.md` WP4–WP5 |
| 6c | Red thread and block check | **gated** on one bench run | `plans/phase-6-v1.6.md` WP3, WP6 |
| 7 | Manuscript basics | candidates, not decided | stories 3.6–3.9 |
| Backlog | Server discovery, grammar check, web app | not scheduled | — |

---

## Now

### 5.1 — File safety: Obsidian round trip (#30)

A Markdown file from an Obsidian vault comes back **damaged** after open and
save: front matter turns into a heading, `[[wikilinks]]` and footnotes are
escaped, tables collapse into one line (measured 2026-10-04). This is a bug in
a shipped feature (#8, real files), so it goes before anything new.

- **WP1** narrower escaping and soft line breaks: stops the damage
- **WP2** front matter kept verbatim, shown as a "Properties" badge
- **WP3** `==highlight==` and **WP4** wikilink chips are comfort. They can
  follow later without risk to files.

No model, no open research. Story 3.5.

### 6a — Purpose and word budget per block (#26, #27)

Both work without a model and no bench result can take them away, so they
don't wait for one. (The plan put the bench first because the templates
already had purposes. The bench has been open since 2026-10-22.)

- **#26 Purpose per block.** One sentence per block saying what it must
  achieve. Travels with the block, survives Markdown, and templates fill it
  from their guide notes. Story 7.4.
- **#27 Word budget per block.** A target length shown as `42 / 80` in the
  outline, with a total. Never a warning in the text. Story 7.5.

---

## Next

### 6b — Outline analyzer, "Find blocks" (#28)

A text brought in from outside gets blocks, names and purposes proposed in
one click, with a preview before anything is applied. Story 7.6.

Segmentation **passed** on held-out for qwen38-27b (2026-10-22): F1 0.88 /
0.87 with headings, 0.72 / 0.79 without, 0 of 20 answers invalid, 33 s for
1 500 words. Two things are still open before it is built:

- the block **names** have to be read and scored (pass: ≥ 70 % acceptable)
- one held-out run on **gemma4-12b**, which would be the faster choice

This item no longer waits for the red-thread check. It needs WP4 (analysis
route, analysis model setting) and story 5.4 (say what a check costs before
it starts), because 33 s plus a model swap is a long wait.

---

## Gated

### 6c — Red thread and block check (#29)

"Does my text hold together, and does each part do its job?", measured
against the writer's purposes. Story 7.7.

On the tuning half no model passed. The failure is **false alarms on
unchanged texts** (25–37 % for 27b, bar ≤ 20 %), and 27b needs 89 s for
1 500 words, over the 60 s limit. The held-out run on 27b was stopped.

One decisive run settles it, and the rule is not loosened afterwards:

- **Pass:** build WP6 as planned.
- **Fail:** the judging part ends here. What remains worth building is the
  **gist list**: one line per block saying what it actually says. It makes no
  verdict, so there is nothing to raise a false alarm about, and the plan
  already calls it the most useful output. This is a suggestion from the
  2026-11-16 review, not a decision.

The decision about the left column (plan WP7) follows this.

---

## Candidates — Phase 7, manuscript basics

Not decided. These came out of the 2026-11-16 review as gaps a writer hits
once a real manuscript lives in Glossly. None needs a model. Stories are in
`user-stories.md`, in the order recommended there.

| Story | What | Filter | Size |
| --- | --- | --- | --- |
| 3.6 | Find and replace in the document | flow | small |
| 3.7 | Named versions of a document | trust | medium |
| 3.8 | Back up everything in one file | trust | small |
| 3.9 | Copy for where the text goes (rich / plain) | flow | small |
| 1.8 | Repeated words nearby, as an entry to the margin note | loop | small |
| 7.8 | Collapse blocks to see the skeleton | structure | small |
| 7.9 | Focus on one block | flow | small |
| 2.6 | Protected words for a whole series | trust | small |
| 1.9 | Hear a sentence read aloud | loop | small, one privacy condition |

---

## Backlog

Not scheduled, in the order they would come.

### 17. Find the local server

Probe a fixed list of loopback ports for llama-swap, llama.cpp, Ollama and LM
Studio, and preselect the model that is already loaded. Story 6.3.

It was parked behind #23 because who probes (proxy or browser) depends on the
web app. **Review suggestion:** let the proxy probe now. The proxy stays in
every web-app variant except the pure browser one, and until then a beginner
(P5) cannot get past Settings.

### 24. Grammar and spelling check

Opt-in check with gemma4-e2b: findings as margin notes, applied only by
click, quoted speech skipped. The first step is cheap and decides the rest:
re-run `bench-grammar` with quoted speech skipped (#22 measured 20 % / 10 %
false alarms without it). Story 6.7 lists the conditions.

### 23. Glossly as a web app

The browser reaching the local model directly (CORS, local network access) or
through the proxy as a companion, an installable PWA for the "own window"
feel, and hosting that keeps the privacy promise. Starts with a comparison
and a spike, and gets its own plan. Replaces desktop packaging (#15): Tauri
on Linux has no File System Access API.

### Later, from the Phase 6 plan

Nested blocks (chapter → scene), block reuse across documents, a structure
check while writing, a suggestion hint from the block's purpose for a larger
model.

---

## Shipped

Details are in the plan of each phase and in the stories.

### Phase 1 (v1.1) — Core UX

| # | Item |
| --- | --- |
| 1 | Streaming suggestions over SSE, first alternative within about a second |
| 2 | Response cache for the session (LRU 100, context in the key) |
| 3 | Custom modifier chips |
| 4 | Keyboard-only loop (Alt+1–3, Alt+N, Esc) |
| 5 | Dark mode |
| 6 | Full-sentence rewrite, opt-in |
| — | Starter templates |

### Phase 2 (v1.2) — Documents you can trust

| # | Item |
| --- | --- |
| 7 | Multiple documents |
| 8 | Real Markdown files via the File System Access API, with conflict choice |
| 9 | Markdown import and export |
| 10 | IndexedDB persistence, images as blobs |

### Phase 3 (v1.3) — Suggestion quality

| # | Item |
| --- | --- |
| 11 | Richer context: title, headings, 4 000 characters, du/Sie |
| 12 | Suggestion history per session |
| 13 | Per-chip tuning (temperature, instruction) |
| 14 | Comparison view, word by word |
| 15 | Desktop packaging — replaced by #23 |

### Phase 4 (v1.4) — Waiting, trust, starting points

| # | Item |
| --- | --- |
| 16 | Local-only indicator in the editor footer |
| 18 | Cold start reads as "loading", with its own timeout |
| 19 | Protected words per document |
| 20 | Templates in German and English, ten kinds of text |
| 21 | Own templates, images included |
| 22 | Grammar check **measured only**: e2b 90 % / 100 % fixed, 20 % / 10 % false alarms (missed the rule). 12b passed. See #24 |

### Phase 5 (v1.5) — Blocks

| # | Item |
| --- | --- |
| 25 | Blocks: split, merge, name, move (keyboard, drag handle, outline, table of contents), kept in Markdown as comments |
| — | Block name in the prompt: benched 2026-10-04, no effect, dropped |

### Shipped outside a phase (October 2026)

These were built without a roadmap entry. They are listed here so the roadmap
matches the app.

- **Readability for German.** A Hohenheim-style index (0–20) with the
  barriers marked in the text; Flesch stays for English.
- **Treatment plan against machine-sounding prose.** Patterns found by
  rules, no model. A click on a place asks for rewrites in the margin note.
- **Rhythm per block.** Staccato, monotony and a rhythm strip, by counting
  sentence lengths.
- **Compact, sticky formatting toolbar** and readable editor typography.

Two of these sit close to the "Dropped" list below. They stay on the right
side because they are rule-based, reproducible and on demand, and the fix
always goes through the margin note. Anything that extends them gets checked
against the filter first.

---

## Dropped, and why

Listed explicitly so they don't creep back in unexamined.

- **Hallucination / bias detection** — research-grade open problems; a local
  model judging another local model's output adds latency and false confidence,
  not trust.
- **Writing coach, learning & adaptation engine, semantic enhancement engine,
  creative variation generator** — each is its own intelligence layer that
  replaces the writer's judgment; contradicts the "quiet copilot" premise.
- **Voice & style preservation scoring, model-based rhythm analysis,
  explainable AI** — stylometry-as-a-feature promises precision a 12B local
  model can't deliver. (Counting sentence lengths per block is not this, and
  shipped.)
- **Multi-model orchestration** — one suggestion model per machine is enough.
  The one exception is a separate *analysis model* for Phase 6b/6c, picked by
  the writer and swapped by llama-swap, not by Glossly.
- **Local model fine-tuning** — very high complexity, near-zero audience
  overlap with this app.
- **Batch processing, suggestion templates, import/export of suggestions,
  conflict resolution tools** — workflow machinery for a problem the margin
  note doesn't have; undo already covers reverting.
- **Browser extension / mobile** — platform spread before the core is done;
  the web app (#23) is the one packaging step that pays for itself.
- **Success-metric targets** — the old list of unmeasured percentages is gone;
  if a metric matters it gets an actual measurement method first.
- **Block name in the suggestion prompt** — benched, e2b ignores it.

Already shipped, formerly on this list: smart selection snapping
(`wordBoundary.ts`), suggestion dedupe for "New suggestions", response
validation hardening.
