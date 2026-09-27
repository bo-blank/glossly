# Phase 3 (v1.3) — Implementation Plan

Self-contained plan for the Phase 3 features in
`docs/next-iteration-features.md` (#11–#15), split into four work packages
plus one deliberate non-package. Written for an implementing agent with no
prior context on this repository. Read this whole document before starting.

`docs/plans/phase-1-v1.1.md` covers the repository layout, the server/proxy
architecture, and the suggestion pipeline in depth. Phase 2
(`docs/plans/phase-2-v1.2.md`) was about storage and is not touched here.

## What Phase 3 is actually for

The roadmap's premise for this phase: **better input to the model beats a
smarter pipeline around it.** Glossly's default model is `gemma4-e2b-qat`, a
2.6B model on llama-swap (`http://127.0.0.1:8080/v1`). Small models lean on
context far more than large ones — and today they get very little of it.
`extractContext` (`apps/web/src/components/Editor.svelte:197`) sends the
selection's block plus one block on either side, cut at
`CONTEXT_CHAR_BUDGET = 2000` characters (`:24`) with a blind `.slice()` that
can end mid-word. The model never learns the document's title, the section it
is in, or where in the context the selection sits.

So WP1 (context) is the core of this phase. WP2–WP4 are margin-note
improvements that make the loop around the suggestions faster to judge and
easier to steer.

## Key files

| File | Role |
| --- | --- |
| `apps/web/src/components/Editor.svelte` | `extractContext`, `handleSelectionUpdate` — builds the request input |
| `apps/web/src/note/requestSuggestions.ts` | debounce, dedupe, cache, `seenSuggestions`, calls the client |
| `apps/web/src/note/suggestionCache.ts` | session LRU keyed on selection + context + modifier + mode + model + endpoint |
| `apps/web/src/providers/client.ts` | `fetchSuggestions` / `fetchSuggestionsStream` — request body |
| `apps/web/src/components/MarginNote.svelte` | suggestion list, chips, Alt+1–3 / Alt+N / Esc |
| `apps/web/src/components/SettingsPanel.svelte` | provider settings + custom chips |
| `apps/web/src/stores/settingsStore.ts` | persisted settings (localStorage) |
| `apps/server/src/routes/suggest.ts` | request validation |
| `apps/server/src/providers/prompt.ts` | system prompts, `buildMessages`, modifier instructions |
| `apps/server/src/providers/openaiCompatible.ts` | upstream call: `temperature: 0.8`, `NO_THINKING`, `MAX_TOKENS_SUGGESTIONS` |

## Ground rules

1. **Local-only is a hard guarantee.** No new network calls, no telemetry, no
   CDN assets. Suggestion history (WP3) lives in memory only — it is never
   persisted, not even to IndexedDB. A writer's rejected phrasings are not
   something to leave on disk.
2. **No new dependencies.** The word diff in WP2 is ~40 lines of LCS; do not
   add `diff` or `jsdiff`.
3. **Never re-add `enable_thinking` or `reasoning_effort`.** The comment above
   `NO_THINKING` in `openaiCompatible.ts` explains why (measured 7/20 empty
   answers with the official Gemma-4 template). Every new request parameter in
   this phase is added *next to* `...NO_THINKING`, never instead of it.
4. **The server validates everything the client sends.** Every new field in
   the request body gets a type and range check in `routes/suggest.ts`, like
   `modifierInstruction` has today. The proxy is reachable by anything on
   localhost.
5. **Style:** match surrounding code. Comments only where the code can't speak
   for itself. TypeScript in `.ts`; Svelte 5 runes in components.
6. **Verify before every commit:** `npm test` and `npm run build` from the
   root, plus `npx tsc --noEmit` in `apps/server` whenever you touched it.
7. **One commit per work package**, in order. Do not batch.
8. **Browser checks run headless** (playwright-core against
   `/usr/bin/google-chrome` + `vite preview` on a spare port). Do not touch
   the writer's own dev servers on :3000 / :5173.

## Work package order and dependencies

```
WP1 Richer context ──> WP4 Per-modifier tuning   (both change the request shape
                                                  and the cache key — context first)
WP2 Comparison view ──> WP3 Suggestion history   (history rows reuse the diff rendering)
```

The two chains are independent; do them in the order WP1, WP2, WP3, WP4.
Desktop packaging (#15) is not a work package — see the end of this document.

---

## WP1 — Richer context extraction (#11)

**Goal:** the model sees the document title, the section the selection sits
in, and as much of the surrounding text as fits a fixed budget — nearest text
first — with the selection's position marked.

### Shape of the context

Replace the flat `context` string with a structured object, built on the
client and turned into prompt text on the server:

```ts
interface SuggestionContext {
  title: string;          // document title (documentStore active meta), may be ''
  headingPath: string[];  // enclosing headings, outermost first: ['Kapitel 2', 'Der Bahnhof']
  before: string;         // text before the selection, nearest last
  after: string;          // text after the selection, nearest first
}
```

`before` and `after` are cut at the selection itself, so the selection is no
longer duplicated inside the context. The server renders it as one passage
with the selection marked in place, e.g.

```
Document: Mein Roman
Section: Kapitel 2 › Der Bahnhof

Context (the selection is marked ⟦like this⟧):
…Der Zug hielt. ⟦Sie stieg langsam aus⟧ und sah sich um…
```

Marking the position fixes a real ambiguity: a phrase that occurs twice in the
context currently gives the model no way to know which one is meant.

### Steps

1. New pure module `apps/web/src/note/contextExtraction.ts` exporting
   `extractContext(doc, from, to, title, budget)` over a ProseMirror `Node`.
   Move the logic out of `Editor.svelte`; the component only passes the
   active document title in (`$documentStore`, active id → `title`).
2. **Budget allocation:** a total character budget (start at 4000, see step
   6). The selection's own block is always included in full up to 60% of the
   budget; beyond that, trim it symmetrically around the selection. The rest
   is filled by alternately adding the next block before and after — nearest
   first — until the next block no longer fits. Trim at word boundaries,
   never mid-word, and never split a block in the middle except the
   selection's own.
3. **Heading path:** walk the top-level blocks before the selection and keep a
   stack by heading level (a level-2 heading pops everything ≥2). Headings in
   the path are not repeated in `before`.
4. **Request shape:** `client.ts` sends `context` as the object.
   `routes/suggest.ts` accepts **either** a string (old clients, the
   AI-likeness path) **or** the object, validating each field as a string and
   capping the total at 8000 characters (reject with 400 beyond that — the
   express JSON limit is the default 100 kB, which is not a meaningful cap).
   `headingPath` max 6 entries.
5. **Prompt order for prefix caching.** llama-server reuses the KV cache for
   the longest common prompt prefix. Order the user message from most stable
   to least stable: document title → section → context → selection →
   instruction → previously suggested. The system prompt stays first and
   unchanged. Update both system prompts to mention the ⟦ ⟧ marker in one
   sentence.
6. **Measure before fixing the budget.** Write a small bench script
   (`apps/server/scripts/bench-context.ts`, run with `npx tsx`, not part of
   the build): 8 fixed samples (4 German, 4 English — narrative, business
   email, blog, a list-heavy document), each at budgets 2000 / 4000 / 8000,
   against `gemma4-e2b-qat`. Record wall-clock time to first suggestion and to
   done, and dump all outputs side by side to a Markdown file for the writer
   to judge. There is no automatic quality metric — the roadmap's rule is
   that a metric needs a measurement method first, and reading the outputs
   *is* the method here. Pick the budget from the results and note the
   numbers in the commit message. The default request timeout is 10 s
   (`settingsStore`); the chosen budget must keep p95 well under it.
7. **Cache key:** `suggestionCache.cacheKey` must include the whole context
   object (serialize it deterministically). A larger context means more cache
   misses after nearby edits — that is correct, not a bug.

### Tests

- web `contextExtraction.test.ts`: nearest-first filling alternates
  before/after; a block that does not fit is skipped whole; the selection's
  own oversized block is trimmed around the selection at word boundaries;
  heading path across levels (h1 › h2, a later h2 replacing the earlier one,
  an h3 without an h2); selection inside a list item and a blockquote; empty
  document title.
- server `prompt.test.ts`: the object renders with the marker in the right
  place; a string context still works; field order matches step 5.
- server route: context over 8000 characters → 400; wrong field types → 400.

### Acceptance criteria

- Select a phrase in chapter 2 of a long document: the request (visible in the
  llama-swap log) carries the title, `Kapitel 2 › …`, and text from both
  sides, with the ⟦ ⟧ marker around the selection.
- A phrase that occurs twice in the visible context gets suggestions fitting
  the marked occurrence.
- Bench numbers are in the commit message; time to first suggestion at the
  chosen budget is within 1.5× of today's.

### Pitfalls

- `doc.forEach` only visits top-level blocks. A selection inside a list item
  or blockquote belongs to its top-level ancestor — resolve positions with
  `doc.resolve(from)` and use `$from.node(1)`, not a hand-rolled offset
  comparison (the current `from >= offset && from <= offset + node.nodeSize`
  matches two blocks when `from` sits exactly between them).
- `textContent` of a list or table concatenates items without separators.
  Use `textBetween(start, end, '\n')` so items stay apart.
- Readability highlighting adds marks, not text — it does not affect
  extraction. Do not strip it.
- Do not put the `SuggestionContext` type in two places: define it in the
  server's `providers/types.ts` and mirror it by hand in `client.ts`, like
  the rest of the request already is (there is no shared package).

---

## WP2 — Comparison view (#14)

**Goal:** see at a glance what each suggestion changes, before swapping it in.

### Design

Word-level diff between the selection and each suggestion. In the margin
note, each suggestion shows **inserted or changed words highlighted**; a
one-line original above the list shows the **removed words struck through**
for the suggestion under the mouse or keyboard focus. Nothing new to click:
the diff is always on, and subtle enough not to shout. Sentence-mode
rewrites are where this pays off most — a 40-word rewrite with three changed
words is otherwise hard to read.

### Steps

1. New pure `apps/web/src/note/wordDiff.ts`: tokenize into words and
   whitespace/punctuation runs (keep them, so joining the tokens reproduces
   the input exactly), LCS over word tokens compared case-sensitively, return
   `{ text, kind: 'same' | 'added' | 'removed' }[]` for both sides. Selections
   are ≤600 characters, so O(n·m) LCS is fine — no Myers needed.
2. `MarginNote.svelte`: render suggestions from diff segments, `added` as a
   highlighted `<mark>` styled in both themes (daisyUI tokens, check dark
   mode). Track a hovered/focused index; render the original line from that
   index's `removed` segments.
3. Streaming: suggestions arrive one by one (`onSuggestion`). Diff each as it
   lands; never re-diff the whole list per token.
4. `applySuggestion` is unchanged — it inserts the plain suggestion string,
   never the rendered markup.

### Tests

`wordDiff.test.ts`: identical input → all `same`; pure insertion; pure
deletion; a substitution in the middle; punctuation attached to a word
(`Haus,` vs `Haus.`); German umlauts and ß; joining each side's segments
reproduces the original strings exactly.

### Acceptance criteria

- Tighter on "in the event that it rains" shows the new words highlighted and
  the dropped ones struck in the original line.
- A sentence rewrite that reorders clauses is still readable (heavy change is
  allowed to look heavy — do not try to detect moves).
- Alt+1–3 still applies the right suggestion; screen readers read the plain
  suggestion text (put the highlighting in `aria-hidden` spans with a plain
  text sibling, or rely on `<mark>` semantics — check with the accessibility
  tree in the headless run).

---

## WP3 — Suggestion history per session (#12)

**Goal:** earlier alternatives for a phrase stay reachable for the whole
session, and coming back to a phrase does not start from zero.

### Design

Today `seenSuggestions` (`requestSuggestions.ts:58`) is reset on every
selection change, so leaving a phrase and coming back loses everything. The
cache only helps if the context is byte-identical, which WP1 makes rarer.

A history keyed on the **selected text** (trimmed, exact) holds every
suggestion shown for it this session, across modifiers and modes, newest
first, capped at 30 per phrase and 200 phrases (drop least recently used).
It lives in module memory — gone on reload, by design (ground rule 1).

### Steps

1. New `apps/web/src/note/suggestionHistory.ts`: `record(text, suggestions,
   modifierLabel)`, `forPhrase(text)`, `clear()`. Pure module state with an
   LRU like `suggestionCache.ts`.
2. `requestSuggestions.ts`: record every completed result (and cache hits).
   When a selection changes, seed `seenSuggestions` from the history for that
   phrase instead of `[]`, so "New suggestions" avoids everything the writer
   already saw — including in an earlier visit.
3. `MarginNote.svelte`: under the current suggestions, a collapsed
   "Earlier (n)" row when history has entries not in the current list.
   Expanded, it lists them with their modifier label and the WP2 diff. Click
   applies, like a normal suggestion. Keyboard: the Alt+1–3 shortcuts keep
   addressing only the current three — do not renumber.
4. Switching documents clears nothing (phrases are text-keyed and harmless
   across documents); a reload clears everything.

### Tests

`suggestionHistory.test.ts`: dedupe across rounds; newest-first order;
per-phrase and total caps with LRU eviction; `forPhrase` on an unknown
phrase is empty. `requestSuggestions` seeding is tested through the module
with the client mocked (`vi.mock('../providers/client')`).

### Acceptance criteria

- Select a phrase, try Tighter and More vivid, select something else, come
  back: "Earlier (6)" shows all six, and applying one works.
- "New suggestions" after coming back does not repeat any of them (check the
  `previousSuggestions` in the request body).
- Reload: history is gone.

---

## WP4 — Per-modifier tuning (#13)

**Goal:** writers who care can make Plainer conservative and More vivid
adventurous — temperature and instruction per chip, built-ins included.

### Design

Settings gains, per chip id (the three built-ins and every custom chip):

```ts
interface ModifierTuning { temperature?: number; instruction?: string }
settings.modifierTuning: Record<string, ModifierTuning>
```

Unset means today's behaviour: temperature 0.8, the built-in instruction.
The "New suggestions" and "Rewrite sentence" actions are not tunable — they
are actions, not styles.

### Steps

1. Request body gains `temperature` (number, 0–1.5, server-validated) and
   `instructionOverride` (string ≤300). **Keep the existing rule** in
   `prompt.ts:40` that a custom chip's `modifierInstruction` can never
   override a built-in id — that protects against a custom chip named
   `tighter`. An *explicit* `instructionOverride` is the only way to change a
   built-in's wording.
2. `openaiCompatible.ts`: `temperature: input.temperature ?? 0.8` in both the
   streaming and non-streaming call, next to `...NO_THINKING` (ground rule 3).
3. Settings UI: a "Tune chips" section listing each chip with a temperature
   slider (0–1.5, step 0.1, labelled "steady ↔ adventurous") and an
   instruction textarea prefilled with the current effective instruction.
   The built-in defaults live only in `prompt.ts`, and there is no shared
   package to import them from — do not copy them into the client, where
   they would drift. Add `GET /api/modifiers` returning the defaults and load
   it once when the section opens. A "Reset" per chip clears its tuning.
4. Cache key includes the effective temperature and instruction.
5. Deleting a custom chip deletes its tuning entry.

### Tests

- server: `temperature` out of range / wrong type → 400; override applied for
  a built-in only when `instructionOverride` is set; a custom chip named
  `tighter` still cannot override; `NO_THINKING` present in the upstream body
  (assert on the mocked `fetch` payload).
- web: cache key changes with temperature and instruction.

### Acceptance criteria

- Plainer at 0.2 gives near-identical suggestions across "New suggestions"
  rounds; More vivid at 1.3 visibly varies.
- An edited built-in instruction reaches the model (llama-swap log) and Reset
  restores the default.
- Twenty requests in a row at each end of the temperature range: no empty
  answers (the `noAnswerMessage` path never fires).

---

## Not a work package: Desktop packaging (#15)

The roadmap marks Tauri as optional and "only worth it once Phase 2 lands".
Phase 2 has landed, and it changed the calculation:

- On Linux, Tauri renders with **WebKitGTK**, not Chromium. WebKit has no File
  System Access API, so WP5 of Phase 2 (real files) would silently degrade to
  download/import — the worst outcome for the feature a desktop app is
  supposed to improve.
- Doing it properly means a second file backend over Tauri's fs/dialog
  plugins behind the same interface as `storage/fileStore.ts`, plus bundling
  the Express proxy as a sidecar binary.

That is a phase of its own, not a work package. Decide after Phase 3 whether
"no browser tab" is worth a second storage backend; if yes, it gets its own
plan. Do not start it inside Phase 3.

---

## Final verification checklist

- [ ] `npm test` — all workspaces green, including the new context, diff and
      history tests
- [ ] `npm run build` and `npx tsc --noEmit` in `apps/server`
- [ ] Context bench run, numbers in the WP1 commit, outputs file reviewed by
      the writer before the budget is fixed
- [ ] Request bodies inspected in the llama-swap log: title, section, marker,
      `thinking_budget_tokens: 0`, no `enable_thinking`
- [ ] Margin note in light and dark mode: diff highlighting readable,
      "Earlier" list usable by keyboard and mouse
- [ ] Reload clears suggestion history; nothing new in IndexedDB or
      localStorage except `modifierTuning` inside `glossly-settings`
- [ ] `README.md` feature list and `docs/next-iteration-features.md` Phase 3
      section updated to shipped (#15 stays open with the note above)
- [ ] Four commits, one per work package, messages explaining the why
