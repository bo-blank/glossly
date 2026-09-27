# Glossly — Roadmap

Glossly's strength is that it does *little*: a quiet editor in the margin. Every
feature below had to pass one filter — does it make the phrase-suggestion loop
faster, more trustworthy, or less disruptive to writing flow? Everything that
needed its own intelligence layer, interrupted the writer, or amounted to a
research project was cut (see the last section for what was dropped and why).

All features run entirely on-device; nothing leaves the machine.

---

## Phase 1 (v1.1) — Core UX ✅ shipped

The suggestion loop itself. Streaming comes first: with a local model, waiting
up to 10 seconds behind a spinner is the single biggest UX problem in the app.

### 1. Streaming suggestions ✅

Alternatives stream over SSE so the first option appears in the margin note
within ~1 second instead of after the full response. The JSON array is parsed
incrementally (a hand-rolled scanner, not repeated `JSON.parse`); each
suggestion renders as it completes, with the loading spinner moving below the
suggestions already shown.

### 2. Response caching ✅

Responses are cached (session-lifetime LRU, capacity 100) keyed on selection +
context + modifier + mode + model + endpoint, so re-selecting the same phrase
or flipping between modifier chips doesn't re-hit the model. Context is part
of the key, so an edit inside the selection's surrounding text misses the
cache naturally — no separate invalidation logic. "New suggestions" always
bypasses the cache, since fresh output is its purpose.

### 3. Custom modifier chips ✅

Writers can define their own chips (label + instruction), stored locally next
to the built-in Tighter / More vivid / Plainer. A custom chip can never
override a built-in modifier's instruction under the same id.

### 4. Keyboard-only flow ✅

Alt+1–3 applies a suggestion, Alt+N requests fresh ones, Escape dismisses —
the full loop without touching the mouse. Unmodified digits/letters are never
intercepted, so typing prose while the note is open behaves normally.

### 5. Dark mode ✅

A persisted light/dark toggle in the header, following the OS preference by
default via daisyUI's `light`/`dark` themes.

### 6. Full-sentence rewrite mode (opt-in) ✅

A "Rewrite sentence" chip expands the selection to its enclosing sentence(s)
and requests full-sentence rewrites (up to 600 characters, restructuring
allowed) instead of phrase-level alternatives. An oversized 221–600 character
selection — previously just an error — now also offers this path directly.

### Starter templates ✅

Added alongside the six above rather than planned up front. A toolbar menu
starts a draft from a LinkedIn post, blog article, newsletter issue, cover
letter or blank page. Replacing a non-empty draft asks first and stays
undoable, and the default document introduces Glossly instead of Tiptap's demo
text.

---

## Phase 2 (v1.2) — Documents you can trust ✅ shipped

Turns the prototype into a tool a writer can keep a manuscript in. Before this
phase a single document lived in localStorage, which silently caps out around
5 MB.

### 7. Multiple documents ✅

A local document list in the header (create from a starter template, rename,
delete, switch). Titles follow the first heading until the writer names a
document. Switching saves the outgoing document first and starts a fresh undo
history, so Ctrl+Z never crosses from one manuscript into another.

### 8. Save to real files ✅

Open and save Markdown files via the File System Access API (Chromium), so
manuscripts live in the writer's own folders. Ctrl+S writes the file; once the
writer has granted write access, autosave writes it too. IndexedDB stays the
crash-recovery layer. A file changed outside Glossly is never overwritten
silently: the writer chooses which version to keep. Other browsers keep the
Markdown download and import.

### 9. Markdown import/export ✅

Round-trip between the Tiptap document and Markdown for headings, lists, task
lists, blockquotes, code, images and links. Import creates a new document, and
export embeds images. Highlights, colours, alignment and sub/superscript have
no Markdown form and export as plain text; the UI says so.

### 10. IndexedDB persistence ✅

Autosave moved from localStorage to IndexedDB: no 5 MB cliff, images stored as
blobs instead of base64 strings, with a verified one-time migration. The quota
warning from Phase 0 stays as the last line of defense, and without IndexedDB
the old localStorage path still works.

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
