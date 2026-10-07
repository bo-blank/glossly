# Phase 6 (v1.6) — Implementation Plan: Analysing the structure

Self-contained plan for the second text-architecture step: Glossly helps the
writer **see whether the blocks work**. Each block gets a purpose and a length,
an imported text gets its blocks proposed by the model, and the model checks
the red thread and each block. Written for an implementing agent with no
prior context on this repository. Read this whole document before starting.

`docs/plans/phase-5-v1.5.md` covers blocks (the `section` node, Markdown
markers, moving, the outline in the structure card). `phase-3-v1.3.md`
covers the prompt and context extraction, and `phase-4-v1.4.md` covers
templates and the grammar bench whose method WP3 reuses.

## What Phase 6 is for

Phase 5 gave the text a skeleton the writer can see and rearrange. Phase 6
makes that skeleton say something: **what each part is for, how long it
should be, and whether the text as a whole holds together.** It is the "AI
analysis of the red thread and the single blocks" the writer planned when
blocks were introduced.

The web app (#23), finding the local server (#17) and the grammar check (#24)
move to the **backlog**, at the writer's decision (2026-10-04). AI features
come first.

### How this differs from the dropped "writing coach"

The roadmap dropped coach-style features because they replace the writer's
judgment. The analysis here stays on the right side of that line:

- It **reports** against what the *writer* said a block is for (purpose
  note). It does not invent goals or grade the writer.
- It **never rewrites text.** The only things it can apply are structural
  (block boundaries, names, purposes, order), and always one click, one
  transaction, one Ctrl+Z.
- It runs **only on a click**, never while typing.
- It is **measured before it is built** (WP3). If no local model passes the
  bar set in advance, the AI part stops there, and WP1/WP2 still stand on their own.

## Lesson from Phase 5 WP7

The block-name bench (2026-10-04) showed that e2b **ignores what a part of the
text is for** when it rewrites a sentence: the role markers stayed at 1–4 % with and
without a name. Segmenting a whole text and judging a red thread is a harder
task than that. Expect e2b to fail WP3 and plan for a larger
model (gemma4-12b or qwen38-27b) as the **analysis model**, with the latency
that comes with it (tens of seconds, a llama-swap model swap).

## Decisions already made (2026-10-04)

1. Phase 6 = purpose note per block, word budget per block, outline analyzer
   (propose blocks for an imported text), red thread + block analysis.
2. Web app, server discovery and grammar check → backlog.
3. Decisions A, B, C as recommended (2026-10-04). F: real texts later; WP3
   runs on the templates first.
4. WP3 runs before WP1/WP2 (writer's choice): the templates' guide notes
   already give every block a purpose.

## Open decisions — ask the writer before the WP that needs them

| # | Question | Recommendation | Needed by |
| --- | --- | --- | --- |
| A | Where do purpose and budget live? | **On the block** (`section` attributes `purpose`, `words`), so they move, split and travel with it, and own templates keep them for free. DocMeta would lose them on every move | WP1 |
| B | How does Markdown keep them? | Extend the existing marker with fixed English keys: `<!-- block: Einstieg \| purpose: Leser abholen \| words: 80 -->`. A marker is still only written when needed (Phase 5 decision B) | WP1 |
| C | Template guide notes → block purposes? | **Yes**: a new document from a template gets each guide hint as its block's purpose. The guide card then only lists `general` notes. The writer edits purposes freely afterwards | WP1 |
| D | Budget defaults from templates? | Only where the genre sets one (LinkedIn hook, video intro, newsletter teaser). Numbers shown to the writer before commit, like template texts | WP2 |
| E | Which model analyses? | **A separate "analysis model" setting**, defaulting to the WP3 winner; the suggestion model stays e2b. Changing it swaps models in llama-swap, so say so next to the setting | WP4 |
| F | Bench texts: the 20 templates only, or also 3–5 real texts of the writer? | **Both.** Templates give exact gold blocks; real texts show whether it works beyond the clean cases. Real texts stay local in a git-ignored folder | WP3 |
| G | Outline analyzer on a document that already has blocks? | Offer it **only** when the document has one block or only unnamed blocks derived from headings (rule A). Otherwise "Find blocks" asks first, since it replaces the writer's blocks | WP5 |
| H | Left column (table of contents): drop block names and dragging there now? | The 2026-10-04 guideline says the strict split (right = deep structure, left = surface) comes with this analysis. **Ask after WP6**, once the writer has used the analysis | WP7 |

## Key files

| File | Role |
| --- | --- |
| `apps/web/src/editor/section.ts` | the `section` node, its attributes and commands. `purpose` and `words` go here |
| `apps/web/src/editor/sectionView.ts` | node view (name label above the block) |
| `apps/web/src/editor/markdown.ts` | `<!-- block: … -->` markers, `needsBlockMarkers` |
| `apps/web/src/stores/blocksStore.ts` | `BlockInfo` per block (name, words, sentence rhythm) |
| `apps/web/src/components/BlockOutline.svelte` | outline rows in the structure card. Purposes, budgets and findings show here |
| `apps/web/src/components/StructureGuide.svelte` | the structure card ("Aufbau") |
| `apps/web/src/editor/templates/{de,en,types}.ts` | template texts and `guide` notes (`GuideNote.section` ↔ block name) |
| `apps/server/src/routes/aiLikeness.ts` | the pattern for a whole-text analysis route |
| `apps/server/src/providers/openaiCompatible.ts` | `streamCompletion`, the one upstream path, with load/idle timeouts |
| `apps/server/src/providers/prompt.ts` | prompts and JSON schemas |
| `packages/shared/src/index.ts` | request/response types and limits. **One file, erasable syntax only** |
| `apps/web/scripts/bench-*.run.ts` | real-model benches (`vitest.bench.config.ts`) |

## Ground rules

The rules from `phase-4-v1.4.md` and `phase-5-v1.5.md` still apply: runes
only in new components, `npx svelte-check --threshold warning` after every
Svelte change, `npm test` + `npm run build` before every commit, headless
browser checks against `vite preview` on a spare port (never the writer's
:3000 / :5173), template texts and numbers shown to the writer before commit,
one commit per work package, every block operation is one transaction.

In addition:

1. **The analysis never changes text.** Applying a proposal may only
   change section boundaries and attributes or the block order. A test
   compares `textContent` before and after for every apply path.
2. **The model's answer is untrusted.** Validate the structure (indices in
   range, contiguous, complete, in order) before showing anything. A broken
   answer becomes an error message, never a half-applied proposal.
3. **Findings go stale.** A finding belongs to the text it was computed on.
   When a block's text changes after the analysis, its finding is greyed out
   with "changed since the check", and never silently kept or dropped.
4. **Bench before UI** (WP3). Pass rules are written into the bench before
   the first run and not loosened afterwards. The `textUnits` held-out rule
   applies here too: never tune prompts on the cases that decide.
5. **Bench via llama-swap on :8080** only when the writer says the GPU is free;
   a 12b/27b run evicts whatever Hermes has loaded.

## Work package order and dependencies

```
WP0 Roadmap + stories                       (docs only)
WP1 Purpose note per block ──┬─> WP2 Word budget per block
                             └─> WP3 Bench: segmentation + red thread (measure only)
                                   └─> WP4 Analysis route + analysis model setting
                                         ├─> WP5 Outline analyzer ("Find blocks")
                                         └─> WP6 Red thread + block check
WP7 Left column: surface only                (writer's decision H, after WP6)
```

WP1 and WP2 work without any model. If WP3 finds no model that passes, the
phase ends after WP3 with WP1/WP2 shipped and the result written down.

---

## WP0 — Roadmap and stories

Docs only, one commit.

1. `docs/next-iteration-features.md`: new **Phase 6 — Analysing the structure**
   with #26 *Purpose per block*, #27 *Word budget per block*, #28 *Outline
   analyzer*, #29 *Red thread and block check*. The old Phase 6 (#23, #17,
   #24) becomes a **Backlog** section, unchanged in content. Mark Phase 5
   shipped, with the WP7 result in one line. Add the "differs from the
   dropped coach" paragraph to the intro filter.
2. `docs/user-stories.md`: Epic 7 gets 7.4 *Say what a part is for*, 7.5 *Know
   how long a part may be*, 7.6 *Get blocks for a text I bring in*, 7.7 *Does my
   text hold together?* Update the Phase 6 references (6.3) to Backlog.

---

## WP1 — Purpose note per block

**Goal:** every block can carry one sentence saying what it must achieve
("Leser abholen: Problem in einem Satz"). It is the yardstick the WP6
analysis measures against, and the generalisation of the template guide
notes.

### Design

- `section` gets a `purpose` attribute (string, default empty, rendered as
  `data-purpose`). Split copies nothing (like the name), and merge keeps the
  first block's purpose.
- Markdown per decision B. `needsBlockMarkers` also returns true when any
  block has a purpose. Parse old markers without keys unchanged.
- Outline row (`BlockOutline.svelte`): the purpose shows under the name in
  the place of today's guide hint, and is editable inline (same interaction
  as renaming). Empty purpose → a faint "What is this part for?" on hover
  only, so the outline is not cluttered.
