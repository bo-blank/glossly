# Phase 2 (v1.2) — Implementation Plan

Self-contained plan for the four Phase 2 features in
`docs/next-iteration-features.md` (#7–#10), split into five work packages.
Written for an implementing agent with no prior context on this repository.
Read this whole document before starting.

`docs/plans/phase-1-v1.1.md` covers the repository layout, the server/proxy
architecture, and the suggestion pipeline. This plan touches almost none of
that — Phase 2 is about **storage**, not about the model loop.

## What Phase 2 is actually for

Today the entire manuscript is one HTML string in
`localStorage['glossly-document']` (`apps/web/src/components/Editor.svelte`,
`DOC_STORAGE_KEY`). That has a hard ~5 MB ceiling per origin, and a single
embedded image gets there fast because images are stored as base64 data URLs
(`Editor.svelte:167`). The existing `autosaveFailed` banner
(`Editor.svelte:236`, `:663`) is the current answer: it tells the writer their
edits stopped saving. That warning is a last line of defense, not a fix.

Phase 2 replaces the storage layer, then builds the features that only make
sense on top of it. The order below is a dependency chain — do not reorder.

## Before you start

The working tree has a finished but uncommitted **starter templates** feature
(`apps/web/src/editor/templates.ts`, `templates.test.ts`, the toolbar menu and
rewritten default document in `Editor.svelte`, one README line). Tests and
build pass with it. Commit it first, and delete the stray root-level
`debug_local_model.js` — do not let it into a Phase 2 commit. Add a
"Starter templates" entry to Phase 1 in `docs/next-iteration-features.md`
while you are there, since it shipped alongside those six.

## Key files

| File | Role |
| --- | --- |
| `apps/web/src/components/Editor.svelte` | Tiptap setup, autosave, image insert, toolbar |
| `apps/web/src/components/App.svelte` | header (theme + settings buttons), layout |
| `apps/web/src/editor/templates.ts` | starter templates + `isDocumentDisposable` |
| `apps/web/src/stores/settingsStore.ts` | the existing localStorage-store pattern to imitate |
| `apps/web/src/stores/themeStore.ts` | smallest example of that pattern |
| `apps/web/src/utils/readability.ts` | pure text helpers (`splitSentences`) |

New code lives in a new `apps/web/src/storage/` directory.

## Ground rules

1. **Local-only is a hard guarantee.** No new network calls, no telemetry, no
   CDN assets. Everything in this phase is on-device by construction; keep it
   that way.
2. **New dependencies — exactly two, both in `apps/web`:**
   `fake-indexeddb` (devDependency, WP1 tests) and `prosemirror-markdown`
   (WP4). `prosemirror-model` is already installed. Do **not** add an
   IndexedDB wrapper library (`idb`, `dexie`) — the promise wrapper in WP1 is
   ~60 lines and this app uses three object stores.
3. **Losing a writer's manuscript is the only unacceptable bug in this phase.**
   Every migration is write-new → read-back-and-verify → delete-old, in that
   order. Never delete a source of truth you have not re-read.
4. **Degrade, don't break.** IndexedDB can be unavailable (private windows,
   disabled storage) and the File System Access API is Chromium-only. Both
   need a working fallback, feature-detected — never a button that throws.
5. **Style:** match surrounding code. Comments only where the code can't speak
   for itself. TypeScript in `.ts`; Svelte 5 runes in components.
6. **Verify before every commit:** `npm test` and `npm run build` from the
   root, plus `npx tsc --noEmit` in `apps/server` if you touched it (Phase 2
   should not).
7. **One commit per work package**, in order. Do not batch.

## Work package order and dependencies

```
WP1 IndexedDB store  ──┬──> WP2 Multiple documents ──┬──> WP3 Images as blobs
                       │                             │
                       └─────────────────────────────┴──> WP5 Save to files
                                                            ▲
                                        WP4 Markdown ───────┘
```

WP1 is the foundation — its record shape is designed for WP2 so that WP2 adds
no migration. WP3 needs WP2's document list to know which blobs are still
referenced. WP5 needs WP4's serializer (to write Markdown) and WP2's metadata
record (to store the file handle), and it needs IndexedDB specifically
because `FileSystemFileHandle` is structured-cloneable but not
JSON-serializable — localStorage cannot hold one. That is the concrete reason
WP1 comes first.

---

