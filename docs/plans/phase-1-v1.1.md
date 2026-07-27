# Phase 1 (v1.1) — Implementation Plan

Self-contained plan for implementing the six Phase 1 features from
`docs/next-iteration-features.md`. Written for an implementing agent with no
prior context on this repository. Read this whole document before starting.

## Repository orientation

Glossly is a privacy-first writing assistant: select a phrase in a rich-text
editor, get 3 alternative phrasings from a **local** LLM in a margin note.

- `apps/web` — Vite + Svelte 5 (runes) + TypeScript + Tiptap 3 + Tailwind 4 + daisyUI 5
- `apps/server` — Express proxy on `:3000`; forwards to any OpenAI-compatible
  local endpoint (llama.cpp, Ollama, LM Studio). The web dev server (`:5173`)
  proxies `/api/*` to it (see `apps/web/vite.config.ts`)
- npm workspaces, single root lockfile

Key files:

| File | Role |
| --- | --- |
| `apps/server/src/routes/suggest.ts` | `POST /api/suggest` — validation, abort handling |
| `apps/server/src/providers/openaiCompatible.ts` | upstream fetch, response parsing |
| `apps/server/src/providers/prompt.ts` | system/user prompts, JSON schemas, modifier instructions |
| `apps/server/src/providers/types.ts` | `SuggestionRequest`, `SuggestError`, `Modifier` |
| `apps/server/src/util/validate.ts` | `validateLocalBaseUrl`, `resolveTimeout` |
| `apps/web/src/note/requestSuggestions.ts` | debounce, dedupe, word-boundary snap, request orchestration |
| `apps/web/src/providers/client.ts` | fetch wrappers for `/api/*` |
| `apps/web/src/components/MarginNote.svelte` | suggestion UI + modifier chips |
| `apps/web/src/components/Editor.svelte` | Tiptap setup, selection → context extraction |
| `apps/web/src/components/SettingsPanel.svelte` | provider/model/timeout settings |
| `apps/web/src/stores/settingsStore.ts` | settings persisted to localStorage |
| `apps/web/src/stores/noteStore.ts` | margin-note state (`visible/loading/suggestions/error/position`) |
| `apps/web/src/utils/readability.ts` | pure text utils incl. `splitSentences` |

## Ground rules

1. **Local-only is a hard guarantee.** No new external network calls, no
   telemetry, no CDN assets. The server must keep rejecting non-local
   `baseUrl`s (`validateLocalBaseUrl`).
2. **No new dependencies** except `vitest` as a devDependency of
   `apps/server` (WP1). Everything else uses what is already installed.
3. **Preserve existing behavior** unless a work package explicitly changes it:
   request-abort semantics (`res.on('close')` + `AbortController`), selection
   snapping, the request dedupe in `requestSuggestions.ts`, undo-friendly
   suggestion swaps.
4. **Style:** match surrounding code. Comments only where the code can't speak
   for itself (this codebase uses them sparingly but deliberately). TypeScript
   in `.ts` files; Svelte components follow the existing runes style.
5. **Verify before every commit:** `npm test` (root) and `npm run build`
   (root) must pass, plus `npx tsc --noEmit` inside `apps/server`.
