# Glossly — User Stories

Stories for the quiet writing copilot, grouped by epic. Each one is checked
against the roadmap filter in `docs/next-iteration-features.md`: does it make
the phrase-suggestion loop faster, more trustworthy, or less disruptive to
writing flow, or, from Phase 5 on, does it help the writer see and shape the
structure of the text?

Status legend:

- ✅ — shipped
- **#n** — covered by roadmap item n (`docs/next-iteration-features.md`)
- **gap** — not on the roadmap yet
- **candidate** — proposed in the 2026-11-16 review, listed on the roadmap
  under *Candidates*, not decided
- **partial** — partly covered today; the note says what's missing

---

## Personas

**P1 — The mid-draft stylist.** Fiction, essays, literary nonfiction. Knows
what they want to say; is stuck on how it *sounds*. Reaches for Glossly
mid-flow, so latency and interface noise are the enemy. This is the core user
from `docs/specification/specs.md` §2.

**P2 — The deadline writer.** Newsletters, blog posts, LinkedIn posts. Faster
and more pragmatic; starts from a template. The starter templates serve this
persona, but the spec doesn't mention them yet (see *Open questions*).

**P3 — The confidential writer.** Unpublished manuscripts, cover letters, text
under NDA. Privacy is the reason they chose Glossly over a cloud tool.

**P4 — The self-hoster.** Runs their own local model server (e.g. llama-swap)
and cares about which model runs, how fast, and how much VRAM it takes.

**P5 — The beginner writer.** Writes occasionally — a blog post, an
application, a club newsletter — and isn't well versed in it. Usually has a
draft but senses that a sentence is "off" without knowing why, and doesn't
have the vocabulary (register, rhythm, Latinate) that P1 has. Needs the tool
to be self-explanatory; won't configure anything. The spec (`specs.md` §1)
explicitly aims at the *opposite* user, so P5 stories are scoped to what the
margin note already does well — see Epic 6 and *Open questions*.

---

## Epic 1 — Trying out phrasings without breaking flow

### 1.1 Fast alternatives ✅

As P1, I want 3 alternatives for a selected phrase within about a second, so I
stay inside the sentence instead of waiting on a spinner.

- The first alternative renders before the full response has arrived (SSE streaming).
- A new selection cancels the in-flight request; a stale response never overwrites a newer note.

### 1.2 One-click steering ✅

As P1, I want to steer suggestions with one click (Tighter / More vivid /
Plainer), so I never have to write a prompt.

- Clicking a chip re-requests for the same selection without re-selecting.

### 1.3 My own chips ✅

As P1, I want to define my own chips ("more Didion", "less Latinate"), so the
tool speaks my vocabulary.

- A custom chip is a label plus an instruction, stored locally.
- A custom chip can't override a built-in modifier's instruction.

### 1.4 Keyboard-only loop ✅

As P1, I want the whole loop on the keyboard, so my hands never leave the keys.

- Alt+1–3 applies a suggestion, Alt+N requests fresh ones, Esc dismisses.
- Plain digits and letters are never intercepted while the note is open.

### 1.5 Sentence rewrite on request ✅

As P1, I want to widen a phrase to its whole sentence when the problem is
structural, and only when I ask for it.

- Opt-in via the "Rewrite sentence" chip; the default stays phrase-level.

### 1.6 Earlier alternatives ✅

As P1, I want to get back alternatives I saw earlier for the same selection,
because the second batch often makes me want the first one back.

- Alternatives are kept per selection for the whole session.
- Going back to an earlier batch doesn't hit the model again.

### 1.7 Suggestions that know the chapter ✅

As P1, I want suggestions that fit the chapter I'm in, not just the
neighbouring paragraph.

- The request includes the document title, the nearest heading and neighbouring paragraphs, within a fixed token budget.

### 1.8 Repeated words nearby — candidate

As P1, I want to see where I used the same word twice within a few sentences,
so I can pick the one to vary and get alternatives for it right there.

