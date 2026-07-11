# Glossly — Product & Technical Spec (v0.1)

*A quiet copilot for writers who already have an ear for sound and structure.*

Working title: **Glossly**. This document is meant to be dropped into a fresh repo as `SPEC.md` and used as the source of truth for the first prototype.

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
- Skew privacy-conscious and may not want their manuscript going to a third-party cloud API by default — hence the local-LLM requirement (see §6).

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

This interaction pattern was already validated in an HTML/JS prototype (contenteditable + margin note UI + live LLM call). See §9 for what to carry forward vs. rebuild properly.

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
- [ ] Provider switcher: cloud (Anthropic) vs. local (Ollama / LM Studio / any OpenAI-compatible endpoint)
- [ ] Settings panel: provider, model, endpoint URL, API key (cloud only), request timeout
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

Carried over from the prototype, worth preserving as the design language:

- **Layout:** centered manuscript column (~640px), generous margins, right-hand rail reserved for notes on wide viewports; popover fallback below 900px.
- **Typography:** literary serif for manuscript body (e.g. Newsreader), plain grotesque sans for UI chrome (e.g. Public Sans). Avoid generic "AI product" defaults (cream + terracotta, near-black + neon accent, broadsheet hairlines) unless deliberately chosen.
- **Color:** paper background, ink-black text, a single quiet accent color for the note/leader-line (an editorial teal/forest green rather than the ubiquitous orange/terracotta AI-tool accent).
- **Motion:** minimal. A note fades/slides in over ~150ms; a swapped phrase gets a brief highlight that fades over ~1.5s so the writer can see what changed, then disappears. No decorative animation.
- **Empty/error states:** in the note's own quiet voice ("Couldn't reach the model — try again"), never apologetic, never blocking the rest of the editor.

---

## 6. Local LLM requirement — architectural implications

This is a first-class requirement, not an add-on, because the target writer is privacy-conscious about sending unpublished manuscript text to a cloud API by default.

### 6.1 Provider abstraction

Define a single interface every provider must implement:

```ts
interface LLMProvider {
  id: string;                 // "anthropic" | "ollama" | "lmstudio" | "openai-compatible"
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

### 6.2 Concrete providers for v1

| Provider | Transport | Notes |
|---|---|---|
| **Anthropic (cloud)** | `POST https://api.anthropic.com/v1/messages` | API key stored locally (never bundled/committed), sent only in the request header from the client or a thin local proxy. |
| **Ollama (local)** | `POST http://localhost:11434/api/chat` or its OpenAI-compatible `/v1/chat/completions` | Default local option. Note Ollama's CORS defaults — see §6.3. |
| **LM Studio (local)** | OpenAI-compatible `POST http://localhost:1234/v1/chat/completions` | Same shape as Ollama's compatibility layer — can likely share one `OpenAICompatibleProvider` implementation with a configurable base URL. |
| **Generic OpenAI-compatible (local or self-hosted)** | Configurable base URL + optional key | Covers llama.cpp server, vLLM, LocalAI, etc. without bespoke code. |

Practically, this means **two provider implementations**, not four:
1. `AnthropicProvider` (native Anthropic Messages API shape)
2. `OpenAICompatibleProvider` (parameterized by base URL + optional API key) — covers Ollama, LM Studio, llama.cpp server, vLLM, etc.

### 6.3 CORS / local networking