- Templates per decision C: `createDocument` from a template fills
  `purpose` from the matching guide note. The guide card keeps only `general`
  notes and notes without a matching block. `templates.test.ts`: every
  non-general note lands as exactly one purpose.
- Own templates (Phase 4 WP6) now keep purposes automatically, because they are
  in the document. This closes the "no structure hints for own templates" gap.
- `plainTemplateContent` keeps `purpose`.
- `blocksStore` adds `purpose` to `BlockInfo`.

### Tests

Markdown round-trip with purpose (with `|` and `-->` in the text, escaped),
old markers still parse, `textContent` unchanged by template creation,
undo removes a purpose edit in one step.

---

## WP2 — Word budget per block

**Goal:** a target length per block, visible while writing. No model.

### Design

- `section` attribute `words` (integer or null). Markdown key `words`.
- Outline row: `42 / 80` next to the word count, with a thin bar under the row. Over
  budget by >10 % → the number turns amber (badge style, not amber text on
  white). The bar never blocks typing and shows no warnings in the text itself.
- Set/clear via the row (small number field on click) and in the same inline
  editor as the purpose.
- Template defaults per decision D, shown to the writer before commit.
- Sum line under the outline: `total 640 / 700`, only when at least one block
  has a budget.

### Tests

Round-trip, over-budget threshold, the sum ignores blocks without a budget.