- On request only (a switch, like the readability marking), never while typing.
- Found by counting, no model: the same content word within a set distance,
  function words and protected words (2.4) left out.
- A click on a marked word opens the margin note for it, as a normal selection would.
- The distance is one setting, and the marking works for German and English.

Fits the first filter: it is a faster way into the loop the writer already
uses. It reuses `textUnits`, the highlight of the readability marking and
the margin note.

### 1.9 Hear the sentence — candidate

As P1, I want to hear a sentence or a suggestion read aloud, because I judge
rhythm by ear and not by eye.

- A small "listen" control on the selection and on each suggestion.
- Uses a voice installed on the machine. A voice that sends text to a server
  is never used, and without a local voice the control is not shown.
- Esc or a new selection stops it.

**Condition:** the browser's speech synthesis offers remote voices too (in
Chrome the Google voices), which would break "nothing leaves the machine".
Only voices marked `localService` qualify, and that has to be checked in a
real browser before this is built.

---

## Epic 2 — Trust and control

### 2.1 Nothing happens without a click ✅

As any writer, I want nothing in my text to change unless I clicked it, so I
never have to wonder what the tool did behind my back.

### 2.2 Visible, undoable swaps ✅

As any writer, I want every swap to undo with Ctrl/Cmd+Z, and to see briefly
what changed.

- One swap = one undo step.
- The swapped text gets a short highlight that fades out.

### 2.3 Word-level comparison ✅

As P1, I want to compare my original and each suggestion word by word before
committing, because the difference is often a single word.

- Changed words are highlighted in each suggestion.

### 2.4 Protected words ✅

As P1, I want some words — character names, invented terms, a deliberate
repetition — to never be changed in suggestions.

- Each document has a "keep" list the writer can edit.
- Words on the list are passed to the model as must-keep terms.
- If a suggestion changes a protected word anyway, it's hidden or flagged.

