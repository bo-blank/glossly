# Glossly — Roadmap

Glossly's strength is that it does *little*: a quiet editor in the margin. Every
feature below had to pass one filter — does it make the phrase-suggestion loop
faster, more trustworthy, or less disruptive to writing flow? Everything that
needed its own intelligence layer, interrupted the writer, or amounted to a
research project was cut (see the last section for what was dropped and why).

All features run entirely on-device; nothing leaves the machine.

---

## Phase 1 (v1.1) — Core UX

The suggestion loop itself. Streaming comes first: with a local model, waiting
up to 10 seconds behind a spinner is the single biggest UX problem in the app.

### 1. Streaming suggestions

Stream alternatives over SSE so the first option appears in the margin note
within ~1 second instead of after the full response. Parse the JSON array
incrementally; render each suggestion as it completes.

### 2. Response caching

Cache responses keyed on selection + context + modifier for the session, so
re-selecting the same phrase or flipping between modifier chips doesn't re-hit
the model. Invalidate on document edit inside the cached range.

### 3. Custom modifier chips

Let writers define their own chips (name + instruction template), stored
locally next to the built-in Tighter / More vivid / Plainer. Small feature,
large personalization payoff.

### 4. Keyboard-only flow

Accept suggestion 1–3 with number keys, cycle modifiers, dismiss with Escape
(already works) — the full loop without touching the mouse.

### 5. Dark mode

daisyUI theme toggle; currently hardcoded to `data-theme="light"`.

### 6. Full-sentence rewrite mode (opt-in)

Extend the 220-character selection ceiling to a full sentence when explicitly
requested, with the same margin-note interaction.

---

## Phase 2 (v1.2) — Documents you can trust

Turns the prototype into a tool a writer can keep a manuscript in. Today a
single document lives in localStorage, which silently caps out around 5 MB.

### 7. Multiple documents

A simple local document list (create, rename, delete, switch).

### 8. Save to real files

Open/save Markdown files via the File System Access API so manuscripts live in
the writer's own folders, not browser storage. Browser storage becomes the
autosave/crash-recovery layer, not the source of truth.

### 9. Markdown import/export

Lossless round-trip between the Tiptap document and Markdown (headings, lists,
blockquotes, code, images, links).

### 10. IndexedDB persistence

Replace localStorage with IndexedDB for autosave: no 5 MB cliff, images stored
as blobs instead of base64 strings, explicit quota-error surfacing (the warning
shipped in Phase 0 stays as the last line of defense).

---

## Phase 3 (v1.3) — Suggestion quality

Better input to the model beats a smarter pipeline around it.

### 11. Richer context extraction

Send the document title / nearest heading plus neighboring paragraphs instead
of only the ±1 adjacent blocks, within a fixed token budget.

### 12. Suggestion history per session

Keep the per-selection suggestion history (started in Phase 0 for "New
suggestions") across the whole session: revisit earlier alternatives, avoid
duplicate requests.

### 13. Per-modifier tuning

Expose temperature and prompt template per modifier chip in Settings, for
writers who want Plainer to be conservative and More vivid to be adventurous.

### 14. Comparison view

Original and suggestions side by side with word-level diff highlighting before
committing a swap.

### 15. Desktop packaging (optional)

Tauri wrapper bundling web app + proxy into one binary — same local-first
architecture, no browser tab. Only worth it once Phase 2 lands.

---

## Dropped, and why

Listed explicitly so they don't creep back in unexamined.

- **Hallucination / bias detection** — research-grade open problems; a local
  model judging another local model's output adds latency and false confidence,
  not trust.
- **Writing coach, learning & adaptation engine, semantic enhancement engine,
  creative variation generator** — each is its own intelligence layer that
  replaces the writer's judgment; contradicts the "quiet copilot" premise.
- **Voice & style preservation scoring, rhythm analysis, explainable AI** —
  stylometry-as-a-feature promises precision a 12B local model can't deliver;
  the honest version is just good context (Phase 3, #11).
- **Multi-model orchestration** — one well-chosen model per machine is enough;
  llama-swap already handles switching outside the app.
- **Local model fine-tuning** — very high complexity, near-zero audience
  overlap with this app.
- **Batch processing, suggestion templates, import/export of suggestions,
  conflict resolution tools** — workflow machinery for a problem the margin
  note doesn't have; undo already covers reverting.
- **Browser extension / mobile** — platform spread before the core is done;
  Tauri (#15) is the one packaging step that pays for itself.
- **Success-metric targets** — the old list of unmeasured percentages is gone;
  if a metric matters it gets an actual measurement method first.

Already shipped, formerly on this list: smart selection snapping
(`wordBoundary.ts`), suggestion dedupe for "New suggestions", response
validation hardening.
