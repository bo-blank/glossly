# Obsidian round trip — Implementation Plan

Self-contained plan for making Glossly safe and useful on Markdown files that
live in an Obsidian vault. Written for an implementing agent with no prior
context on this repository. Read this whole document before starting.

`docs/plans/phase-2-v1.2.md` covers the storage layer (IndexedDB, linked
files, blobs) and `phase-5-v1.5.md` the block markers in Markdown. The rules
of `phase-4-v1.4.md` still apply (see *Ground rules*).

Where this sits in the roadmap (before the web app, or as part of Phase 6) is
still the writer's call. The plan itself does not depend on it.

## Why

The writer keeps notes in Obsidian vaults. Glossly can link a document to a
`.md` file and writes it back on every save. Measured on 2026-10-04 with the
code at `dabe66e`, an Obsidian note that goes through Glossly comes back
**damaged**:

| Obsidian syntax | After open + save in Glossly |
| --- | --- |
| Front matter `---` … `---` | a horizontal rule plus a level-2 heading reading `title: … tags: …` |
| `[[Note]]`, `[[Note#Heading\|Alias]]`, `![[image.png]]` | escaped to `\[\[Note\]\]`, so Obsidian no longer sees a link |
| Callout `> [!note] Title` + body line | `> \[!note\] Title body`: escaped, and the title is merged with the body |
| Footnote `[^1]` and `[^1]: text` | escaped: `\[^1\]` |
| Single line break inside a paragraph | becomes a space; **tables collapse into one line**, and Obsidian shows single breaks as line breaks by default |
| `==highlight==` | survives, but only as literal text, not as a highlight |
| `%%comment%%`, `$a_b$`, `#tag/sub`, `^blockref` | survive unchanged |

Two causes produce most of the damage:
- `MarkdownSerializerState.esc` in prosemirror-markdown escapes every `[` and `]`.
- markdown-it's `softbreak` reaches the document as a space.

## Decisions already made (2026-10-04)

1. **Use Glossly's own Markdown code, not `@tiptap/markdown`.** The official
   package (MIT, `marked`-based, 3.31.3 matches our pins) would need block
   markers, image hoisting and task lists rebuilt. It also turns raw HTML into
   real formatting through `generateJSON`, which breaks Glossly's rule that
   raw HTML is never displayed as formatting.
2. **Wikilinks and embeds show as chips.** `[[Note#Heading|Alias]]` shows as a
   small chip reading "Alias", `![[image.png]]` as "📎 image.png". Chips
   are not clickable, because Glossly has no access to the vault. They are written back
   **verbatim**. Accepted catch: rewriting a selection that contains a chip
   replaces it with plain text, so the link is lost.
3. **Front matter is hidden and kept verbatim.** It is stored byte for byte and
   written back on save and export. A small "Properties" badge shows that it
   exists, and clicking it shows the YAML read-only. Editing stays in Obsidian.
4. **Plan first**, then one commit per work package.

## Open decisions — ask the writer before the WP that needs them