6. **One commit per work package**, in the order below. Do not batch.
7. Manual testing: a llama-swap instance serves OpenAI-compatible models at
   `http://127.0.0.1:8080/v1` (the app's default endpoint). Any small model
   (e.g. `gemma4-12b`) works. Start the app with `npm run dev` from the root.

## Work package order and dependencies

WP1 (streaming) rewires the request path; WP2 (cache) and WP3 (custom chips)
build on it; WP6 (sentence mode) extends the same path — keep that order.
WP4 (keyboard) and WP5 (dark mode) are independent and can land anytime after
WP1.

---

## WP1 — Streaming suggestions (SSE)

**Goal:** the first suggestion appears in the margin note ~1 s after selection
instead of after the full model response (up to 10 s+).

### Protocol

`POST /api/suggest` gains an optional body field `stream: true`.

- `stream` absent/false → existing JSON behavior, unchanged (kept as fallback).
- `stream: true` → the response is `text/event-stream` with events:

```text
event: suggestion
data: {"index":0,"text":"the first alternative"}

event: done
data: {"suggestions":["...","...","..."]}

event: error
data: {"error":"timeout","message":"The local model took too long to respond."}
```

Validation failures that happen **before** contacting the upstream (bad
selectedText/provider/baseUrl/model) keep returning plain JSON 4xx as today —
the client only switches to SSE parsing when the response `Content-Type` is
`text/event-stream`. After streaming has started, failures are delivered as an
`error` event followed by stream end.

### Server changes

1. `apps/server/src/providers/openaiCompatible.ts`: add a
   `streamSuggestions(input, emit)` method to the provider (extend
   `LLMProvider` in `types.ts`; `emit` receives
   `{ type: 'suggestion', index, text }` events). It sends the upstream
   request with `stream: true` in the JSON body and parses the upstream SSE:
   - split on newlines, handle lines with the `data:` field prefix, stop at
     `data: [DONE]`;
   - accumulate `choices[0].delta.content` chunks (ignore
     `delta.reasoning_content` and any other fields);
   - feed the accumulated buffer to the incremental extractor (below) and
     `emit` each newly completed suggestion, up to 3;
   - return the final string array when the stream ends.
2. New pure module `apps/server/src/providers/streamParse.ts`:

   ```ts
   export interface StreamParseResult { suggestions: string[]; complete: boolean }
   export function extractSuggestions(buffer: string): StreamParseResult
   ```

   Contract: `buffer` is the concatenated model output so far, which will
   eventually be `{"suggestions": ["a", "b", "c"]}` (the enforced JSON schema),
   possibly wrapped in a ```` ```json ```` fence or preceded by a
   `<think>...</think>` block. The function must:
   - drop a leading `<think>` block (if `</think>` hasn't arrived yet, return
     empty/incomplete);
   - strip an opening code fence if present;
   - locate the first `[` and then scan JSON **string literals** with correct
     escape handling (`\"`, `\\`, `\n`, `\uXXXX`) — a naive regex or repeated
     `JSON.parse` of the partial buffer is not acceptable;
   - return all *completed* strings (JSON-unescaped) in order, and
     `complete: true` once the closing `]` has been scanned.

   Unit-test this thoroughly (see Tests).
3. `apps/server/src/routes/suggest.ts`: when `stream === true`, set SSE
   headers (`Content-Type: text/event-stream`, `Cache-Control: no-cache`,
   `Connection: keep-alive`, then `res.flushHeaders()`), call
   `streamSuggestions`, write events as they arrive, and end with `done` (pass
   the suggestions through the same trim/cap post-processing as the
   non-streaming path). Keep the existing `res.on('close')` abort wiring.
4. **Timeout semantics change for streaming:** the timeout becomes an *idle*
   timeout — reset the timer on every upstream chunk. A model that streams
   slowly but steadily must not be killed; one that stalls must be. The
   non-streaming path keeps its total timeout.
5. Add vitest to the server workspace:
   `npm install -D vitest -w apps/server`, script `"test": "vitest run"` in
   `apps/server/package.json` (root `npm test` already fans out via
   `--workspaces --if-present`).

### Client changes

1. `apps/web/src/providers/client.ts`: new
   `fetchSuggestionsStream(params & { onSuggestion(index, text) })` using
   `fetch` + `ReadableStream` (not `EventSource` — it can't POST). Parse SSE
   frames; resolve with the final array from `done`; throw
   `SuggestRequestError` on `error` events. If the response is JSON (pre-stream
   validation error), throw as today.
2. `apps/web/src/note/requestSuggestions.ts` (`runRequest`): use the streaming
   fetch. On each `onSuggestion`, append to `noteStore.suggestions` while
   keeping `loading: true`; on completion set `loading: false` and update
   `seenSuggestions` as today. Abort semantics unchanged.
3. `apps/web/src/components/MarginNote.svelte`: while `loading`, render the
   suggestions received so far with the spinner row *below* them (currently
   loading replaces the whole body). Modifier chips stay hidden until loading
   finishes.

### Tests (server, vitest)

`streamParse.test.ts`: completed-strings extraction across chunk boundaries
(feed the same JSON split at awkward positions — mid-escape, mid-`\u` sequence,
between `",` and `"`), escape unescaping, `<think>` prefix handling, fenced
output, `complete` flag, buffers that never complete.

### Acceptance criteria

- Selecting a phrase shows suggestion 1 while 2 and 3 are still generating
  (visually verifiable with any local model).
- Killing the model server mid-stream surfaces the existing friendly error in
  the note (no hang, no unhandled rejection in the server log).
- Selecting different text mid-stream aborts the upstream request (server log
  stays clean) and starts a fresh note.
- Non-streaming path still works: `curl -s -X POST localhost:3000/api/suggest
  -H 'Content-Type: application/json' -d '{"provider":"openai-compatible",
  "baseUrl":"http://127.0.0.1:8080/v1","model":"<model>",
  "selectedText":"walked quickly","context":"He walked quickly."}'`
  returns `{"suggestions":[...]}`.

### Pitfalls

- Express buffers by default — `res.flushHeaders()` and per-event
  `res.write` are required; do not use `res.json` on the SSE path.
- Node `fetch` upstream SSE arrives as arbitrary byte chunks: decode with a
  `TextDecoder` in streaming mode (`{ stream: true }`) and keep a line
  remainder buffer; never assume one chunk = one SSE frame.
- `[DONE]` arrives as literal `data: [DONE]` — do not `JSON.parse` it.

---

## WP2 — Response caching

**Goal:** re-selecting the same phrase, or flipping between modifier chips,
serves instantly from a session cache instead of re-hitting the model.

1. New module `apps/web/src/note/suggestionCache.ts`: `Map`-based LRU
   (capacity 100; on hit, re-insert to refresh recency). Key =
   `JSON.stringify([selectedText, context, modifier ?? '', modifierInstruction ?? '', model, endpointUrl])`.
   Export `get`, `set`, and `clear` (for tests).
2. In `runRequest` (`requestSuggestions.ts`):
   - **Never cache or serve `modifier === 'more'`** — its purpose is fresh
     output. Everything else is cacheable.
   - On hit: set the note to the cached suggestions synchronously (no loading
     state), update `seenSuggestions`, return before creating an
     `AbortController`.
   - On streamed completion: store the final array.
3. Context is part of the key, so edits that change surrounding text miss the
   cache naturally; no explicit invalidation needed. Switching model or
   endpoint also misses by key. That is the whole invalidation story — do not
   build more.

**Tests (web):** `suggestionCache.test.ts` — LRU eviction order, hit refresh,
key sensitivity to each component.

**Acceptance:** select a phrase, wait for suggestions, click elsewhere, select
the same phrase again → suggestions appear instantly, and the server log shows
no second upstream request. Clicking "Tighter" twice for the same selection
hits the cache the second time. "New suggestions" always hits the model.

---

## WP3 — Custom modifier chips

**Goal:** writers define their own chips (e.g. "More formal") next to the
built-in Tighter / More vivid / Plainer.

1. `settingsStore.ts`: add `customModifiers: { id: string; label: string;
   instruction: string }[]` (default `[]`, `id` via `crypto.randomUUID()`).
   The existing `{ ...defaultSettings, ...stored }` merge keeps old stored
   settings valid.
2. `SettingsPanel.svelte`: new "Custom modifiers" section — list existing
   chips with a delete button; an add form with label input (≤ 24 chars) and
   instruction textarea (≤ 300 chars). Persist via the existing
   `saveSettings()`.
3. `MarginNote.svelte`: render custom chips after the built-ins, before "New
   suggestions". Click → `requestWithModifier(chip.id, chip.instruction)`.
4. `requestSuggestions.ts`: `requestWithModifier(modifier: string,
   instruction?: string)`; thread `modifierInstruction` through `runRequest`,
   the dedupe key, and the cache key.
5. `client.ts`: send `modifierInstruction` in the body when present.
6. Server: `suggest.ts` validates `modifierInstruction` (string, ≤ 300 chars,
   else 400); `types.ts` adds it to `SuggestionRequest`; `prompt.ts` resolves
   the instruction as `MODIFIER_INSTRUCTIONS[modifier] ?? modifierInstruction`
   — built-ins are never overridable by a custom instruction under the same id.

**Acceptance:** create a chip "Formal" with instruction "Make each alternative
more formal in register."; it appears in the note, produces visibly more formal
suggestions, survives a page reload, and can be deleted. Requests without
custom instruction behave exactly as before.

---

## WP4 — Keyboard-only flow

**Goal:** the entire loop — select, review, apply — without the mouse.
Keyboard selection (Shift+arrows) already triggers suggestions; what's missing
is apply/refresh from the keyboard.

1. Extend the existing `handleKeydown` in `MarginNote.svelte` (which handles
   Escape): when the note is visible, not loading, and has suggestions —
   - `Alt+1` / `Alt+2` / `Alt+3` → apply that suggestion;
   - `Alt+N` → "New suggestions" (`more`).
   Use `e.code` (`Digit1`…`Digit3`, `KeyN`), **not** `e.key` — with Alt held,
   `e.key` produces layout-dependent characters (especially on macOS).
   `preventDefault()` only when actually handling the combination.
2. **Never intercept unmodified digits or letters** — the writer is typing
   prose. Alt-combinations only.
3. Add a subtle hint row at the bottom of the note:
   `Alt+1–3 apply · Alt+N new · Esc dismiss` (small, `opacity-60`).

**Acceptance:** full loop works mouse-free: Shift+arrow selection → wait →
Alt+2 applies the second suggestion → Ctrl/Cmd+Z undoes it. Typing "1" into
the document while the note is open inserts "1" and does not apply anything.

---

## WP5 — Dark mode

**Goal:** a persisted light/dark toggle; system preference as the default.

1. `apps/web/src/app.css`: configure daisyUI themes explicitly:

   ```css
   @plugin "daisyui" {
     themes: light --default, dark --prefersdark;
   }
   ```

2. New `apps/web/src/stores/themeStore.ts`: `'light' | 'dark'`, initialized
   from localStorage key `glossly-theme`, falling back to
   `prefers-color-scheme`. On change: persist and set
   `document.documentElement.dataset.theme`.
3. `App.svelte`: **remove** the hardcoded `data-theme="light"` on the root div
   (line 24) — the attribute now lives on `<html>`. Add a sun/moon toggle
   button in the header next to the settings gear (inline SVG like the toolbar
   icons; `aria-label="Toggle theme"`).
4. `app.scss` defines light-only custom properties (`--gray-1..5`, `--black`,
   `--purple-light`, `--readability-standard/hard`) consumed by
   `components/styles.scss`. Add a `[data-theme="dark"]` block overriding them
   with dark equivalents (light text tones, low-alpha light borders instead of
   the brown-tinted dark rgba values, and readability highlight colors with
   enough contrast on dark backgrounds — keep the yellow/red hues, raise
   alpha as needed). Audit `components/styles.scss` for any remaining
   hardcoded light values (e.g. code-block and blockquote backgrounds) and
   route them through variables.

**Acceptance:** toggle switches the whole UI including editor content, margin
note, toolbar, and readability highlights; choice survives reload; with no
stored choice, the app follows the OS scheme. No unreadable text in either
theme (check code blocks, blockquotes, highlight swatches, the dashboard).

---

## WP6 — Full-sentence rewrite mode (opt-in)

**Goal:** rewrite whole sentences on request, without changing the default
phrase-level behavior or its 220-character ceiling.

1. **Protocol:** `POST /api/suggest` gains `mode?: 'phrase' | 'sentence'`
   (default `'phrase'`). For `sentence`, `selectedText` may be 3–600 chars
   (phrase keeps 3–220). Same response shape, streaming included.
2. `prompt.ts`: add `SENTENCE_SYSTEM_PROMPT` — rewrite the given sentence(s)
   in 3 alternative ways: preserve meaning, tense, person, and approximate
   length; restructuring is allowed; return only the rewritten sentence(s),
   no explanations. `buildMessages` gains the mode parameter and picks the
   system prompt accordingly. Modifier instructions still apply.
3. `types.ts` / `suggest.ts`: thread `mode` through with validation
   (`'phrase' | 'sentence'` only; length limit switched by mode).
4. Client trigger, two paths in `MarginNote.svelte`:
   - Normal selection (3–220 chars): a "Rewrite sentence" chip next to the
     modifiers. Clicking expands the selection to the enclosing sentence(s)
     and re-requests with `mode: 'sentence'`.
   - Oversized selection (221–600 chars): where today only the "select a
     shorter phrase" error shows, additionally offer a "Rewrite as
     sentence(s)" button that requests sentence mode with the selection as-is
     (snapped to sentence boundaries). Above 600 chars keep the plain error.
5. Sentence expansion helper in `apps/web/src/note/`:
   given the doc and a from/to, find the enclosing sentence boundaries within
   the parent textblock using `splitSentences` from `utils/readability.ts`
   (mind the `+1` node-start offset — see `readabilityHighlight.ts` for the
   position mapping pattern), update the visible selection via
   `setTextSelection` like the word-boundary snap does, cap at 600 chars.
   Unit-test the boundary math with a fake doc (see `wordBoundary.test.ts`
   for the pattern).
6. Cache/dedupe/seen-suggestions keys must include the mode.

**Acceptance:** selecting a phrase and clicking "Rewrite sentence" visibly
expands the selection to the full sentence and returns 3 full-sentence
rewrites that replace it (undo works). A 300-char selection offers the
sentence path instead of only erroring. Phrase mode behavior is byte-for-byte
unchanged when the chip isn't used.

---

## Final verification checklist

- [ ] `npm test` — all workspaces green (web + new server tests)
- [ ] `npm run build` — server tsc + web vite build pass
- [ ] Manual pass against llama-swap (`http://127.0.0.1:8080/v1`): streaming,
      cache hit, custom chip, Alt-shortcuts, theme toggle, sentence rewrite
- [ ] Abort behavior: switching selections rapidly leaves no errors in either
      terminal
- [ ] `README.md`: move the shipped items from "v1.1 (Not yet implemented)"
      to the v1 feature list; update the roadmap doc's Phase 1 section
- [ ] Six commits, one per work package, messages explaining the why
