# Phase 4 (v1.4) — Implementation Plan

Self-contained plan for the Phase 4 features in
`docs/next-iteration-features.md` (#16–#22), split into one housekeeping
package, six work packages, and one pinned research phase. Written for an
implementing agent with no prior context on this repository. Read this whole
document before starting.

`docs/plans/phase-1-v1.1.md` covers the repository layout and the suggestion
pipeline, `phase-2-v1.2.md` the storage layer (IndexedDB, files, blobs), and
`phase-3-v1.3.md` the prompt and margin note as they are today.

## What Phase 4 is actually for

Phases 1–3 made the suggestion loop fast and good — for a writer who already
has a model server running, configured, warm, and trusts what Glossly does
with the text. Phase 4 closes the gaps around that loop, all of them open
stories in `docs/user-stories.md`:

- **Waiting** (P4, P5): a cold model load reads as "loading", not as a
  failure (5.2). Finding the server by itself (6.3) moved to Phase 5.
- **Trust** (P1, P3): the app shows where the text goes (4.2), and words the
  writer protects never change in a suggestion (2.4).
- **Starting points** (P2, P5): templates in German and English, more kinds
  of text, and the writer's own templates.
- **One measurement**: whether a small local model can check grammar without
  crying wolf (6.7) — measured, not built.

None of this adds an intelligence layer. Every package either removes a
reason to leave the writing flow or makes the existing loop more
trustworthy.

## Key files

| File | Role |
| --- | --- |
| `packages/shared/src/index.ts` | API contract and limits — **one file, erasable syntax only** (see its header) |
| `apps/server/src/util/validate.ts` | `validateLocalBaseUrl` (private-host regex), request field parsers |
| `apps/server/src/routes/suggest.ts` | `/api/suggest`, `/api/modifiers`; SSE via `sendEvent` |
| `apps/server/src/providers/openaiCompatible.ts` | upstream calls, idle timeout (`resetIdleTimer`), `sawReasoning` |
| `apps/server/src/providers/prompt.ts` | `buildMessages` |
| `apps/web/src/providers/client.ts` | request bodies, SSE parsing |
| `apps/web/src/note/requestSuggestions.ts` | request flow, cache/dedupe keys |
| `apps/web/src/components/MarginNote.svelte` | margin note UI |
| `apps/web/src/components/SettingsPanel.svelte` | settings (**legacy, non-runes component** — see ground rules) |
| `apps/web/src/components/DocumentMenu.svelte` | document list, file actions |
| `apps/web/src/components/Editor.svelte` | template picker (`STARTER_TEMPLATES`, around line 700) |
| `apps/web/src/editor/templates.ts` | starter templates |
| `apps/web/src/storage/db.ts` | IndexedDB schema (`DB_VERSION = 1`), `DocMeta` |
| `apps/web/src/storage/imageStore.ts` | blob storage, `collectImageGarbage` (blobs are owned per `docId`) |

## Ground rules

1. **Local-only is a hard guarantee.** The llama-swap probe in WP3 only asks
   the endpoint the writer configured, which the proxy has already
   validated. No telemetry, no CDN assets.
2. **Do not change the writer's llama-swap config.** `~/llama-swap-config/config.yaml`
   also serves Hermes, OpenCode and Pi. In particular, do not turn on
   `sendLoadingState` globally (WP3) — it injects text into every client's
   reasoning stream.
3. **Never re-add `enable_thinking` or `reasoning_effort`.** See the comment
   above `NO_THINKING` in `openaiCompatible.ts`.
4. **The server validates everything the client sends**, and every new limit
   lives in `@glossly/shared` so both sides check the same number.
5. **Shared package stays one file of erasable syntax** (no enums, no
   namespaces, no relative imports). The built server loads it through
   Node's type stripping.
6. **Svelte:** new components use runes. Do not add `$state`/`$derived` to a
   legacy component (`SettingsPanel.svelte`, check others with the compiler)
   — it flips the whole component into runes mode and plain `let` bindings
   start warning. Put new UI into its own component, as `TuneChips.svelte`
   does. Run `npx svelte-check --threshold warning` in `apps/web` after
   every Svelte change.
7. **Verify before every commit:** `npm test` and `npm run build` from the
   root, plus `npx tsc --noEmit` in `apps/server` whenever you touched it.
8. **Browser checks run headless** (playwright-core in the scratchpad against
   `/usr/bin/google-chrome` + `vite preview` on a spare port, `/api/*` mocked
   with `page.route`). Do not touch the writer's dev servers on :3000 /
   :5173. Stop test servers by PID — `pkill -f <pattern>` kills its own
   shell when the pattern is in the command line.
9. **Template texts are reviewed by the writer before they are committed**
   (WP5). Show them, wait for the go-ahead.
10. **One commit per work package**, in order.

## Work package order and dependencies

```
WP0 Phase 3 close-out
WP1 Local indicator      (done)
WP2                      moved to Phase 5
WP3 Cold start
WP4 Protected words
WP5 Templates: languages, kinds, rewrite ──> WP6 Own templates
WP7 Grammar-check measurement            (independent; needs a free GPU)
```

Do them in numeric order. WP4 and WP7 are independent and can move if a
dependency blocks.

---

## WP0 — Phase 3 close-out

Small, one commit.

1. `README.md` feature list: add context extraction, comparison view,
   "Earlier" history, chip tuning.
2. `fetchSuggestions` (non-streaming) in `apps/web/src/providers/client.ts` has
   no caller left. Delete it; keep `suggestBody` and `errorBody`.
3. Still open from Phase 2: the File System Access permission prompt has
   never been tested in a real (headed) Chrome. Write the manual steps into
   the WP0 commit message's body as a checklist and ask the writer to run
   them — the prompt cannot be automated.

---

## WP1 — Visible local-only indicator (#16, story 4.2)

**Goal:** the writer sees where the text goes, at a glance, and notices when
it is not this computer.

### Design

Move the host classification out of `validateLocalBaseUrl` into
`@glossly/shared`:

```ts
export type HostKind = 'loopback' | 'private';
/** null for anything that is neither — the proxy rejects those. */
export function classifyHost(baseUrl: string): HostKind | null;
```

The server keeps rejecting `null`; the client uses the kind for display.
(This is the first *function* in the shared package — still erasable
syntax, still one file.)

A small status line in the editor footer, next to the word count:

- `● local · 127.0.0.1:8080 · gemma4-e2b-qat` — loopback, neutral colour.
- `● network · 192.168.1.20:8080 · …` — private LAN host, warning colour,
  tooltip "Your text leaves this computer but stays in your network."
- `● invalid endpoint` — error colour; suggestions will fail anyway.

Clicking it opens Settings. It shows the **endpoint**, not the proxy: the
proxy always runs on this machine, the endpoint is where the text ends up.

### Tests

`classifyHost`: `localhost`, `127.0.0.1`, `127.1.2.3`, `[::1]` → loopback;
`10.x`, `172.16–31.x`, `192.168.x` → private; `172.32.0.1`,
`localhost.example.com`, `127.0.0.1.nip.io`, `ftp://127.0.0.1`, garbage →
null. The existing `validateLocalBaseUrl` tests must pass unchanged.

### Acceptance criteria

- Default settings show "local · 127.0.0.1:8080"; switching the endpoint to a
  192.168 address switches colour and label immediately.
- Light and dark mode both readable.

---

## WP2 — moved to Phase 5

Finding the local server (#17, story 6.3) moved to Phase 5 at the writer's
request. Its design is kept there, below the web-app questions it depends
on. The WP numbers here stay as they are, so commit messages keep matching
this plan.

---

## WP3 — Cold start reads as loading (#18, story 5.2)

**Goal:** the first request after a model switch shows "loading" and then
the suggestions, instead of "The local model took too long to respond."

### Measure first

Before writing code, record on llama-swap (v262 at the time of writing):

1. `curl -X POST http://127.0.0.1:8080/unload`, then one streamed suggestion
   request. Note: when do response headers arrive, when the first body byte,
   when the first content token? What does `/running` report during the
   load (`starting`?)
2. The same for one larger model, to know the range (seconds, not minutes?).

Put the numbers in the WP3 commit message. They decide the default load
timeout below.

### Design

- **Two timeouts instead of one.** Today `resetIdleTimer` runs from the
  start, so a load longer than `settings.timeout` (10 s) fails. New: a
  *load timeout* until the first upstream body byte (default from the
  measurement, likely 120 s, constant in shared), then the existing idle
  timeout between chunks. A stall *after* the first byte still fails fast.
- **Status event.** If no body byte has arrived after 1.5 s, the server
  sends `event: status` with `{ state: 'waiting' }`. It then asks the
  endpoint's origin for llama-swap's `/running` once (short timeout; any
  non-llama-swap answer just means "unknown", cached per origin) and sends
  `{ state: 'loading', model }` when the model is `starting`. Keep this
  probe a small function of its own: Phase 5's server discovery will
  reuse it. Add the
  event to `SuggestStreamEvents` in shared.
- **Margin note:** "Loading gemma4-e2b-qat… the first request after a model
  switch can take a while" with elapsed seconds; Esc still cancels.
- **`sendLoadingState` tolerance.** Glossly does not need it, but a writer
  may have it on. llama-swap then streams loading messages as
  `reasoning_content`, which today sets `sawReasoning` and would turn an
  empty answer into the misleading "used up its token limit while thinking".
  Treat reasoning deltas that arrive before the model's first real chunk as
  liveness only. Verify against a llama-swap instance with the option on —
  a **separate** test config on a spare port, never the writer's config.

### Tests

A local fake upstream (`node:http`) that delays its first byte by 3 s with
`settings.timeout` = 1 s: no timeout, a `waiting` status event, then the
suggestions. Fake `/running` reporting `starting` → `loading` event. A
stall after the first byte still times out at the idle timeout.

### Acceptance criteria

- After `/unload`, a suggestion request shows the loading note and then
  suggestions; never "took too long".
- A real stall after the first byte still fails within `settings.timeout`.

---

## WP4 — Protected words (#19, story 2.4)

**Goal:** names, invented terms and deliberate repetitions never change in a
suggestion, and the writer sees it when the model tries anyway.

### Design

- **Storage:** `DocMeta.protectedTerms?: string[]` — per document, in
  IndexedDB metadata. No schema version bump (an optional field on an
  existing record). Limits in shared: 30 terms, 40 characters each.
- **What is sent:** only the terms that occur in the *selection*
  (case-sensitive, whole word) — the suggestion replaces only the selection,
  and a short list keeps the prompt small. Request field `protectedTerms`,
  validated server-side, part of the cache and dedupe keys.
- **Prompt:** one line near the style instruction: `Keep these words exactly
  as written: «Anna», «Quellwerk».`
- **Check:** a suggestion that drops a protected term from the selection is
  **flagged, not hidden** — dimmed, with "changes «Anna»" under it. Still
  applicable by click and Alt+1–3: the writer decides, nothing is hidden.
  The same check applies to "Earlier" entries.
- **UI:** a "Protect" chip in the margin note when the selection is a single
  word or short term (≤ 40 characters, no sentence punctuation), adding it
  to the document's list. "Protected words…" in the document menu to view
  and remove entries.
- **Limitation, documented:** the list lives in IndexedDB, not in the
  Markdown file. Opening the same file in another browser profile starts
  without it.

### Measure

Bench with e2b (same harness as Phase 3, `apps/web/scripts`): selections
containing a name or invented term, 10 rounds each, with and without the
prompt line. Record how often the term changes. The flag is the safety net
either way; the numbers go into the commit.

### Tests

Server: validation (too many, too long, wrong type); prompt line present
only when terms are sent. Web: which terms are sent for a selection; flag
logic (case, whole word, term appearing twice); keys change with the terms.

### Acceptance criteria

- Protect "Anna", select a phrase with "Anna": the request carries it, a
  suggestion without "Anna" is flagged.
- The list survives a reload and is per document.

---

## WP5 — Templates in two languages, more kinds, better texts (#20)

**Goal:** a German- or English-writing user finds a starting draft for the
kind of text they are writing, and the draft is real prose Glossly can work
on.

### Design

- **Structure:** `apps/web/src/editor/templates/` — one module per language
  (`en.ts`, `de.ts`) with the same template ids, plus an index that pairs
  them. A test enforces that both languages have the same set.
- **Language choice:** a DE | EN switch in the template picker. Default from
  `navigator.language` (`de*` → German), remembered in settings.
- **Kinds** (each in both languages):
  - existing, rewritten: LinkedIn post, blog article, newsletter issue,
    cover letter
  - new: business e-mail, short story / scene (for P1 — fiction has no
    starting point today), essay, meeting notes
  - blank page
- **Rewrite rules** — the header comment of `templates.ts` already states
  the principle; enforce it: real sentences, no `[placeholder]` slots (the
  cover letter breaks this today), prose with something to select. German
  texts are written as German, not translated: cover letter and e-mail in
  formal "Sie" with German conventions, LinkedIn post in the "du" common on
  German LinkedIn. That also exercises the Phase 3 address hint.
- The picker groups the list (Work: e-mail, cover letter, meeting notes —
  Publishing: LinkedIn, blog, newsletter, essay — Fiction: scene) so nine
  entries stay scannable.

### Process

Write all texts, then show them to the writer for review **before** wiring
them in (ground rule 9). Expect a round of edits.

### Tests

Both languages have the same ids; no template contains `[` … `]` slots;
every template parses into the editor schema (Markdown round-trip helper
from Phase 2); `detectAddress` on the German cover letter and e-mail →
`Sie`, on the German LinkedIn post → `du`.

### Acceptance criteria

- With a German browser the picker opens in German; switching to EN shows
  the English set; the choice is remembered.
- Every template, once inserted, gives sensible suggestions on its first
  paragraph (spot-check with e2b).

---

## WP6 — Own templates (#21)

**Goal:** a writer who has a structure they reuse can save it as a template.

### Design

- **Storage:** a `templates` object store → `DB_VERSION = 2`.
  `onupgradeneeded` today creates all stores unconditionally; it must branch
  on `event.oldVersion` so an existing v1 database keeps its data and only
  gains the new store.
- **Images are the trap.** Blobs are owned per `docId`
  (`collectImageGarbage(docId, html)` deletes a document's unreferenced
  blobs, and deleting a document deletes them all). A template that merely
  pointed at a document's blobs would lose its images when the source
  document changes or is deleted. Saving a template therefore **copies** the
  blobs under the template's own owner id (`template:<id>`), and creating a
  document from a template copies them again under the new document's id.
- **UI:** "Save as template…" in the document menu (name prompt). In the
  picker, a "Your templates" group above the built-ins, with rename and
  delete. Own templates have no language and show in both.

### Tests

With `fake-indexeddb` (as `db.test.ts` does): upgrade from a populated v1
database keeps documents, metadata and blobs; template CRUD; a template's
images survive deleting the source document; a document created from a
template owns its own blob copies.

### Acceptance criteria

- Save a document with an image as a template, delete the document, create
  a new document from the template: text and image are there.
- A database created by v1.3 opens in v1.4 with everything intact.

---

## WP7 — Grammar check: measure, don't build (#22, story 6.7)

**Goal:** a decision, backed by numbers, on whether a grammar and spelling
check with a small local model would help or just make noise. No feature
code in this package.

### Test set

`apps/web/scripts/grammar-bench/cases.json`, German and English, about 60
sentences per language:

- ~40 with exactly one known error, tagged by category: spelling, das/dass,
  comma (relative clause, infinitive), agreement, capitalisation; each with
  the expected correction.
- ~20 correct sentences, including the hard ones: deliberate fragments,
  dialect or slang in dialogue, names and invented words, correct "dass",
  Swiss "ss".

### Run

A bench next to the existing one (`npx vitest run --config
scripts/vitest.bench.config.ts`): JSON-schema answer `{ corrected }`,
`NO_THINKING`, temperature 0. Models: `gemma4-e2b-qat` (the default),
`lfm2-exp-2.6b`, and `gemma4-12b` as the reference. Needs the GPU free of
other work — check `nvidia-smi` first.

Per model and language: **recall** (error fixed exactly), **false-positive
rate** (any change to a correct sentence), **collateral** (other words
changed while fixing the error), latency.

### Decision rule — fixed now, before the numbers exist

The feature becomes a real story only if e2b reaches, in **both**
languages, a false-positive rate ≤ 5 % and recall ≥ 80 %. Otherwise it stays
deferred. Either way, the numbers go into `docs/local-model-notes.md` and the
outcome into story 6.7.

---

## Pinned: Phase 5 — Glossly as a web app (#23)

Decided with the writer: Glossly should become a **web app**, not a Tauri
desktop app (#15 is replaced). Phase 5 starts by *finding the ways to do
it*; it gets its own plan once the options are clear. Questions that plan
has to answer:

- **Reaching the local model without the Express proxy.** A page served from
  an https origin calling `http://127.0.0.1:8080` directly: mixed-content
  rules (loopback counts as potentially trustworthy), Chrome's Local Network
  Access permission prompt, and CORS on each server (Ollama
  `OLLAMA_ORIGINS`, LM Studio's CORS switch, llama-swap). What the proxy does
  today and where it would go: base-URL validation, timeouts and the WP3
  load handling, SSE re-framing, the incremental JSON parsing.
- **Or keep the proxy** as an optional local companion for features a page
  cannot do alone.
- **PWA.** An installed PWA opens in its own window — the "no browser tab"
  that Tauri was meant to give — while keeping the File System Access API
  that Tauri's WebKitGTK lacks. Also offline caching and the File Handling
  API ("open .md with Glossly").
- **Hosting and the privacy promise.** Static hosting only, no analytics,
  and what "nothing leaves the machine" means when the app itself is
  downloaded from a server. Self-hosting as an option.

Deliverable of Phase 5's first step: a short comparison of the options and
one spike that proves the riskiest path (likely: direct browser → llama-swap
with streaming).

### Moved from Phase 4: find the local server (#17, story 6.3)

Designed for the Phase 4 architecture, where the Express proxy does the
probing. If Phase 5 drops the proxy, the browser has to probe instead —
subject to the same CORS and local-network-access questions as above — so
settle those first, then adapt this design. WP3's llama-swap probe is meant
to be reused here.

**Goal:** a first-time user with Ollama, LM Studio or llama-swap running gets
working suggestions without opening Settings.

#### Design

`GET /api/discover` on the proxy probes a **fixed** list, in parallel, 800 ms
timeout each:

| Candidate | Probe | Identified as |
| --- | --- | --- |
| `http://127.0.0.1:8080` | `GET /api/version` → JSON with `version`; `GET /running` | llama-swap |
| `http://127.0.0.1:8080` | `GET /v1/models` (no llama-swap answer) | llama.cpp server |
| `http://127.0.0.1:11434` | `GET /api/version` | Ollama |
| `http://127.0.0.1:1234` | `GET /v1/models` | LM Studio |

Local-only, as everywhere: only this fixed list of loopback addresses —
never a client-supplied host, never a port scan.

Response (`DiscoveredServer[]` in shared): `{ kind, provider, baseUrl,
models, loaded? }`, where `loaded` is the llama-swap model currently in state
`ready` (from `/running`).

**Model preselection** (pure function, client): keep the current model if the
server lists it; else the llama-swap model that is already loaded (no cold
start, no VRAM swap); else the only model; else the first, and say so.

**When it runs:**

- On first start — no `glossly-settings` in localStorage yet.
- From a "Find local server" button in Settings.
- From the margin note when a request fails with `connection_refused`: the
  error offers the same search.

**Nothing found:** a plain message, no jargon: "No local model server found.
Glossly needs one running on this computer — for example Ollama
(ollama.com). Start it, then search again."

Discovery only ever *suggests* settings when the writer already has some:
the first-start run applies the result, every later run shows it and asks.

#### Tests

Server: `discover()` with `fetch` stubbed per URL — each server kind, a mix,
all down, a slow one past the timeout, a non-JSON answer on 8080. Client:
preselection cases.

#### Acceptance criteria

- On this machine with a fresh browser profile: Glossly picks llama-swap on
  :8080 and the model already loaded, and the first suggestion works without
  touching Settings.
- With the candidate list pointed at closed ports (inject it in the test),
  the plain message appears.
- No probe ever goes to a host outside the fixed list (assert on the stub).

---

## Final verification checklist

- [ ] `npm test` — all workspaces green
- [ ] `npm run build` and `npx tsc --noEmit` in `apps/server`
- [ ] After `/unload`: loading note, then suggestions
- [ ] Protected word flagged when a suggestion drops it
- [ ] Templates reviewed by the writer; DE/EN switch remembered
- [ ] v1.3 database opens in v1.4 intact; template images survive deleting
      the source document
- [ ] Grammar bench numbers in `docs/local-model-notes.md`, decision in
      story 6.7
- [ ] Margin note, footer indicator and template picker readable in light
      and dark mode
- [ ] `README.md`, `docs/next-iteration-features.md` and
      `docs/user-stories.md` updated to shipped
- [ ] One commit per work package, messages explaining the why
