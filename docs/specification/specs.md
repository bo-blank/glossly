# Glossly — Product & Technical Spec (v0.1)

*A quiet copilot for writers who already have an ear for sound and structure.*

Working title: **Glossly**. This is the living source-of-truth spec for the product and its architecture.

---

## 1. Vision

Most AI writing tools are built for people who need help getting words on the page, or who need grammar corrected. Glossly is built for the opposite case: writers who already know what they want to say and how they want it to sound, and who want a fast, low-friction way to audition alternative phrasings for a word, clause, or sentence — without breaking their flow or handing the sentence over to be rewritten wholesale.

**Core metaphor:** a margin note from a trusted editor, not a red pen and not a chat window.

**Non-goals (for v1):**
- Not a grammar/spellchecker (Grammarly's territory).
- Not a full-sentence/paragraph rewriter by default (DeepL Write's territory) — full rewrites are an opt-in, not the default behavior.
- Not a long-form drafting assistant ("write me a paragraph about X").
- Not multiplayer/collaborative editing in v1.

---

## 2. Target user

Writers — fiction, essays, newsletters, literary nonfiction, poetry-adjacent prose — who:
- Have a strong internal sense of rhythm, register, and voice.
- Want tactical help tightening, varying, or elevating specific words and phrases.
- Are usually mid-flow when they reach for this, so **latency and interface noise are the enemy**.
- Skew privacy-conscious and don't want their manuscript sent to any cloud API — hence the local-only requirement (see §6).

---

## 3. Core interaction

1. Writer selects a word, phrase, or sentence in the editor (3–220 characters).
2. A note opens near the selection — in the right-hand margin on wide viewports, as a small popover on narrow ones — connected to the selected text by a thin leader line.
3. The note shows a short loading state, then 3 alternative phrasings drawn from the surrounding context (not just the selection in isolation).
4. The writer can:
   - Click a suggestion to swap it in immediately.
   - Click a modifier chip (**Tighter**, **More vivid**, **Plainer** — extensible) to re-request with a different instruction, without re-selecting.
   - Dismiss with `Esc`, a click outside, or by selecting something else.
5. No suggestion is ever applied without an explicit click. Nothing is rewritten automatically.

### Interaction principles
- **Local, not global.** Suggestions default to word/phrase-level, not full-sentence rewrites, unless the writer explicitly widens the selection or asks for a full rewrite.
- **Context-aware, not context-dependent.** Send surrounding paragraph(s) as context so suggestions match tone, but never suggest changes outside the selection.
- **Cancelable.** A new selection immediately supersedes any in-flight request; stale responses must never overwrite a newer note.
- **Reversible.** Every swap should be trivially undoable (native `Cmd/Ctrl+Z` should just work — this has architectural implications, see §7.3).

---

## 4. Feature scope

### v1 (prototype)
- [ ] Plain-text / lightly-formatted editor (paragraphs, bold, italic — no tables, images, etc.)
- [ ] Selection → margin note → 3 alternatives
- [ ] Modifier chips: Tighter, More vivid, Plainer
- [ ] Click to swap, with undo support
- [ ] Provider switcher: local only (Ollama / LM Studio / any OpenAI-compatible endpoint)
- [ ] Settings panel: provider, model, endpoint URL, optional API key, request timeout
- [ ] Local persistence of the document (localStorage or file system, no account/server required)

### v1.1 (fast follow, not blocking prototype)
- [ ] Full-sentence rewrite mode (explicit opt-in, e.g. long-press or a keyboard modifier)
- [ ] Custom modifier chips (writer defines their own, e.g. "more Didion")
- [ ] Response caching per selection+modifier hash, to make repeated hovers instant
- [ ] Streaming suggestions (render the first alternative as soon as it's ready rather than waiting for all 3)
- [ ] Keyboard-only flow (no mouse required to select / apply)

### Explicitly out of scope for now
- Multi-document / project management
- Collaboration or sharing
- Mobile native apps (responsive web is enough for the prototype)
- Any telemetry/analytics beyond local debugging

---

## 5. UX & visual direction

- **Layout:** centered manuscript column (~640px), generous margins, right-hand rail reserved for notes on wide viewports; popover fallback below 900px.
- **Typography:** literary serif for manuscript body (e.g. Newsreader), plain grotesque sans for UI chrome (e.g. Public Sans). Avoid generic "AI product" defaults (cream + terracotta, near-black + neon accent, broadsheet hairlines) unless deliberately chosen.
- **Color:** paper background, ink-black text, a single quiet accent color for the note/leader-line (an editorial teal/forest green rather than the ubiquitous orange/terracotta AI-tool accent).
- **Motion:** minimal. A note fades/slides in over ~150ms; a swapped phrase gets a brief highlight that fades over ~1.5s so the writer can see what changed, then disappears. No decorative animation.
- **Empty/error states:** in the note's own quiet voice ("Couldn't reach the model — try again"), never apologetic, never blocking the rest of the editor.

---

## 6. Local LLM requirement — architectural implications

This is a first-class requirement, not an add-on: the target writer is privacy-conscious about sending unpublished manuscript text to a cloud API, so Glossly is **local-only by design** — there is no cloud provider and no code path that can send document content off-machine (see §6.4).

### 6.1 Provider abstraction

Define a single interface every provider must implement:

```ts
interface LLMProvider {
  id: string;                 // "ollama" | "lmstudio" | "openai-compatible"
  label: string;              // shown in settings UI
  listModels(): Promise<string[]>;
  getSuggestions(input: SuggestionRequest): Promise<string[]>;
}

interface SuggestionRequest {
  selectedText: string;
  context: string;            // surrounding paragraph(s), trimmed to a token budget
  modifier?: "tighter" | "vivid" | "plain" | string; // string allows custom chips later
  model: string;
  signal: AbortSignal;         // for cancellation on new selection
}
```

All providers must:
- Return **exactly 3 alternatives** (or a documented variable count if the modifier requests otherwise) as a plain string array — no markdown, no preamble.
- Respect `AbortSignal` so stale requests can be canceled client-side.
- Fail loudly and specifically (timeout vs. connection refused vs. bad response) so the UI can show a precise, non-alarming error in the note.

### 6.2 Concrete providers

| Provider | Transport | Notes |
|---|---|---|
| **Ollama (local)** | `POST http://localhost:11434/api/chat` or its OpenAI-compatible `/v1/chat/completions` | Default local option. |
| **LM Studio (local)** | OpenAI-compatible `POST http://localhost:1234/v1/chat/completions` | Same shape as Ollama's compatibility layer. |
| **Generic OpenAI-compatible (local or self-hosted)** | Configurable base URL + optional key | Covers llama.cpp server, vLLM, LocalAI, etc. without bespoke code. |

One implementation, `OpenAICompatibleProvider` (parameterized by base URL + optional API key), covers all three. The optional API key exists for self-hosted OpenAI-compatible servers that sit behind auth, not for a cloud vendor.

### 6.3 CORS / local networking

Browsers calling `localhost:11434` directly from a hosted web page get blocked by CORS unless the local server is configured to allow it. Glossly ships a thin Node/Express local proxy (`apps/server`) that the browser talks to instead of the LLM endpoint directly — this solves CORS uniformly and gives one place to implement cancellation, retries, and timeouts. A native desktop shell (Tauri/Electron) would sidestep CORS entirely and is worth revisiting if "runs fully offline, nothing leaves your machine" becomes a marketing claim rather than an implementation detail (see §10).

### 6.4 Privacy default

The app should make **zero network calls outside localhost** — no analytics, no telemetry, no update checks that include document content. This should be true by construction (no code path exists to send manuscript text anywhere but the configured local endpoint), not just a policy.

---

## 7. Technical architecture

### 7.1 Stack

- **Frontend:** Vite + Svelte + TypeScript.
- **Editor:** [Tiptap](https://tiptap.dev) (ProseMirror-based), via its official Svelte bindings — gives a real document model with position mapping (`Mapping`) and view-only decorations, both needed for async suggestion resolution and the ephemeral swap-highlight effect.
- **State:** Svelte's built-in stores (`writable`/`derived`).
- **Local proxy backend:** Node + Express, `/api/suggest` (and `/api/ai-likeness`, `/api/models`) dispatching to the configured `LLMProvider`.
- **Persistence:** Browser `localStorage`. No account system, no server-side storage.
- **Styling:** Plain CSS with custom properties, keeping the token system (paper/ink/accent/rule from §5) centralized.

### 7.2 Repo structure (current)

```
glossly/
├── README.md
├── package.json                 ← workspace root
├── apps/
│   ├── web/                     ← Vite + Svelte + TS frontend
│   │   └── src/
│   │       ├── components/      ← Editor, MarginNote, SettingsPanel, Dashboard, TableOfContents, App.svelte
│   │       ├── note/            ← margin-note request logic, word-boundary snapping
│   │       ├── dashboard/       ← AI-likeness request logic
│   │       ├── providers/       ← client-side calls to the local proxy (not directly to LLMs)
│   │       ├── stores/          ← settings, note, dashboard, table-of-contents state
│   │       ├── utils/           ← readability scoring
│   │       └── main.ts
│   └── server/                  ← thin local proxy
│       └── src/
│           ├── providers/       ← openaiCompatible.ts, prompt.ts, types.ts (LLMProvider contract)
│           ├── routes/          ← suggest.ts, aiLikeness.ts, models.ts
│           └── index.ts
└── .env.example                  ← LOCAL_LLM_BASE_URL=, etc.
```

### 7.3 Replace-in-place & undo

Since suggestions replace a specific range of text, and native undo needs to work, **never keep the selection as a raw DOM `Range`** — it goes stale the moment the document changes. Instead:

- Apply the replacement as a single transaction (`chain().insertContentAt(range, text).run()` or equivalent) so it collapses into one undo step, not a delete + insert pair.
- Store the range as a ProseMirror position and remap it through any transactions that land before the response arrives (ProseMirror's `Mapping`).

### 7.4 Request lifecycle

1. On `selectionUpdate` (debounced ~150–250ms after the selection stabilizes), capture `{ selectedText, context, position }`.
2. Skip if selection is <3 or >220 characters, or unchanged from the last request.
3. Issue request with a fresh `AbortController`; store it so a new selection can abort the previous one.
4. Show loading state in the note immediately (don't wait for the network).
5. On response: render suggestions + modifier chips. On abort: silently discard (no error shown for a superseded request). On genuine failure: show a specific, quiet error in the note.

---

## 8. Non-functional requirements

- **Perceived latency:** loading state must appear within one frame of selection settling; no spinner-free dead air.
- **Cancellation:** a new selection must cancel in-flight requests within one tick — never let a stale response overwrite a newer note.
- **Token budget:** cap context sent to the model (e.g. current paragraph + one before/after, or a hard character ceiling) — full-document context is unnecessary for phrase-level suggestions and directly hurts latency and cost.
- **Privacy:** no network calls outside `localhost`, ever (see §6.4).
- **Accessibility:** visible keyboard focus throughout; note should be reachable and dismissible via keyboard, not just mouse (can be v1.1 if needed, but don't architect it out).

---

## 8a. Tiptap functionality-extension roadmap

Ranked by how directly each one serves Glossly's actual product — the selection-driven margin-note loop, undo-safe swaps, and a distraction-light manuscript editor — not by general popularity. Cloud-only extensions (AI Generation/Toolkit, Collaboration, Comments, Export/Import, Pages, Snapshot, Tracked Changes) are excluded — Tiptap Cloud paid features, orthogonal to Glossly's local-first, single-user model.

**Tier 1 — implemented:** UndoRedo (History, via StarterKit), Selection (keeps the range visually marked once focus moves to the margin note), Placeholder (empty-document voice per §5), CharacterCount (document word/char footer stat).

**Tier 2 — real value, not yet scheduled:**

1. **Typography** — smart quotes/dashes/ellipses, matching the "quiet copilot" voice better than raw ASCII punctuation.
2. **UniqueID** — stable per-node IDs, hardening position mapping beyond raw ProseMirror positions.
3. **TrailingNode / Gapcursor / Dropcursor** — prevents the cursor getting stuck before/after the `Image` node; Gapcursor/Dropcursor likely already ride along with `StarterKit` and just need confirming.
4. **FileHandler** — drag-and-drop / paste-to-upload images, upgrading the current click-only image input.

**Tier 3 — not planned:** BubbleMenu/FloatingMenu (reworking the hand-rolled toolbar for marginal gain), PasteHandler (markdown-paste convenience), Font/Color/TextStyle knobs (rich-formatting suited to general documents, not long-form prose — `Color`/`TextStyle` are imported but unexposed, candidates for pruning), ListKit/ListKeymap (marginal over `StarterKit` + `TaskList`), TableKit (manuscripts rarely need tables), InvisibleCharacters (debugging aid, not prose composition).

---

## 9. Open decisions (flag before/while building)

1. **Desktop shell now or later?** Web + local proxy vs. Tauri/Electron. Current: web + proxy. Revisit if "fully offline, nothing leaves your machine" becomes a marketing claim rather than an implementation detail (§6.3).
2. **Full-sentence rewrite trigger.** Decide the gesture (long-press? separate button? wider selection = automatic escalation?) before it's needed, so the note UI doesn't need a redesign to fit it in later.
3. **Caching strategy.** In-memory only (per session) vs. persisted (per document) — affects how "instant" repeated hovers over the same phrase feel.

---

## 10. Definition of done for the prototype

- [ ] Can open the app, type/paste a paragraph, select a phrase, and get 3 real suggestions within a couple seconds.
- [ ] Works against at least one local provider (Ollama, via the proxy), switchable to LM Studio/generic OpenAI-compatible in settings without a rebuild.
- [ ] Swapping a suggestion in is a single, undoable action.
- [ ] Selecting a new phrase while a request is in flight never results in the wrong suggestions appearing.
- [ ] No network call ever leaves the machine.
