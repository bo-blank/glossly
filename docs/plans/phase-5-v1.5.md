# Phase 5 (v1.5) — Implementation Plan: Blocks

Self-contained plan for the first text-architecture feature: the document is
made of **blocks**, one per unit of meaning, and the writer moves them
around. Written for an implementing agent with no prior context on this
repository. Read this whole document before starting.

`docs/plans/phase-1-v1.1.md` covers the repository layout and the suggestion
pipeline, `phase-2-v1.2.md` the storage layer (IndexedDB, files, blobs),
`phase-3-v1.3.md` the prompt and context extraction, and `phase-4-v1.4.md`
templates and the structure guide (`StructureGuide.svelte`).

## What Phase 5 is actually for

Phases 1–4 made Glossly good at *how a sentence sounds*. The writer wants it
to grow toward *how a text is built*: which parts it has, what each part is
for, and in which order they work best. Blocks are the first step and the
foundation for everything after it. A block is a named unit of meaning ("Einstieg",
"These", "Beleg") that can be reordered as a whole.

This changes the roadmap's filter. Until now every feature had to make the
phrase-suggestion loop faster, more trustworthy or less disruptive. From
Phase 5 on, a feature may also **help the writer see and shape the structure
of the text**. The other rules still hold: it runs locally, nothing happens
without a click, and Glossly doesn't interrupt the writing.

The web app moves from Phase 5 to Phase 6, at the writer's decision
(2026-10-03).

## Decisions already made (2026-10-03)

1. **A block is its own container node** (`section`), holding one or more
   paragraphs, headings, lists etc. It is not derived from headings, and it
   is not one block per paragraph. Boundaries are set by the writer or by
   the template.
2. **Blocks are flat**: a block never contains a block. Hierarchy can come
   later. It would need its own design and must not be added here as a side effect.
3. **Optional name** per block (`name` attribute, empty by default).
4. **Markdown keeps the blocks** as HTML comments on their own line:
   `<!-- block: Einstieg -->`, or `<!-- block -->` for an unnamed block.
   They are invisible in rendered Markdown and survive other editors.
5. **Four ways to move a block**, all in this phase: the outline in the
   structure card (right), the table of contents (left column), a drag
   handle beside the block in the text, and Alt+Shift+↑/↓ for the block
   containing the cursor.

## Open decisions — ask the writer before the WP that needs them

| # | Question | Recommendation | Needed by |
| --- | --- | --- | --- |
| A | Documents and Markdown files **without** block markers: how are they split? | **Decided 2026-10-03:** a new block before every H1/H2, unless the block so far holds only headings (a title stays with the chapter heading under it); no headings → one block | WP1 |
| B | Write markers into the writer's `.md` files always, or only when needed? | **Decided 2026-10-03:** only when the blocks differ from what rule A would derive or a block has a name. A file that rule A reproduces stays untouched | WP2 |
| C | Block name in the text: always visible, or only on hover/focus? | **Decided 2026-10-03:** always visible when the block is named, small and grey above the block. Unnamed blocks show nothing until hovered | WP3 |
| E | Table of contents: blocks without a heading, how do they show? | As a short grey entry (first ~4 words), so every block can be grabbed there too. Headings stay the normal entries | WP5b |
| D | Templates: which parts become their own block? (e.g. salutation and sign-off of the e-mail/cover letter) | Salutation goes into the first block and sign-off into the last; guide sections map 1:1 to blocks | WP6 |

## Key files

| File | Role |
| --- | --- |
| `apps/web/src/editor/schemaExtensions.ts` | schema extensions shared by editor and Markdown — the new `Section` node goes here |
| `apps/web/src/editor/markdown.ts` | prosemirror-markdown parser/serializer (Tiptap-camelCase re-keyed) |
| `apps/web/src/editor/markdownFiles.ts` | file read/write, `getHTMLFromFragment` |
| `apps/web/src/components/Editor.svelte` | editor setup, autosave (`getHTML()`), template insert (`setContent`) |
| `apps/web/src/components/StructureGuide.svelte` | the structure card ("Aufbau") — the outline docks here |
| `apps/web/src/editor/templates/{de,en,types}.ts` | template texts + `guide` notes; `templates.test.ts` enforces the writer's rules |
| `apps/web/src/editor/templateFormatting.ts` | `plainTemplateContent` for own templates |
| `apps/web/src/note/contextExtraction.ts` | **walks `doc.forEach` / `index(0)` as "top-level block"** — breaks when sections wrap everything |
| `apps/web/src/note/readabilityHighlight.ts`, `sentenceExpansion.ts` | use `descendants` / `resolve` — probably unaffected, verify |
| `apps/web/src/storage/db.ts` | `DocMeta`; documents are stored as HTML |