Shipped in Phase 4 (#19): a suggestion that drops a protected word is flagged.

### 2.5 Suggestions in my language and register ✅

As a German-writing user, I want suggestions in the language of my text and in
the same register (Sie/du).

- Suggestions are in the same language as the selection.
- The register of the context (formal/informal address) is kept.

Both system prompts in `apps/server/src/providers/prompt.ts` now state the
rule explicitly (`LANGUAGE_RULE`), with a German fixture in `prompt.test.ts`.
Before, the English prompt left the model to guess the answer language.

### 2.6 Protected words for a whole series — candidate

As P1, I want one keep-list for all documents of a project (the chapters of a
book, the issues of a newsletter), so I don't retype the character names in
every document.

- A second, shared list next to the per-document one; both apply.
- A word can be moved from a document's list to the shared one in one click.
- Own templates do not carry the shared list.

Small extension of 2.4. Worth it only once a writer keeps a multi-document
project in Glossly.

---

## Epic 3 — A manuscript I can trust (Phase 2)

### 3.1 Real files ✅

As P1, I want my manuscript saved as a real `.md` file in my own folder, so it
survives browser resets and works with my backups and git.

- Open and save go through the File System Access API.
- Markdown round-trips without loss: headings, lists, blockquotes, code, images, links.

### 3.2 No storage cliff ✅

As P1, I want to paste images without the document quietly hitting a storage
limit.

- Images are stored as blobs in IndexedDB, not base64 in localStorage.
- A quota error is shown explicitly, never swallowed.

### 3.3 One document per piece ✅

As P2, I want several documents, one per piece, so I don't overwrite last
week's newsletter.

- Create, rename, delete and switch documents from a simple list.

### 3.4 Crash recovery ✅

As any writer, I want to lose at most a few seconds of work after a crash or
a closed tab.

- Autosave runs within seconds of the last edit.
- Reopening the app restores the last autosaved state.

### 3.5 Safe on files from my Obsidian vault — #30

As P1, I want a note from my Obsidian vault to come back from Glossly
unchanged except for what I edited, so I can use Glossly on notes I already
have.

- Front matter is kept byte for byte and shown as a "Properties" badge.
- Wikilinks, embeds, footnotes, callouts and tables are written back as they
  were, and a single line break stays a line break.
- A file opened and saved without an edit is identical to the original, apart
  from the known list-marker normalisations.

**Today:** such a file comes back damaged (table in
`docs/plans/obsidian-round-trip.md`). This is the first item on the roadmap
because it loses the writer's data.

### 3.6 Find and replace — candidate

As P1, I want to find a word in my document and replace it, so I can rename a
character or check how often I used a phrase without leaving Glossly.

- Ctrl+F opens a small search line; matches are marked and counted ("3 of 12").
- Enter and Shift+Enter move between matches, Esc closes and returns the cursor.
- Replace one or all. "Replace all" is one undo step.
- Options: match case, whole word. No regular expressions.

The browser's own Ctrl+F finds text but cannot replace it, and it also finds
the margin and the outline.

### 3.7 Keep a version before I change the structure — candidate

As P1, I want to keep a named version of my document before I reorder blocks
or cut a part, so I can try a different shape of the text and go back after
the undo history is gone.

- "Keep this version" stores the document with a name and a date. Local, in IndexedDB.
- A list per document: look at a version read-only, restore it, delete it.
- Restoring keeps the current state as a version first, so nothing is lost by it.
- Images are shared with the document and not copied.
- No automatic versions and no diff view in the first step.

Undo ends with the session and with a document switch (3.3). Block moves
(7.2) and "Find blocks" (7.6) are the changes a writer wants to be able to
take back a day later.

### 3.8 Back up everything — candidate

As P3, I want all my documents, templates and settings in one file I can put
away, so a cleared browser profile doesn't take my work with it.

- "Back up" writes one archive: every document as Markdown with its images,
  own templates, custom chips, tuning and protected words.
- "Restore" reads it back and asks before it replaces a document that exists.
- The app says when the last backup was, without nagging.

Documents linked to a real file (3.1) are safe already. Everything else lives
only in IndexedDB, which the browser may clear.

### 3.9 Copy for where the text goes — candidate

As P2, I want to copy my finished text in the form its destination needs, so
a LinkedIn post or an e-mail arrives without Markdown signs or lost
formatting.

- "Copy as formatted text" (for mail and editors) and "Copy as plain text"
  (for LinkedIn and forms: lists as lines, no `#` or `**`).
- Block names, purposes and markers are never part of the copy.
- The whole document, or the selection if there is one.

The templates lead P2 to a finished post, and the last step out of the app
is missing. No new file format: DOCX and PDF stay out.

---

## Epic 4 — Privacy

### 4.1 Local only ✅

As P3, I want a guarantee that no text leaves localhost, so I can use Glossly
for work under NDA.

- The proxy only accepts local or private-network endpoints; there is no cloud code path.

### 4.2 Visible local-only guarantee ✅

As P3, I want to *see* the guarantee in the app, not just trust the README.

- A small indicator shows where requests go (e.g. "local · 127.0.0.1:8080").
- The indicator changes visibly if the endpoint isn't loopback (e.g. a LAN host).

Shipped in Phase 4 (#16), in the editor footer.

---

## Epic 5 — Setup (P4)

### 5.1 Any OpenAI-compatible endpoint ✅

As P4, I want to point Glossly at any OpenAI-compatible endpoint (or Ollama /
LM Studio) and pick a model from its list.

### 5.2 Clear message when the model is down ✅

As P4, I want a quiet, specific message when the model is down or still
loading, instead of an unexplained spinner.

- "Server not reachable" and "took too long" are separate, clear messages.
- A cold model load (llama-swap swapping models in) is recognised as loading, not reported as a failure.

Shipped in Phase 4 (#18): a model being loaded reads as "loading" and has its
own timeout.

### 5.3 Per-chip tuning ✅

As P4, I want to set temperature and a prompt template per chip, so Plainer
can be conservative and More vivid adventurous.

### 5.4 Know what a check costs before I click — #28, part of WP4

As P4, I want to see how long an analysis will take and that it swaps the
model, before I start it, so I don't evict a model another tool is using by
accident.

- The button says which model runs and roughly how long ("qwen38-27b, about 30 s").
- If that model is not the loaded one, it says a swap will happen.
- While it runs, a line counts the seconds, and "Cancel" stops the request
  on the server too.
- Afterwards the suggestion model is not reloaded until the next suggestion
  needs it.

The structure bench measured 33 s (segmentation) and 89 s (check) for 1 500
words on the 27b model. Waits of that length need saying up front.

---

## Epic 6 — Beginner writers (P5)

The rule for this epic: the beginner gets the *same* quiet margin note, made
easier to discover and understand. No second intelligence layer, no teaching
mode.

### 6.1 Discover the core gesture ✅

As P5, I want to find out that selecting text shows alternatives, without
reading a manual.

- An empty or new document shows a one-line hint ("Select a word or phrase to see alternatives").
- The hint disappears after the first successful suggestion and doesn't come back.

The empty-editor placeholder carries the hint until the first suggestion
arrives (`apps/web/src/editor/firstRunHint.ts`). The default document explains
the gesture too.

### 6.2 Chips that explain themselves ✅

As P5, I want to know what "Tighter", "More vivid" and "Plainer" will do
before I click them.

- Each chip has a short tooltip in plain words ("fewer words, same meaning").
- Tooltips work on keyboard focus too, not just hover.

Built-in chips have plain-word tooltips; custom chips show their own
instruction (`MarginNote.svelte`).

### 6.3 Works out of the box — partial, #17 (Backlog)

As P5, I want Glossly to work without knowing what an endpoint or a model is.

- If a known local server (Ollama, LM Studio, llama-swap) is running on its default port, it's picked up and a model is preselected.
- If none is found, the message says in plain words what to install, not "connection_refused".

**Today:** the endpoint and model are set by hand in Settings. P4 doesn't mind;
P5 stops here.

### 6.4 Start from something — ✅

As P5, I want a template for the kind of text I'm writing, so I'm not facing
an empty page.

- Starter templates: LinkedIn post, blog article, newsletter issue, cover letter, blank.

Extended in Phase 4: German and English versions, more kinds of text (#20),
and the writer's own templates (#21).

### 6.5 See what a suggestion changes ✅

As P5, I want to see *which* words a suggestion changes, so I learn by
comparing instead of just swapping blindly.

Same feature as 2.3; for P5 it's the main way to learn from the tool without
a teaching mode.

### 6.6 "This sentence feels off" — ✅ (1.5)

As P5, I want to hand over a whole clumsy sentence, because I often can't
point at the phrase that's wrong.

The opt-in sentence rewrite already covers this. P5 will use it far more often
than P1, which is fine as long as it stays opt-in.

### Deferred — not ruled out

Two beginner features stay open. They don't fit v1, but neither is a
non-goal forever. Each one can come in once its conditions are met.

#### 6.7 Grammar and spelling check — measured (#22), to be built with e2b

As P5, I want spelling, comma and grammar mistakes pointed out, because I
don't always see them myself.

Conditions before this becomes a real story:

- **Quiet by default.** It's opt-in (a toggle or an explicit "Check" action).
  It never shows red squiggles while the writer is typing.
- **Same interaction as today.** Findings show up as margin notes with an
  explicit click to apply. Nothing gets corrected automatically, and every
  fix is one undo step.
- **Measured first.** `docs/local-model-notes.md` shows the small local
  models fix German spelling and commas as well as gemma4-12b does (muß/dass,
  relative-clause commas). A fixed test set needs to confirm that across
  languages, with a false-positive rate low enough that the check doesn't
  turn into noise.
- **Spec update.** `specs.md` §1 lists "Not a grammar/spellchecker" as a v1
  non-goal. Adopting this story means changing that line on purpose.

**Measured 2026-10-03 (#22, numbers in `docs/local-model-notes.md`).**
gemma4-e2b-qat fixed 90 % (de) and 100 % (en) of the errors but changed 20 %
and 10 % of the correct sentences, so it missed the rule set in advance
(≤ 5 % false alarms). gemma4-12b passed in both languages at about 1 s per
sentence. Four of e2b's six false alarms touched text in quotation marks:
dialect and colloquial speech "corrected", twice the speaker tag dropped.

**Decision (the writer, 2026-10-03):** built anyway, with e2b — the misses
are small and e2b corrects well. It goes ahead under the conditions above,
plus two that answer the measurement:

- **Quoted speech is skipped.** Text inside quotation marks is not checked,
  which removes most of e2b's false alarms (dialect, colloquial speech, the
  dropped speaker tags).
- **Re-measured before it ships.** The first step is the same bench
  (`bench-grammar`) with the skipping in place; its numbers go next to the
  first run in `docs/local-model-notes.md`.

Not scheduled yet (#24, Backlog). The re-measurement is small and can run on
its own.

#### 6.8 Help notes — deferred

As P5, I want a short note on *why* a suggestion or a correction might be
better, so I learn something instead of just clicking.

Conditions before this becomes a real story:

- **Never an invented rule.** `docs/local-model-notes.md` shows the small
  models make up grammar rules when asked to explain, and a wrong explanation
  teaches a beginner something false. Help notes therefore start as fixed,
  human-written notes tied to known cases (chip meanings, common comma rules,
  das/dass, and so on). Model-written explanations come in only for a model
  that passes an explanation test set.
- **On request, not by default.** A small "why?" the writer can open. It
  never appears unasked next to every suggestion.
- **Short.** One or two sentences, still a margin note. If it needs more
  than that, it's a writing coach, which stays dropped.

### Out of scope

- **"Write the next paragraph for me."** Long-form drafting is a spec
  non-goal and would replace the writer's judgment.
- **Scoring or grading the writing.** That's the dropped "writing coach"; the
  readability numbers in the dashboard are as far as it goes.

---

## Epic 7 — The shape of a text (Phases 5 and 6)

Glossly so far works on how a sentence sounds. These stories are about how a
text is built: its parts, what each part is for, and their order. P1 needs
it for essays and long-form work, P2 for texts that follow a known pattern.

### 7.1 Units of meaning as blocks ✅

As P1, I want each unit of meaning in my text to be a block of its own,
optionally named, so I think in parts instead of in a wall of paragraphs.

- A block holds one or more paragraphs, headings, lists or quotes.
- I split a block at the cursor and merge it with the one before, from the keyboard.
- A name ("Einstieg", "These") is optional, shown quietly, never part of the text.
- Templates start as named blocks that match their structure guide.
- Markdown files keep the blocks without showing them in rendered Markdown.

### 7.2 Reorder without cut and paste ✅

As P1, I want to move a whole block to another place, so I can try a
different order of argument without cut and paste.

- The block moves as a whole, and one undo puts it back.
- It works from the keyboard (Alt+Shift+↑/↓), with a drag handle beside the
  block, in the outline and in the table of contents.

### 7.3 See the outline next to the text ✅

As P2, I want to see the parts of my text next to it, with what each part is
for, so I notice a missing or misplaced part before I polish sentences.

- The structure card lists the blocks by name (or first words) with their
  length, and the template's hint for each part.
- The table of contents groups its headings by block.

### 7.4 Say what a part is for — #26

As P1, I want to note in one sentence what each block must achieve, so I
have something to hold the block against when I revise it.

- The purpose shows under the block's name in the outline and is edited there.
- It moves with the block, and one undo takes an edit back.
- A document from a template starts with the template's hints as purposes.
- Markdown files keep it in the block's comment, and own templates keep it too.
- It is never part of the text and never exported as text.

### 7.5 Know how long a part may be — #27

As P2, I want a target length per block, so my hook stays a hook and the
whole post fits its format.

- The outline shows `42 / 80` per block and a total when a budget is set.
- More than 10 % over turns the number amber. Nothing is marked in the text.
- Templates bring a budget only where the genre sets one.

### 7.6 Get blocks for a text I bring in — #28

As P1, I want a text I wrote elsewhere to get blocks proposed, so I don't
have to cut a finished draft into parts by hand.

- "Find blocks" runs on a click, on a document that has no blocks of its own yet.
- The proposal is a preview: boundaries, names and purposes, all editable.
- Apply is one step and one undo, and not a character of the text changes.
- An answer from the model that doesn't cover the text in order is shown as
  an error, never half applied.

Measured: qwen38-27b passes segmentation on held-out. The names and a 12b
run are still open (roadmap, 6b). Needs 5.4.

### 7.7 Does my text hold together? — #29, gated

As P1, I want to see what each part of my text actually says, one line per
block, and where a part doesn't do what I wrote down for it, so I find the
break in the argument before a reader does.

- "Check structure" runs on a click and needs at least two blocks.
- Each block gets a one-line gist. Read top to bottom, that is the red thread.
- A block gets a verdict only against its own purpose (7.4), with one
  sentence of reason. A block without a purpose gets no verdict.
- A proposed move is a button, one step, one undo. No text is rewritten.
- A finding greys out when its block changes after the check.

**Gate:** no model passed the false-alarm rule on the tuning cases. If the
held-out run fails too, the verdicts are dropped and only the gist lines are
built, since they judge nothing (review suggestion, not decided).

### 7.8 See the skeleton — candidate

As P1, I want to fold blocks down to their name and first line, so I can see
the shape of a long text on one screen and reorder it there.

- Fold one block, or all of them with one key.
- A folded block still moves as a whole (7.2) and unfolds when the cursor enters it.
- Folding is a view. It is not saved to the file and changes no text.

### 7.9 Work on one part — candidate

As P1, I want the block I am writing in to stand out and the rest to step
back, so I revise one part without the others pulling at me.

- A switch dims every block except the one with the cursor.
- Suggestions, the outline and moving blocks work as usual.
- Off by default, and remembered per device.

---

## Recommended order for the candidates

From the 2026-11-16 review. The first four are basics a writer misses as soon
as a real manuscript lives in Glossly; the rest add comfort.

| Order | Story | Why here |
| --- | --- | --- |
| 1 | 3.6 Find and replace | the most-missed editor basic, small |
| 2 | 3.8 Back up everything | protects documents that are not linked to a file |
| 3 | 3.7 Named versions | makes block moves and "Find blocks" safe to try |
| 4 | 3.9 Copy for where the text goes | closes the template → finished post path for P2 |
| 5 | 1.8 Repeated words nearby | new way into the suggestion loop, no model |
| 6 | 7.8 See the skeleton | already listed as "later" in the Phase 6 plan |
| 7 | 7.9 Work on one part | cheap once blocks exist |
| 8 | 2.6 Protected words for a series | only with multi-document projects |
| 9 | 1.9 Hear the sentence | needs the local-voice check first |

---

## Open questions

- **Is P2 a real target user?** The LinkedIn and cover-letter templates and
  the AI-likeness detector serve the deadline writer, but the spec's vision
  (`specs.md` §1–2) only describes P1. Either add P2 to the spec, or treat
  these features as extras that shouldn't grow further.
- **The AI-likeness detector is close to the "Dropped" list.** It judges the
  writing instead of offering options, which is near what the roadmap cut as
  "writing coach". Being on-demand makes it defensible, but it is exactly the
  kind of feature that grows. New stories that extend it should be checked
  hard against the filter.
- **Features shipped without a story.** The German readability index, the
  treatment plan and the rhythm strip (October 2026) have no story here. They
  are on the roadmap under *Shipped outside a phase*. If they are to grow,
  they need stories and a persona first.
- **Decided: P5 doesn't change the vision.** P5 is a secondary user served by
  discoverability (Epic 6). `specs.md` §1 stays as it is for now. Grammar
  checks (6.7) and help notes (6.8) are deferred rather than ruled out, and
  they come in under the conditions listed there.