---

## WP3 — Bench: segmentation and red thread (measurement only)

**Goal:** know which local model, if any, can do WP5 and WP6, and how slowly.
Same method as the Phase 4 grammar bench: fixed cases, pass rules written
first, report as Markdown. No UI.

### Gold data

- **Segmentation:** the 20 templates (DE+EN) have exact gold blocks with
  names. Flatten each to paragraphs (top-level children of all sections),
  number them, and ask for blocks. Plus the writer's real texts (decision F),
  segmented by the writer once, in a git-ignored `scripts/structure-bench/real/`.
- **Red thread:** derived from the templates by known perturbations, each with an
  expected finding:
  - *swap*: two non-adjacent blocks swapped → "order" at those blocks
  - *intruder*: a block from an unrelated template inserted → "off-topic"
    at that block
  - *missing*: a block with a purpose removed, purposes still listed →
    "missing part"
  - *hollow*: a block's text replaced by on-topic filler that does not do its
    purpose → "does not do its job" at that block
  - *clean*: the unchanged template → **no** finding (false-alarm rate)
- Split the cases into a **tuning** half and a **held-out** half before the
  first run. Prompt changes may only look at tuning results.

### Measures and pass rules (fixed before the first run)

| Task | Measure | Pass |
| --- | --- | --- |
| Segmentation | boundary F1, a boundary off by one paragraph counts as half | ≥ 0.70 on held-out, both languages |
| Segmentation | names: share a person would accept (read, not regex) | ≥ 70 % |
| Red thread | perturbation found at the right block | ≥ 70 % per kind except *hollow* (reported, no bar) |
| Red thread | false alarms on *clean* | ≤ 20 % of clean texts with any finding |
| Both | latency for a 1 500-word text, warm model | reported. Above 60 s needs the writer's OK |

Fixed before the first run (2026-10-04), in addition to the table:

- Segmentation runs on every text twice, **with headings and with headings
  removed**. 22 template blocks start with an H2, which makes the first
  variant easy. The pass needs **both** variants.
- The red-thread check runs **with the template's planned parts and without**
  (in the product only template documents have a plan). *missing* is only
  scored with a plan. An intruder is pasted unnamed and without a purpose,
  and *hollow* replaces the middle block's text with a fixed on-topic filler.