## Ground rules

The rules from `phase-4-v1.4.md` still apply, in particular: Svelte runes in
new components only (never add runes to a legacy component), `npx
svelte-check --threshold warning` after every Svelte change, `npm test` +
`npm run build` before every commit, headless browser checks against `vite
preview` on a spare port (never the writer's :3000 / :5173), **template texts
are shown to the writer before commit**, one commit per work package.

In addition:

1. **No new Tiptap dependency without need.** `@tiptap/extension-drag-handle`
   is MIT, but its peer dependencies pull in Yjs/collaboration. Build the
   handle from a node view with `draggable: true` and `data-drag-handle`
   (Tiptap core supports this). If you still add any `@tiptap` package, pin
   it to exactly the same version as the others (now 3.31.3), or a second
   core is installed.
2. **No existing document may change its text.** Migration only wraps content
   in blocks. A test compares `textContent` before and after for every
   template and a set of real-shaped documents.
3. **Every block operation is a single transaction**: one Ctrl+Z undoes a move, split,
   merge or rename completely.
4. **The margin note closes** when the block containing its selection moves.
   Mapping its positions through a move is possible but not worth the risk.

## Work package order and dependencies

```
WP0 Roadmap + stories            (docs only)
WP1 Section node + migration ──> WP2 Markdown round-trip
                             ──> WP3 Split / merge / name
                             ──> WP4 Move: keyboard + drag handle ──> WP5 Outline in structure card
                                                                    ──> WP5b Move in the table of contents
                             ──> WP6 Templates as blocks (texts to the writer first)
WP7 Block name in the prompt     (optional, only if the bench shows an effect)
```

---

## WP0 — Roadmap and stories

Docs only, one commit.

1. `docs/next-iteration-features.md`: rewrite the intro filter (see *What
   Phase 5 is for*), insert **Phase 5 — Text architecture** with item #25
   *Blocks*, renumber the web app to **Phase 6** (items #23, #17, #24 move
   with it). Keep the "dropped" list. Nothing in it is revived.
2. `docs/user-stories.md`: new **Epic 7 — The shape of a text** with
   7.1 *Units of meaning as blocks*, 7.2 *Reorder without cut and paste*,
   7.3 *See the outline next to the text*. Persona fit: P1 (essays,
   long-form) and P2 (structure templates). Update the "Phase 5"
   references (6.3) to Phase 6.
3. Leave `phase-4-v1.4.md` as it is. It is a historical plan.

---

## WP1 — The `section` node and migration

**Goal:** every document consists of blocks. Nothing visible changes yet,
except that old documents now carry the structure.

### Design

```ts
// editor/section.ts
Node.create({
  name: 'section',
  content: 'block+',      // paragraphs, headings, lists, quotes, images, code
  defining: true,
  draggable: true,        // used by WP4's handle
  addAttributes: () => ({ name: { default: '' } }),
  parseHTML: () => [{ tag: 'section[data-block]' }],
  renderHTML: ({ node }) => ['section', { 'data-block': node.attrs.name }, 0],
});
// Document: content 'section+'
```

- `section` is **not** in the `block` group, so it can never nest. The
  document node's content becomes `section+` (override `Document` from
  StarterKit: `StarterKit.configure({ document: false })` + own `Document`).
- Add it to `schemaExtensions` so editor and Markdown agree.
- **Migration** `wrapIntoSections(html | JSONContent)`: content without
  `<section data-block>` is split by rule A (decision A) and wrapped. Run it
  where HTML enters the editor: loading from IndexedDB, `setContent` for
  templates/imports, `createDocument`. Do not rely on ProseMirror's
  automatic wrapping: it would put everything into a single block and hide
  the step that is supposed to be tested.
- Saved documents migrate on their next autosave. No DB version bump is
  needed, because HTML stays HTML.

### Touch points to fix

- `contextExtraction.ts`: "top-level block" (`doc.forEach`, `index(0)`)
  becomes "block-level child of a section". Collect blocks by descending one
  level and use `index(1)`. Existing tests must pass unchanged, and add a
  test where the selection's neighbours sit in a different section.
- `TableOfContents`: check that headings inside sections still get ids and
  the hierarchical index still works. Its onCreate dispatch is a known trap
  (see `Editor.svelte` near line 375).