Browsers calling `localhost:11434` directly from a hosted web page will typically get blocked by CORS unless the local server is configured to allow it (Ollama supports `OLLAMA_ORIGINS`, but it's an extra setup step for the user). Two options, worth deciding early:

- **Option A — thin local proxy.** A tiny Node/Express (or equivalent) server that ships with the app, runs on `localhost`, and forwards requests to whichever provider is configured. Solves CORS uniformly, keeps API keys out of client-side JS, and gives you one place to implement request cancellation, retries, and caching.
- **Option B — desktop shell (Tauri or Electron).** Since network requests from a native shell aren't subject to browser CORS, a local-first desktop app sidesteps the problem entirely and is a more honest fit for a "your manuscript never has to leave your machine" pitch. Tauri is the lighter-weight option (Rust shell, small binary, uses the OS webview) if this product's identity leans further into "local-first, privacy-respecting tool" over time.

**Recommendation for the prototype:** start with **Option A** (web app + local proxy) — fastest to stand up, works in a normal browser, no OS-specific packaging yet. Revisit Option B once the interaction is validated and if "runs fully offline, nothing leaves your machine" becomes a real marketing claim rather than a nice-to-have.

### 6.4 Privacy default

When a local provider is selected, the app should make **zero network calls outside localhost** — no analytics, no telemetry, no update checks that include document content. This should be true by construction (no code path exists to send manuscript text elsewhere when local mode is active), not just a policy.

---

## 7. Technical architecture (prototype)

### 7.1 Stack recommendation

- **Frontend:** Vite + Svelte + TypeScript. Chosen over React for this scope: Svelte compiles away at build time (no framework runtime shipped to the browser), which fits the "minimal, fast" positioning at the architecture level, not just the UI level — smaller bundle, faster boot, and it dovetails with the local-first/privacy angle in §6.
- **Editor:** [Tiptap](https://tiptap.dev) (ProseMirror-based), using its official Svelte bindings. Decided over Quill (see §7.1a for the tradeoff that was weighed) — do **not** carry forward raw `contenteditable` + manual DOM `Range` manipulation from the earlier demo; Tiptap gives a real document model the demo didn't have.
- **State:** Svelte's built-in stores (`writable`/`derived`) are enough for v1 — no need for an external state library. Fine-grained reactivity means updating the note's suggestion list doesn't need to touch the manuscript component, which maps cleanly onto the request lifecycle in §7.4.
- **Local proxy backend:** Node + Express (or Fastify), single `/api/suggest` endpoint that takes `{ provider, model, selectedText, context, modifier }` and dispatches to the configured `LLMProvider`.
- **Persistence:** Browser `localStorage` (or IndexedDB if documents get large) for the prototype. No account system, no server-side storage.
- **Styling:** Plain CSS with custom properties (as in the earlier prototype) or Tailwind if the team prefers utility classes — either is fine, but keep the token system (paper/ink/accent/rule from §5) centralized in one place regardless.

### 7.1a Editor choice: why Tiptap over Quill

Both are open, inspectable, MIT-licensed document formats — "open format" wasn't the deciding factor. **Decision: Tiptap/ProseMirror.** The tradeoff that was weighed, kept here for context on *why*:

| | **Quill** (not chosen) | **Tiptap / ProseMirror** (chosen) |
|---|---|---|
| Model | Delta (`insert`/`retain`/`delete`) | Document schema + transactions |
| Position tracking after remote edits | Possible — transform a stored range through the intervening Delta ops — but you write that logic yourself | Built in: `Mapping` lets you save a position and later ask where it maps to after everything that happened since |
| Temporary highlight (view-only, not saved) | Not first-class — either becomes a real Delta op you must remember to clean up, or you fake it with absolutely-positioned DOM overlays synced to `getBounds()` | First-class: decorations are render-only, invisible to the document model, trivial to add/remove |
| Undo/redo | Built in, works on Deltas | Built in, collapses a range-replace into a single transaction naturally |
| Bundle size / setup complexity | Smaller, simpler for v1's narrow scope | More machinery than this scope strictly needs on day one — accepted as the tradeoff for the two mechanics above |

The two mechanics that tipped it: **async position resolution** (a suggestion request goes out, the writer keeps typing elsewhere, the response lands 1–2 seconds later — need to resolve "where is that original selection *now*") and **ephemeral, non-content highlighting** (the "swapped text glows then fades" effect shouldn't become part of the actual document content). ProseMirror gives both for free via `Mapping` and decorations; Quill would need both hand-rolled. Given v1.1 is already expected to want richer margin-note UI (custom modifier chips, possibly multiple simultaneous notes), that plumbing is worth having from day one rather than retrofitting later.

### 7.2 Repo structure (suggested)

```
glossly/
├── SPEC.md                    ← this file
├── README.md
├── package.json                ← workspace root (if using a monorepo tool) or single app
├── apps/
│   ├── web/                    ← Vite + Svelte + TS frontend
│   │   ├── src/
│   │   │   ├── editor/         ← Tiptap setup, extensions, the manuscript component
│   │   │   ├── note/           ← the margin-note component, modifier chips, positioning logic
│   │   │   ├── providers/      ← client-side calls to the local proxy (not directly to LLMs)
│   │   │   ├── settings/       ← provider/model/key configuration UI
│   │   │   └── App.svelte
│   │   └── vite.config.ts
│   └── server/                 ← thin local proxy
│       ├── src/
│       │   ├── providers/
│       │   │   ├── anthropic.ts
│       │   │   ├── openaiCompatible.ts
│       │   │   └── types.ts    ← LLMProvider / SuggestionRequest interfaces
│       │   ├── routes/
│       │   │   └── suggest.ts
│       │   └── index.ts
│       └── package.json
└── .env.example                 ← ANTHROPIC_API_KEY=, LOCAL_LLM_BASE_URL=, etc.
```

### 7.3 Replace-in-place & undo

Since suggestions replace a specific range of text, and native undo needs to work, **never keep the selection as a raw DOM `Range`** — it goes stale the moment the document changes, which will bite you the first time two suggestions land close together. Instead:

- Apply the replacement as a single transaction (`chain().insertContentAt(range, text).run()` or equivalent) so it collapses into one undo step, not a delete + insert pair.
- Store the range as a ProseMirror position and remap it through any transactions that land before the response arrives (this is exactly the `Mapping` mechanic referenced in §7.1a).

### 7.4 Request lifecycle

1. On `selectionUpdate` (debounced ~150–250ms after the selection stabilizes), capture `{ selectedText, context, position }`.
2. Skip if selection is <3 or >220 characters, or unchanged from the last request.
3. Issue request with a fresh `AbortController`; store it so a new selection can abort the previous one.
4. Show loading state in the note immediately (don't wait for the network).
5. On response: render suggestions + modifier chips. On abort: silently discard (no error shown for a superseded request). On genuine failure: show a specific, quiet error in the note.

---

## 8. Non-functional requirements

- **Perceived latency:** loading state must appear within one frame of selection settling; no spinner-free dead air.
- **Cancellation:** a new selection must cancel in-flight requests within one tick — never let a stale response overwrite a newer note (this was a real bug class in the earlier prototype and needs an explicit request-token or `AbortController` guard).
- **Token budget:** cap context sent to the model (e.g. current paragraph + one before/after, or a hard character ceiling) — full-document context is unnecessary for phrase-level suggestions and directly hurts latency and cost.
- **Local-mode privacy:** no network calls outside `localhost` when a local provider is active (see §6.4).
- **Accessibility:** visible keyboard focus throughout; note should be reachable and dismissible via keyboard, not just mouse (can be v1.1 if needed, but don't architect it out).

---

## 9. What to carry forward from the existing prototype

The earlier HTML/JS demo already validated:
- The margin-note visual language (leader line, quiet card, modifier chips) — reuse the token system (`--paper`, `--ink`, `--accent`, `--rule`, etc.) as the starting point for the real design system.
- The core request shape (context + selected text + instruction → JSON array of 3 strings) — reuse the prompt pattern, just move the call behind the local proxy and the provider abstraction instead of calling Anthropic directly from the browser.

What **not** to carry forward as-is:
- Raw `contenteditable` + manual DOM `Range` manipulation — replace with Tiptap/ProseMirror (see §7.1a for why) for anything beyond a throwaway demo, per §7.3.
- Calling the Anthropic API directly from client-side JS — move behind the local proxy so API keys aren't exposed and so local-provider requests can be handled uniformly.

---

## 10. Open decisions (flag before/while building)

1. **Desktop shell now or later?** Web + local proxy (Option A, §6.3) vs. Tauri/Electron from day one. Recommendation above: start web, revisit if "fully offline" becomes core to the pitch.
2. **Modifier chips: fixed set or user-defined?** v1 ships fixed (Tighter/Vivid/Plainer); custom chips are a natural v1.1 but touch the prompt-construction layer, worth designing the interface for now even if not exposed in the UI yet.
3. **Full-sentence rewrite trigger.** Decide the gesture (long-press? separate button? wider selection = automatic escalation?) before it's needed, so the note UI doesn't need a redesign to fit it in later.
4. **Caching strategy.** In-memory only (per session) vs. persisted (per document) — affects how "instant" repeated hovers over the same phrase feel.
5. **Model defaults per provider.** e.g. Anthropic → Sonnet-tier by default (favor quality over the cheapest/fastest tier, since suggestion quality is the whole product); local → whatever the user has pulled, but worth a sensible default recommendation in the settings UI (e.g. "works best with 7B+ instruction-tuned models").

---

## 11. Definition of done for the prototype

- [ ] Can open the app, type/paste a paragraph, select a phrase, and get 3 real suggestions within a couple seconds.
- [ ] Works against at least one local provider (Ollama, via the proxy) and the Anthropic cloud provider, switchable in settings without a rebuild.
- [ ] Swapping a suggestion in is a single, undoable action.
- [ ] Selecting a new phrase while a request is in flight never results in the wrong suggestions appearing.
- [ ] No network call leaves the machine when a local provider is selected.