- The pass counts the **strict** score: *swap* = a move proposed for a
  swapped block, *intruder*/*hollow* = verdict "off" at that block, *missing*
  = the removed part named, *clean* = no finding at all. Loose scores
  ("weak" counts, or any verdict at the block) are reported, not used to pass.
- Temperature 0.3, as for AI likeness.

Models: gemma4-e2b-qat, gemma4-12b-qat, qwen38-27b (as configured in
llama-swap). Thinking off unless a model only passes with it, then report both.
Schema-constrained JSON (`response_format`) as in the existing routes.

### Output

`bench-structure` writes the report, and the result goes into this plan under WP3,
like Phase 5 WP7. **Stop and show the writer the result** before WP4. They
choose the analysis model (decision E) or end the AI part here.

---

## WP4 — Analysis route and analysis model

**Goal:** the plumbing both AI features share.

- `@glossly/shared`: `StructureRequestBody` (`task: 'segment' | 'check'`,
  units or blocks, language), response types, limits (max units, max chars,
  the same 24 000 as ai-likeness unless WP3 says otherwise).
- Server: `POST /api/structure`, modelled on `aiLikeness.ts`. It uses
  `streamCompletion`, so cold start, swap and busy status work as for suggestions.
  Validation of the answer (ground rule 2) happens **on the server**, and the client
  re-checks against its own document.
- Settings: `analysisModel` (decision E), default from WP3; shown in Settings
  next to the suggestion model, with one line explaining it swaps models.
- Client helper `structureClient.ts` with abort on document switch.
- Timeout: the load timeout as today. The idle timeout covers the whole
  generation, since the JSON only parses at the end; a progress line shows
  "analysing… 14 s".

---

## WP5 — Outline analyzer ("Find blocks")

**Goal:** a text brought in from outside (Markdown import, paste, an old
document) gets blocks with names and purposes proposed in one click.

### Design

- Trigger: a "Find blocks" button in the structure card, shown per decision
  G. After a Markdown import that yields one block, the card shows it as a
  one-line hint ("This text has no blocks yet — find them?"). Nothing runs on its own.
- Units: the top-level children of all sections (paragraph, heading, list,
  quote, …), numbered, sent with their text (lists/quotes as plain text).
  Long texts: units are cut to their first 300 characters for the request.
  The boundaries only need the gist.
- Answer: `[{ start, end, name, purpose }]` over unit indices. Must cover all
  units, contiguous, in order (ground rule 2). A heading must not end a block
  (the server merges it into the next block rather than rejecting).
- **Preview before apply:** the outline shows the proposed blocks (dashed rows,
  names, purposes, word counts), and the text shows thin proposed boundary
  lines. Buttons: *Apply* / *Discard*. Names and purposes are editable in the
  preview.
- Apply = one transaction that regroups the units into new sections with
  `name` and `purpose` (a new `regroupByRanges` in `section.ts`, next to
  `regroupSections`, which only knows rule A).
  `textContent` unchanged (test), one Ctrl+Z restores the old blocks.
- Language of names and purposes = language of the text (`detectLanguage`).

---

## WP6 — Red thread and block check

**Goal:** "Does my text hold together, and does each part do its job?"
Against the writer's purposes, on a click, findings in the structure card.

### Design

- Trigger: "Check structure" in the structure card. Needs ≥ 2 blocks. Blocks
  without a purpose are checked for the red thread only.
- Request: blocks in order with name, purpose, budget and full text (up to
  the limit; longer blocks cut in the middle with a "[…]" marker).
- Answer (schema):
  - `thread`: one line per block — what it actually says (the gist). The writer
    reads the red thread as a list, which is the most useful output even when nothing
    is wrong.
  - `blocks[i].verdict`: `ok | weak | off` + one-sentence reason, judged
    against the purpose.
  - `order`: optional move proposals `{ block, before }` with a reason.
  - `missing`: optional purposes or parts the text announces but never
    delivers (note only, nothing to apply).
- Display: the gist line under each outline row (toggle "show red thread"),
  verdict as a small badge on the row and the reason on hover/focus. An order
  proposal is a button "Move before *Fazit*" that runs `moveSection` (one
  transaction). Findings follow ground rule 3 (stale when the block changes).
- Budgets are checked on the client (WP2), never by the model.
- No "rewrite this block" button. That would cross the coach line.

---

## WP7 — Left column: surface only (decision H)

Only if the writer decides for it after using WP6: the table of contents
shows headings only (no block names, no block dragging), and the right
column alone holds the deep structure. If not, write down the decision and
close the WP.

---

## Later — not part of this phase

- **Collapse** a block to see the skeleton of a long text
- **Nested** blocks (chapter → scene)
- Block reuse across documents
- Structure check while writing (off by default, only if WP6 is fast and quiet)
- A per-block suggestion hint from the purpose. WP7 of Phase 5 says not for e2b
  phrase suggestions, but a larger model might use it