## WP1 — IndexedDB persistence

**Goal:** autosave survives documents far past 5 MB, and the storage layer is
shaped for multiple documents before there are any.

### Schema

Database `glossly`, version 1, three object stores. Split content from
metadata deliberately: rendering a document list must not read every
manuscript's full HTML into memory.

| Store | keyPath | Record |
| --- | --- | --- |
| `documents` | `id` | `{ id, html }` |
| `documentMeta` | `id` | `{ id, title, titleManual, createdAt, updatedAt }` |
| `blobs` | `id` | `{ id, docId, blob }` — created empty here, used in WP3 |

Indexes: `documentMeta.by-updated` on `updatedAt`; `blobs.by-doc` on `docId`.

Create all three stores in the version-1 upgrade even though `blobs` stays
empty until WP3 — an empty store costs nothing and avoids a version bump
later.

### Steps

1. New `apps/web/src/storage/db.ts` — a thin promise wrapper over raw
   IndexedDB. Export `openDb()`, `getDocument(id)`, `putDocument(meta, html)`,
   `deleteDocument(id)`, `listDocumentMeta()`. `putDocument` writes both
   stores **in one transaction** spanning both, so metadata and content can
   never diverge. Cache the open database promise in a module-level variable;
   do not reopen per call.
2. New `apps/web/src/storage/migrate.ts` — `migrateFromLocalStorage()`:
   if `localStorage['glossly-document']` exists and `documents` has no record
   with id `'default'`, write it, **read it back and compare**, and only then
   `localStorage.removeItem`. If the read-back differs, keep the localStorage
   copy and leave the app on the fallback path. Idempotent: a second call
   after a successful migration is a no-op.
3. `db.ts` exposes `isAvailable()`. If IndexedDB throws on open, the Editor
   keeps the current localStorage autosave path verbatim. The `autosaveFailed`
   banner stays exactly as it is and now also fires on IndexedDB write
   failures (quota still exists there — it is just far larger).
4. `Editor.svelte`:
   - `scheduleAutosave` writes via `putDocument` (same 500 ms debounce, same
     try/catch → `autosaveFailed`).
   - `onMount` becomes async: **await the document read before constructing
     the Tiptap editor**, and pass the loaded HTML as `content`. Do not
     construct with `DEFAULT_CONTENT` and then `setContent` — see pitfalls.
   - Use the fixed id `'default'` for now. WP2 replaces it with the active id.

### Tests (web, vitest)

`storage/db.test.ts`, importing `fake-indexeddb/auto` at the top:
put/get round-trip, `listDocumentMeta` ordering by `updatedAt`, delete removes
from both stores, and metadata/content written atomically.
`storage/migrate.test.ts`: seeded localStorage value migrates and the key is
removed; running twice is a no-op; a failed read-back leaves localStorage
intact.

### Acceptance criteria

- A document with several MB of embedded images autosaves and survives a
  reload. The same document on `main` triggers the quota banner.
- After first load with an existing manuscript, `glossly-document` is gone
  from localStorage and the content is unchanged in the editor.
- In a browser with IndexedDB disabled, the app still loads, edits, and
  autosaves via localStorage.

### Pitfalls

- **vitest runs in Node — there is no `indexedDB` global.** Every existing web
  test is a pure module; these are the first that need an environment. Import
  `fake-indexeddb/auto` in the test file rather than switching the whole suite
  to jsdom.
- **IndexedDB transactions auto-commit when the microtask queue drains.**
  Awaiting a non-IDB promise inside a transaction closes it. Do all store
  operations for a transaction in one tick.
- **`setContent` after construction pushes an undo entry**, so Ctrl+Z would
  wipe the just-loaded document back to the default — and the writer would see
  the default content flash first. Await the read, then construct.
- Store the HTML string directly. IndexedDB uses structured clone; do not
  `JSON.stringify` it.
- Safari evicts IndexedDB after ~7 days of no site use (ITP). Note it, do not
  fight it — WP5 (real files on disk) is the actual answer.

---

## WP2 — Multiple documents

**Goal:** create, rename, delete, and switch between local documents.

### Steps

1. New `apps/web/src/storage/documentStore.ts` — a Svelte store of
   `{ documents: DocMeta[], activeId: string }`, hydrated from
   `listDocumentMeta()`. The **active id** persists in
   `localStorage['glossly-active-document']`: it is a few bytes, has no quota
   risk, and must be readable synchronously at startup before the async
   IndexedDB open resolves.
