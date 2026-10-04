// The contract between apps/web and apps/server: what goes over /api, and the
// limits both sides check. TypeScript source, imported as-is — ts-node, tsc,
// Vite and Node's own type stripping all read it. Keep it to erasable syntax
// (no enums, no namespaces) and in this one file: a relative import between
// .ts files would not resolve under Node's require() in the built server.

// ── Limits ──────────────────────────────────────────────────────────────────

/** Shortest selection worth suggesting for. */
export const MIN_SELECTION_CHARS = 3;
/** Longest selection in phrase mode; longer ones are offered a sentence rewrite. */
export const MAX_PHRASE_CHARS = 220;
/** Longest selection in sentence mode. */
export const MAX_SENTENCE_CHARS = 600;
/** Total characters of a SuggestionContext — title, headings, before and after. */
export const MAX_CONTEXT_CHARS = 8000;
export const MAX_HEADING_PATH = 6;
/** A custom chip's instruction and a tuned instruction override. */
export const MAX_INSTRUCTION_CHARS = 300;
export const MAX_TEMPERATURE = 1.5;
/** The server keeps this many previousSuggestions, newest first. */
export const MAX_PREVIOUS_SUGGESTIONS = 12;
/** Protected words per document, and the length of one. */
export const MAX_PROTECTED_TERMS = 30;
export const MAX_PROTECTED_TERM_CHARS = 40;

// ── Hosts ───────────────────────────────────────────────────────────────────

const LOOPBACK_HOSTNAME = /^(localhost|127(\.\d{1,3}){3}|\[::1\])$/i;
const PRIVATE_HOSTNAME = /^(10(\.\d{1,3}){3}|192\.168(\.\d{1,3}){2}|172\.(1[6-9]|2\d|3[01])(\.\d{1,3}){2})$/;

export type HostKind = 'loopback' | 'private';

/**
 * Where a model endpoint lives: this computer, the local network, or neither
 * (null) — the proxy refuses the last. Glossly is local-only by contract.
 * Parsed with URL first, so spellings like http://2130706433 normalise to
 * 127.0.0.1 before the check.
 */
export function classifyHost(baseUrl: string): HostKind | null {
  let url: URL;
  try {
    url = new URL(baseUrl);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  if (LOOPBACK_HOSTNAME.test(url.hostname)) return 'loopback';
  if (PRIVATE_HOSTNAME.test(url.hostname)) return 'private';
  return null;
}

// ── Protected words ─────────────────────────────────────────────────────────

/**
 * How often a protected word occurs: whole words, case-sensitive ("Anna" is
 * not "Annas" or "anna"), with letters and digits of any script as word
 * characters. The prompt and the client's miss check must agree on this.
 */
export function countWord(term: string, text: string): number {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return text.match(new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, 'gu'))?.length ?? 0;
}

// ── Shapes ──────────────────────────────────────────────────────────────────

// Stopwords that are common in one language and (near) absent in the other.
const STOPWORDS = {
  German: new Set(['der', 'die', 'das', 'und', 'ist', 'nicht', 'ich', 'du', 'sie', 'wir', 'mit', 'auf', 'für', 'ein', 'eine', 'den', 'dem', 'zu', 'von', 'sich', 'auch', 'bei', 'dass', 'sind', 'wie', 'noch', 'aber', 'mich', 'dich', 'haben', 'wird']),
  English: new Set(['the', 'and', 'is', 'not', 'we', 'you', 'with', 'for', 'to', 'of', 'that', 'are', 'be', 'this', 'it', 'on', 'should', 'have', 'will', 'our', 'your', 'at', 'but', 'was', 'can', 'would', 'they', 'my', 'from', 'next'])
} as const;

/**
 * German or English, only when clear (≥2 hits and 2:1). A style instruction in
 * one language pulled e2b's output into that language — a German "förmlicher"
 * chip turned 12/15 English alternatives German. Naming the language fixed it.
 */
export function detectLanguage(text: string): 'German' | 'English' | null {
  const words = text.toLowerCase().match(/[a-zäöüß']+/g) ?? [];
  const de = words.filter((w) => STOPWORDS.German.has(w)).length;
  const en = words.filter((w) => STOPWORDS.English.has(w)).length;
  if (de >= 2 && de >= 2 * en) return 'German';
  if (en >= 2 && en >= 2 * de) return 'English';
  return null;
}

export type Provider = 'ollama' | 'lmstudio' | 'openai-compatible';
export type BuiltInModifier = 'tighter' | 'vivid' | 'plain' | 'more';
export type SuggestionMode = 'phrase' | 'sentence';
export type AddressForm = 'du' | 'Sie';

/**
 * Where the selection sits in the document. `before` and `after` stop at the
 * selection itself, so the prompt can mark its exact position.
 */
export interface SuggestionContext {
  title: string;
  /** Enclosing headings, outermost first. */
  headingPath: string[];
  /** Text before the selection, nearest last. */
  before: string;
  /** Text after the selection, nearest first. */
  after: string;
  /** German form of address, when the client could tell. */
  address?: AddressForm;
}

/** Fields every request to the local model carries. */
export interface ModelTarget {
  provider: Provider;
  model: string;
  baseUrl: string;
  apiKey?: string;
  timeout?: number;
}

export interface SuggestRequestBody extends ModelTarget {
  selectedText: string;
  // A plain string from clients older than Phase 3.
  context: SuggestionContext | string;
  /** A BuiltInModifier or a custom chip's id. */
  modifier?: string;
  /** A custom chip's instruction; never overrides a built-in. */
  modifierInstruction?: string;
  /** The writer's tuning; replaces any style modifier's instruction. */
  instructionOverride?: string;
  temperature?: number;
  mode?: SuggestionMode;
  previousSuggestions?: string[];
  /** Protected words that occur in the selection; every alternative must keep them. */
  protectedTerms?: string[];
  stream?: boolean;
}

/** POST /api/suggest without `stream`. */
export interface SuggestResponse {
  suggestions: string[];
}

/**
 * Why a streamed request has no answer yet. `busy`: the server is still
 * answering another model's request (llama-swap swaps only after it
 * finishes). `loading`: our model is being loaded. `waiting`: no answer yet,
 * cause unknown.
 */
export type LoadStatus = { state: 'waiting' } | { state: 'loading'; model: string } | { state: 'busy'; model: string };

/** SSE events of a streamed POST /api/suggest, by event name. */
export interface SuggestStreamEvents {
  suggestion: { index: number; text: string };
  status: LoadStatus;
  done: SuggestResponse;
  error: ApiError;
}

export interface AiLikenessRequestBody extends ModelTarget {
  text: string;
}

export interface AiLikenessResult {
  score: number;
  label: string;
  rationale: string;
}

/** GET /api/modifiers */
export interface ModifierDefaults {
  /** The built-in style chips' instructions, keyed by chip id. */
  defaults: Record<string, string>;
  temperature: number;
}

export type ApiErrorKind = 'timeout' | 'connection_refused' | 'bad_response' | 'not_implemented';

/** Body of every error response, and data of the `error` stream event. */
export interface ApiError {
  error: ApiErrorKind;
  message: string;
}
