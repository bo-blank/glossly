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

// ── Shapes ──────────────────────────────────────────────────────────────────

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
  stream?: boolean;
}

/** POST /api/suggest without `stream`. */
export interface SuggestResponse {
  suggestions: string[];
}

/** SSE events of a streamed POST /api/suggest, by event name. */
export interface SuggestStreamEvents {
  suggestion: { index: number; text: string };
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
