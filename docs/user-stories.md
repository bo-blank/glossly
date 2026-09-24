# Glossly — User Stories

Stories for the quiet writing copilot, grouped by epic. Each one is checked
against the roadmap filter in `docs/next-iteration-features.md`: does it make
the phrase-suggestion loop faster, more trustworthy, or less disruptive to
writing flow?

Status legend:

- ✅ — shipped
- **#n** — covered by roadmap item n (`docs/next-iteration-features.md`)
- **gap** — not on the roadmap yet
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

### 1.6 Earlier alternatives — #12

As P1, I want to get back alternatives I saw earlier for the same selection,
because the second batch often makes me want the first one back.

- Alternatives are kept per selection for the whole session.
- Going back to an earlier batch doesn't hit the model again.

### 1.7 Suggestions that know the chapter — #11

As P1, I want suggestions that fit the chapter I'm in, not just the
neighbouring paragraph.

- The request includes the document title, the nearest heading and neighbouring paragraphs, within a fixed token budget.

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

### 2.3 Word-level comparison — #14

As P1, I want to compare my original and each suggestion word by word before
committing, because the difference is often a single word.

- Changed words are highlighted in each suggestion.

### 2.4 Protected words — gap

As P1, I want some words — character names, invented terms, a deliberate
repetition — to never be changed in suggestions.

- Each document has a "keep" list the writer can edit.
- Words on the list are passed to the model as must-keep terms.
- If a suggestion changes a protected word anyway, it's hidden or flagged.

Fits the filter (trustworthy) and is cheap: one list per document plus one
prompt line. Depends on Phase 2 (#7) for per-document storage.

### 2.5 Suggestions in my language and register — partial

As a German-writing user, I want suggestions in the language of my text and in
the same register (Sie/du).

- Suggestions are in the same language as the selection.
- The register of the context (formal/informal address) is kept.

**Today:** the system prompt (`apps/server/src/providers/prompt.ts`) is in
English and asks to match "tone, register, and rhythm", but never says to
answer in the selection's language — the model has to infer it. Model tests
in `docs/local-model-notes.md` were done in German and look fine, but nothing
enforces it. Fix: one explicit prompt line, plus a German prompt fixture in the
tests.

---

## Epic 3 — A manuscript I can trust (Phase 2)

### 3.1 Real files — #8, #9

As P1, I want my manuscript saved as a real `.md` file in my own folder, so it
survives browser resets and works with my backups and git.

- Open and save go through the File System Access API.
- Markdown round-trips without loss: headings, lists, blockquotes, code, images, links.

### 3.2 No storage cliff — #10, Phase 2 WP3

As P1, I want to paste images without the document quietly hitting a storage
limit.

- Images are stored as blobs in IndexedDB, not base64 in localStorage.
- A quota error is shown explicitly, never swallowed.

### 3.3 One document per piece — #7

As P2, I want several documents, one per piece, so I don't overwrite last
week's newsletter.

- Create, rename, delete and switch documents from a simple list.

### 3.4 Crash recovery — #10

As any writer, I want to lose at most a few seconds of work after a crash or
a closed tab.

- Autosave runs within seconds of the last edit.
- Reopening the app restores the last autosaved state.

---

## Epic 4 — Privacy

### 4.1 Local only ✅

As P3, I want a guarantee that no text leaves localhost, so I can use Glossly
for work under NDA.

- The proxy only accepts local or private-network endpoints; there is no cloud code path.

### 4.2 Visible local-only guarantee — gap

As P3, I want to *see* the guarantee in the app, not just trust the README.

- A small indicator shows where requests go (e.g. "local · 127.0.0.1:8080").
- The indicator changes visibly if the endpoint isn't loopback (e.g. a LAN host).

Cheap, and it directly supports trust.

---

## Epic 5 — Setup (P4)

### 5.1 Any OpenAI-compatible endpoint ✅

As P4, I want to point Glossly at any OpenAI-compatible endpoint (or Ollama /
LM Studio) and pick a model from its list.

### 5.2 Clear message when the model is down — partial

As P4, I want a quiet, specific message when the model is down or still
loading, instead of an unexplained spinner.

- "Server not reachable" and "took too long" are separate, clear messages.
- A cold model load (llama-swap swapping models in) is recognised as loading, not reported as a failure.

**Today:** the server already tells `connection_refused` apart from `timeout`
and has a friendly "Is the local server running?" message. What's missing is
the cold-start case: llama-swap sends no bytes while it loads a model, so a
slow load trips the idle timeout and looks like "The local model took too long
to respond."

### 5.3 Per-chip tuning — #13

As P4, I want to set temperature and a prompt template per chip, so Plainer
can be conservative and More vivid adventurous.

---

## Epic 6 — Beginner writers (P5)

The rule for this epic: the beginner gets the *same* quiet margin note, made
easier to discover and understand. No second intelligence layer, no teaching
mode.

### 6.1 Discover the core gesture — gap

As P5, I want to find out that selecting text shows alternatives, without
reading a manual.

- An empty or new document shows a one-line hint ("Select a word or phrase to see alternatives").
- The hint disappears after the first successful suggestion and doesn't come back.

### 6.2 Chips that explain themselves — gap

As P5, I want to know what "Tighter", "More vivid" and "Plainer" will do
before I click them.

- Each chip has a short tooltip in plain words ("fewer words, same meaning").
- Tooltips work on keyboard focus too, not just hover.

### 6.3 Works out of the box — partial

As P5, I want Glossly to work without knowing what an endpoint or a model is.

- If a known local server (Ollama, LM Studio, llama-swap) is running on its default port, it's picked up and a model is preselected.
- If none is found, the message says in plain words what to install, not "connection_refused".

**Today:** the endpoint and model are set by hand in Settings. P4 doesn't mind;
P5 stops here.

### 6.4 Start from something — ✅

As P5, I want a template for the kind of text I'm writing, so I'm not facing
an empty page.

- Starter templates: LinkedIn post, blog article, newsletter issue, cover letter, blank.

### 6.5 See what a suggestion changes — #14

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

#### 6.7 Grammar and spelling check — deferred

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
- **Decided: P5 doesn't change the vision.** P5 is a secondary user served by
  discoverability (Epic 6). `specs.md` §1 stays as it is for now. Grammar
  checks (6.7) and help notes (6.8) are deferred rather than ruled out, and
  they come in under the conditions listed there.