| # | Question | Recommendation | Needed by |
| --- | --- | --- | --- |
| A | Where does the "Properties" badge sit? | Editor footer, next to `FileStatus` / `EndpointStatus`. It describes the file, not the text's structure (right column) or its surface (left column) | WP2 |
| B | A line break typed in Glossly (Shift+Enter) in a file that came from Obsidian: plain newline like Obsidian, or CommonMark `\` + newline? | `\` + newline, as today. Obsidian displays both the same, and only breaks that came from the file are written as plain newlines | WP1 |
| C | `==` on export for documents that never came from Obsidian (GitHub shows `==x==` literally) | Always `==`. Colour is lost either way, and the menu text says so | WP3 |

## Key files

| File | Role |
| --- | --- |
| `apps/web/src/editor/markdown.ts` | parser (markdown-it core rules: sections, HTML, images) and serializer |
| `apps/web/src/editor/markdown.test.ts` | round-trip tests. The `lossy marks` test expects highlight → plain text and changes in WP3 |
| `apps/web/src/editor/markdownFiles.ts` | `editorToMarkdown`, `markdownToHtml`, download |
| `apps/web/src/editor/schemaExtensions.ts` | schema shared by the editor and Markdown. New nodes and attributes go here |
| `apps/web/src/storage/fileStore.ts` | `writeFile` (save), open, conflict "take the file's version" (`replaceFromFile`) |
| `apps/web/src/components/DocumentMenu.svelte` | Import / Export menu entries and the lossy-marks note |
| `apps/web/src/storage/db.ts` | `DocMeta`. Front matter goes here, with no `DB_VERSION` bump (meta is a plain object) |
| `apps/web/src/editor/blockText.ts` | **position-aligned** text for readability and treatment plan, via `textBetween(…, '\n')` |
| `apps/web/src/note/contextExtraction.ts` | text for the prompt, via `textBetween(…, '\n', ' ')` |

## Work packages

### WP1 — Stop damaging what Glossly doesn't understand

The most urgent package: it stops the damage to vault files on every save.
It adds no new display.

1. **Narrower escaping.** Override `esc` (or wrap the `text` serializer) so
   that `[` and `]` are only escaped where they would *create* a link:
   - `]` directly followed by `(` or `[` (inline link, full reference),
   - `]:` at the start of a block (reference definition),
   - except inside `[[…]]` and in labels starting with `^` (footnotes).
   Everything else in `esc` stays as it is (`*`, `_`, `` ` ``, `~`, `\`,
   start-of-line `#`, `-`, `>`, `1.`).
2. **Soft line breaks stay line breaks.** markdown-it `softbreak` becomes a
   `hardBreak` with a new attribute `soft: true`, added via
   `addGlobalAttributes` on `hardBreak` and stored in HTML as `data-soft`. The
   editor shows a line break, which is what Obsidian shows too. The serializer
   writes a soft break as a bare `\n` and a normal one as `\\\n`, as before.
   The text after a soft break gets start-of-line escaping (a line starting
   with `- ` or `# ` would otherwise become a list or heading).
3. Tests in `markdown.test.ts`, each as an exact round trip:
   - a callout with title and body lines,
   - a table (survives as text),
   - footnote reference + definition,
   - wikilink + embed as text (until WP4 makes them chips),
   - a paragraph with soft breaks,
   - a literal `[a](b)` typed as text stays escaped (it must not become a link),
   - `%%comment%%`, `$a_b$`, `#tag/sub`, `^blockref` unchanged.
4. Browser check: a file containing all of the above, opened through the
   OPFS picker shim (see phase 2), typed in, saved. Then diff the file.

### WP2 — Front matter, verbatim

1. `splitFrontMatter(text)` in `markdown.ts` returns `{ frontMatter, body }`.
   It only matches front matter starting at the very first line
   (`^---\r?\n … \r?\n---[ \t]*\r?\n`). `frontMatter` is the **exact** matched
   text, including the delimiters and the blank lines up to the first body
   character. `---` anywhere else stays a horizontal rule.
2. `DocMeta.frontMatter?: string`. `markdownToHtml` returns the front matter
   alongside the HTML, and every caller stores it:
   - import (`DocumentMenu.importMarkdown`),
   - opening a file (`fileStore` open → `createDocument`),
   - the conflict choice "file" (`replaceFromFile`).
   `editorToMarkdown(editor, frontMatter?)` prepends it on save and export.
3. Front matter is not copied by "Save as template", and a duplicated
   document keeps it.
4. "Properties" badge where decision A puts it. Clicking it opens a read-only
   `<pre>` with the YAML. Runes component, `svelte-check` clean.
5. Tests: exact round trip with front matter, an empty one (`---\n---`), CRLF,
   a document whose first line is `---` but has no closing delimiter (stays a
   horizontal rule), and the conflict path keeping the front matter.

### WP3 — `==highlight==`

1. Parser: `markdown-it-mark` (MIT, from the markdown-it organisation) via
   `tokenizer.use(…)`; `mark` → `{ mark: 'highlight' }`. If adding the
   dependency is a problem, a small inline rule modelled on strikethrough
   works too.
2. Serializer: `highlight` → `==` … `==`, ignoring the colour. Literal `==` in
   text is escaped only where it would open a mark: `a == b` stays, `x==y==`
   gets escaped.
3. Update the menu note in `DocumentMenu.svelte` (colours are lost, the
   highlight itself is kept), and the `lossy marks` test.

### WP4 — Wikilinks and embeds as chips

1. Inline atom node `wikilink` with attributes `raw` (everything between the
   brackets, e.g. `Note#Heading|Alias`) and `embed` (boolean). The display text
   is derived (alias, otherwise target without `#…`; for embeds "📎 " +
   target). The serializer writes `[[raw]]` or `![[raw]]` and never escapes
   it.
2. markdown-it inline rule for `[[…]]` / `![[…]]`, registered before `link`,
   no newline inside. It doesn't fire in code, because code spans are already tokens.
3. **Text extraction:**
   - Do **not** give the node a `leafText`/`renderText`. `textBetween` would
     prefer it over the `leafText` argument and break the position mapping in
     `blockText.ts`.
   - `blockText.ts` passes a leafText function returning a one-character
     stand-in (counts as one word, keeps positions aligned).
   - `contextExtraction.ts` passes one returning the display text, so the
     model sees "Alias".
   - Check `sentenceExpansion.ts` (`textContent`, which drops atoms).
4. Chip styling: muted pill using the theme's base colours (no amber text on
   white — see the readability lessons). Copying a chip as plain text gives
   `[[raw]]`.
5. Tests: round trip of `[[A]]`, `[[A|B]]`, `[[A#H|B]]`, `![[img.png]]`,
   `![[img.png|300]]`, two wikilinks back to back, a wikilink inside a
   heading and inside a list item; readability positions with a chip before a
   long sentence; prompt context contains the alias.
6. Optional, only if the writer asks: after a rewrite, if the alias appears
   in the suggestion exactly once, turn it back into the chip.

## Out of scope

- Rendering tables, callouts and footnotes. After WP1 they survive as text.
- Navigating wikilinks or showing embedded images (needs vault folder access,
  which is Phase 6 territory).
- Editing front matter, and Glossly-specific keys in it (protected terms and
  template stay in `DocMeta`, as decided in phase 4).
- Normalisations the serializer already does on first save (`*` → `-` list
  markers, `__` → `**`, `***` → `---`, loose → tight lists). These are known
  and don't change what Obsidian renders.

## Ground rules

From `phase-4-v1.4.md`:
- Svelte runes in new components only.
- `npx svelte-check --threshold warning` after every Svelte change.
- `npm test` + `npm run build` before every commit.
- Headless browser checks against `vite preview` on a spare port, never the
  writer's :3000 / :5173.
- One commit per work package.

Never test against files in the writer's real vaults; use fixtures and OPFS.