- `Placeholder` / first-run hint: the empty document is now
  `section > paragraph`. Tiptap's Placeholder needs `includeChildren` for
  that, and then reads "editor is empty" from the state before the
  transaction (hint one keystroke late). Replaced by `EmptyPlaceholder`
  (`editor/emptyPlaceholder.ts`), same class and attribute.
- `CharacterCount`, readability marking, sentence expansion, `extractBlobIds`,
  `plainTemplateContent`, `DocumentMenu` save-as-template: test or verify.
- `templates.test.ts` formatting rule ("only p/h1-3/lists/quote/bold/
  italic"): allow `section`.

### Tests

- Migration: every template (de + en), a document with no headings, one
  starting with H1, H1 + several H2, lists/quotes/images between headings,
  an already sectioned document (idempotent). `textContent` unchanged.
- Editor round-trip `getHTML()` → `setContent` → `getHTML()` is stable.

---

## WP2 — Markdown round-trip

**Goal:** blocks survive save and reopen of a `.md` file, and a file that
needs no markers is written without them (decision B).

### Design

- **Serializer:** `section` writes `<!-- block: Name -->` (or `<!-- block -->`)
  on its own line, followed by a blank line, then its content. Under decision B, a document
  whose blocks equal `wrapIntoSections` of its own content and has no names
  is serialized **without** any markers.
- **Parser:** split the Markdown into chunks on marker lines *outside
  fenced code blocks* before handing them to markdown-it. Parse each chunk,
  then wrap it in a section. Text before the first marker becomes an
  unnamed first block. No markers at all → parse normally, then rule A.
- **Names:** trim, single line, max. 60 characters (constant in
  `@glossly/shared`? No, it is client-only. Keep it in `section.ts`).
  A name must not contain `-->`, so replace it with `—>` on save.
- Phase 2's conflict detection compares file content against the last sync.
  Opening an old file and saving it under decision B must produce the
  same bytes as long as nothing changed. Add a test for that.

### Tests

Extend `markdown.test.ts`: named/unnamed blocks, marker inside a code
fence stays text, heading-derived structure writes no markers, two
consecutive markers (empty block → dropped on import, not an error),
round-trip of all templates.

---

## WP3 — Split, merge, name

**Goal:** the writer creates and dissolves blocks without leaving the
keyboard, and names them.

### Design

| Action | Input | Behaviour |
| --- | --- | --- |
| New block from here | **Mod+Shift+Enter** | Splits the section before the textblock containing the cursor. In the middle of a paragraph, split the paragraph first. In the first textblock of a block, it does nothing. |
| Merge with previous | **Backspace** at the very start of a block | First press joins the two sections (paragraphs stay separate). A second press then behaves as normal Backspace. Verify what PM's `joinBackward` does by default before overriding it. |
| Name | click on the label / via the outline (WP5) | Inline input, Enter saves, Escape cancels; empty = unnamed |

- Block label (decision C): a node view renders the name in a small grey
  line above the content, `contenteditable=false`. It must not appear in
  `textContent`, the word count or the context sent to the model.
- A subtle left border or extra spacing between blocks makes the boundaries
  visible. The writer judges in a screenshot whether it looks calm enough.
  The editor should still look like a page, not like cards.
- Commands live in `section.ts` (`splitSection`, `joinSectionBackward`,
  `renameSection`) and are unit-tested on bare ProseMirror states.

---

## WP4 — Move: keyboard and drag handle

**Goal:** a block moves as a whole, in one undo step.

### Design

- Command `moveSection(fromIndex, toIndex)`: one transaction, `delete` +
  `insert` of the section node. The selection moves with the block, so the
  cursor stays where the writer was typing, just in the new place.
  Shared by all four move paths (keyboard, handle, outline, table of contents).
- **Alt+Shift+↑ / ↓** moves the block containing the cursor by one. At the
  ends nothing happens. Check that Alt+Shift+arrows are not taken by the
  existing keyboard flow (Alt+1–3, Alt+N) or by the browser/GNOME.
- **Drag handle ⠿**: in the same node view as WP3's label, left of the
  block, visible on hover/focus. `data-drag-handle` on it, `draggable: true`
  on the node. ProseMirror's own drop then moves the node. Because `section`
  is only allowed at the top level, a drop inside a paragraph is placed at
  the nearest valid boundary. Check this with a headless drag test, and
  check that dropping onto itself is a no-op.
- The margin note closes when its block moves (ground rule 4).

### Tests

Unit: `moveSection` for first/last/middle, undo restores exactly.
Headless: Alt+Shift+↓ in the second of three blocks, drag of block 3 above
block 1, Ctrl+Z after each.

---

## WP5 — Outline in the structure card

**Goal:** the structure of the text at a glance, next to it, and the
fastest way to reorder.

### Design

- `StructureGuide.svelte` becomes the home of the outline (the writer's
  wish from Phase 4: "the structure card becomes central"). It shows when
  the document has **two or more blocks or a template**. The xl side
  column and the collapsible inline variant stay as they are.
- One row per block: name, or else its first ~6 words in grey italics,
  plus the word count. Click → scroll to the block and put the cursor in it.
  The block containing the cursor is highlighted.
- Reorder: drag rows (HTML5 DnD) **and** an accessible path, e.g. focus a row
  and press Alt+Shift+↑/↓. The same `moveSection` as WP4.
- Rename: double-click or the pencil on the row. Same command as WP3.
- Template guide: a hint whose `section` matches a block name (case-
  insensitive) is shown under that row. Closing the guide
  (`guideClosed`) hides the hints, **not** the outline.
- Reactivity: derive the outline from the editor state on transactions,
  but only when the section structure or names changed. Typing inside a
  block must not rebuild the list (compare a cheap signature: count +
  names + first-text of each section).
- Own runes component (`BlockOutline.svelte`) rendered by
  `StructureGuide`, not runes added to anything legacy.

---

## WP5b — Move in the table of contents (left column)

**Goal:** the writer reorders blocks in the left column as well, where they
already navigate by headings.

### Design

- The table of contents (`TableOfContents.svelte`, xl only, fed by
  `tocStore` from Tiptap's TableOfContents extension) lists **headings**,
  not blocks. A block can hold several headings or none. So the entries are
  **grouped by block**: each block is one draggable group containing its
  heading entries. Dragging any entry, or the group's handle, moves the
  **whole block** with `moveSection`. A single heading never moves on its own.
- Blocks without a heading follow decision E (short grey entry). Otherwise
  they would be invisible here and could not be moved.
- Drop targets are only the gaps between groups, never between two headings
  of the same block. Show the insertion line there.
- Keyboard: focus an entry, then Alt+Shift+↑/↓ moves its block (same as the
  outline). Click still scrolls to the heading.
- To group, map each toc item's `pos` to its section index
  (`doc.resolve(pos).index(0)`). Recompute only when the section signature
  from WP5 changes or the toc store updates.
- `TableOfContents.svelte` is a legacy (non-runes) component. Either convert
  it **completely** to runes in this WP (it is small) or put the grouping into
  a new runes component it renders. Never mix the two (Phase 4 rule).
- The WP5 outline and the table of contents use the same drag/drop helper
  (`blockDnd.ts`: drag source index, drop gap index → `moveSection`), so the
  two cannot drift apart.

### Tests

Unit: toc items → groups (block with two headings, headless block, heading
as first node). Headless (xl viewport, ≥1280 px): drag the group of
block 3 above block 1 in the left column, check the document order and that
one Ctrl+Z restores it.

---

## WP6 — Templates as blocks

**Goal:** a template starts as named blocks that match its structure
guide.

- Rewrite the `content` of all 10 templates in `de.ts` and `en.ts` into
  `<section data-block="…">` with the `guide` section names (decision D).
- `templates.test.ts`: every guide `section` matches exactly one block name
  and every named block has a guide note. Same in both languages.
- Do not change the texts themselves. If a guide section doesn't fit a block
  boundary, show the writer and ask. **Show the result to the writer
  before committing** (Phase 4 rule).
- Own templates (Phase 4 WP6) keep the writer's blocks and names through
  `plainTemplateContent`. Test that.

---

## WP7 — Block name in the prompt (optional)

The block name is a strong context signal ("Einstieg" vs "Fazit"). Add it to
`SuggestionContext` (like `headingPath`, limits in `@glossly/shared`,
validated on the server) **only if** a bench run with e2b shows a visible
difference. Use the existing bench with cases where the same sentence sits in
differently named blocks. Without a measurable effect, write down the result
and drop the WP.

---

## Later — not part of this phase

Ideas this foundation enables. Each one gets its own decision:

- a **purpose note per block** ("what this part must achieve"), shown in the outline
- **collapse** a block to see the skeleton of a long text
- **nested** blocks (chapter → scene)
- a **word budget** per block (LinkedIn hook ≤ 2 lines, …)
- a model-based **structure check** ("the thesis comes after the evidence"), following
  the grammar-check pattern: measured first, opt-in, click to apply
- blocks reused across documents