2. **Title derivation** — `deriveTitle(html)`: first heading, else first
   non-empty block, trimmed to 60 chars, falling back to "Untitled". Recompute
   on every autosave *unless* `titleManual` is set by an explicit rename, so
   autosave never clobbers a name the writer chose.
3. **UI** — a document button at the left of the header in `App.svelte`
   showing the active title, opening a menu: the document list (title +
   relative `updatedAt`), "New document", and per-row rename and delete.
   Reuse the two-step confirm pattern already in the templates menu
   (`pendingTemplate` in `Editor.svelte`) for delete — deleting a document is
   not recoverable with Ctrl+Z, unlike every other destructive action in the
   app. Reuse the `mousedown` outside-click handler for the same reason
   documented there.
4. **Switching flushes first.** `clearTimeout(autosaveTimer)` then an
   immediate synchronous save of the outgoing document *before* loading the
   next one. Without this, the last up-to-500 ms of edits are silently lost on
   every switch.
5. **Loading** a document replaces editor content and **clears undo history** —
   otherwise Ctrl+Z crosses a document boundary and pastes one manuscript into
   another. (Tiptap: recreate the editor, or reconfigure the history
   extension.)
6. **Deleting the active document** switches to the most recently updated
   remaining one, or creates a fresh blank document if none is left. `activeId`
   must never dangle.
7. "New document" opens the template menu from the starter-templates feature
   rather than a hardcoded blank — the two features compose for free.

### Tests (web)

`documentStore.test.ts`: title derivation across heading/paragraph/empty
input; `titleManual` survives autosave; deleting the active document picks the
right successor; deleting the last document yields a fresh one; ordering by
`updatedAt`.

### Acceptance criteria

- Create three documents, type distinct text in each, switch rapidly between
  them, reload — all three intact with the right content and titles.
- Rename a document, then keep typing — the name stays.
- Delete the active document — lands on another one, never a blank screen.
- Type, then switch documents within 500 ms — nothing is lost.

---

## WP3 — Images as blobs

**Goal:** images stop living as base64 inside the document HTML.

### Steps

1. **Insertion** (`Editor.svelte:167`, currently `FileReader` → data URL):
   put the `File` into the `blobs` store with a generated id and the owning
   `docId`, then insert the image with a `glossly-blob:<id>` reference instead
   of the data URL.
2. **Rendering:** declare the blob id in a custom Image extension's
   `addAttributes()` — Tiptap drops attributes no extension declares. Resolve
   to an object URL for the *view only*; the stored `src` stays the
   `glossly-blob:` reference. Never persist an object URL: it is dead on the
   next page load.
3. **Revoke** object URLs when switching documents or unmounting — on the
   *next* document load, not in the same tick as the content swap, or images
   blank out mid-render. Every switch without this leaks the full image set.
4. **Garbage collection:** after a save completes (not during), delete blobs
   for that `docId` no longer referenced in its HTML. Deleting a document
   deletes its blobs via the `by-doc` index.
5. **Migration:** on load, convert any existing base64 data URLs in a document
   to blobs once, rewrite the srcs, and save. Old documents otherwise stay
   permanently huge. Same discipline as WP1 — write the blob, verify, then
   rewrite the HTML.

### Tests (web)

Pure helpers only: extracting `glossly-blob:` ids from an HTML string, the GC
set math (stored minus referenced), and data-URL → `Blob` conversion including
a malformed data URL.

### Acceptance criteria

- Insert a 4 MB photo — the `documents` record stays a few KB, the image
  renders after reload.
- Delete the image from the document, save — the blob is gone from IndexedDB.
- Delete a document that has images — its blobs are gone, other documents'
  images still render.
- Switch documents 20 times with images in both — memory does not climb
  (object URLs are being revoked).

---

## WP4 — Markdown import/export

**Goal:** round-trip between the Tiptap document and Markdown.

### Scope of "lossless"

Lossless for the six the roadmap names: **headings, lists, blockquotes, code
blocks, images, links** (plus bold/italic/strike/inline code). Highlight,
text alignment, subscript and superscript have no Markdown representation —
they degrade to plain text, keeping the words. Say this in the UI next to the
export action; do not pretend otherwise. Task lists as GFM `- [ ]` are
optional and worth doing if cheap.

### Steps

1. Add `prosemirror-markdown` to `apps/web`.
2. New `apps/web/src/editor/markdown.ts` exporting
   `toMarkdown(doc, schema)` and `fromMarkdown(text, schema)`, built from
   `defaultMarkdownSerializer` / `defaultMarkdownParser` **re-keyed to
   Tiptap's node and mark names**. This is the one real gotcha in this WP:
   prosemirror-markdown's defaults are written against
   `prosemirror-schema-basic`, which uses snake_case, while Tiptap uses
   camelCase. Every one of these must be remapped —
   `bullet_list`→`bulletList`, `ordered_list`→`orderedList`,
   `list_item`→`listItem`, `code_block`→`codeBlock`,
   `horizontal_rule`→`horizontalRule`, `hard_break`→`hardBreak`,
   `em`→`italic`, `strong`→`bold` — plus a `strike` rule, which has no
   default. The parser cannot be reused as-is either: construct a
   `new MarkdownParser(editor.schema, defaultMarkdownParser.tokenizer,
   remappedTokenSpec)`.
3. **Import creates a new document** rather than replacing the current one.
   This removes the destructive path and the confirm dialog entirely, and it
   composes with WP2's document list.
4. Export downloads a `.md` via a `Blob` + object URL. WP5 upgrades this to a
   real file write; keep it as the non-Chromium fallback.
5. Both actions go in WP2's document menu.

### Tests (web)

`markdown.test.ts`: for each of the six supported node types, a
`fromMarkdown → toMarkdown` round trip returning the input; nested lists;
a link with a title; an image with alt text; and lossy marks degrading to
their text rather than throwing.

### Acceptance criteria

- Export a document using all six types, reimport it — structure identical.
- Import a Markdown file written elsewhere (a README) — headings, lists, code
  fences and links all land as real nodes.

---

## WP5 — Save to real files

**Goal:** manuscripts live in the writer's own folders; browser storage
becomes the crash-recovery layer, not the source of truth.

### Steps

1. **Feature-detect `window.showOpenFilePicker`.** The File System Access API
   is Chromium-only. Where it is missing, the WP4 download + `<input
   type="file">` import path is the whole feature — hide the "Open file" and
   "Save to disk" actions rather than shipping buttons that throw.
2. Store the `FileSystemFileHandle` on the WP1 `documentMeta` record. Handles
   survive structured clone, so IndexedDB persists them across sessions.
3. **Permissions need a user gesture.** On reopen, `queryPermission({ mode:
   'readwrite' })`; if it returns `prompt`, do not request from a background
   autosave — it will be denied. File-backed documents autosave to IndexedDB
   always, and write to disk on an explicit save or when permission is already
   granted.
4. Bind Ctrl/Cmd+S to save-to-disk. Check it against the Phase 1 WP4 keyboard
   handler — those are Alt-based, so there should be no collision, but confirm
   the note's handler does not swallow it.
5. **Conflict handling:** on open, if the file's `lastModified` is newer than
   the record's `updatedAt`, ask which to keep. One pure decision function,
   unit-tested; the dialog around it is thin.

### Tests (web)

The API cannot be meaningfully faked — unit-test the newer-wins decision
function and the feature-detection branch. Everything else is the manual pass
below.

### Acceptance criteria

- Open a `.md` from disk, edit, Ctrl+S, confirm the change with `cat` outside
  the browser.
- Reload the page, reopen the same document — one permission prompt, then
  saving works.
- Edit the file in another editor while Glossly has it open, then reopen — the
  conflict prompt appears and honors the choice.
- In Firefox, the disk actions are absent and Markdown download/import still
  work.

---

## Final verification checklist

- [ ] `npm test` — all workspaces green, including the new storage tests
- [ ] `npm run build` — server tsc + web vite build pass
- [ ] Migration from a real `main`-era localStorage document: content
      preserved, key removed, no banner
- [ ] Large-document pass: >5 MB with images, reload, switch, reload
- [ ] Fallback pass: IndexedDB disabled → app still works; Firefox → no
      broken file buttons
- [ ] Data-loss sweep: switch documents mid-typing, delete the active
      document, undo across a document switch — nothing lost, nothing bleeds
      between documents
- [ ] `README.md` feature list and `docs/next-iteration-features.md` Phase 2
      section updated to shipped
- [ ] Five commits, one per work package, messages explaining the why
