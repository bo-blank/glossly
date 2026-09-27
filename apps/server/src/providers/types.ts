export type Modifier = 'tighter' | 'vivid' | 'plain' | 'more';
export type SuggestionMode = 'phrase' | 'sentence';

/**
 * Where the selection sits in the document. `before` and `after` stop at the
 * selection itself, so the prompt can mark its exact position. Mirrored by hand
 * in apps/web/src/note/contextExtraction.ts — there is no shared package.
 */
export interface SuggestionContext {
  title: string;
  headingPath: string[];
  before: string;
  after: string;
  /** German form of address, when the client could tell. */
  address?: 'du' | 'Sie';
}

export interface SuggestionRequest {
  selectedText: string;
  // A plain string from clients older than Phase 3.
  context: string | SuggestionContext;
  modifier?: Modifier | string;
  modifierInstruction?: string;
  mode?: SuggestionMode;
  previousSuggestions?: string[];
  model: string;
  baseUrl: string;
  apiKey?: string;
  timeout: number;
  signal: AbortSignal;
}

export type SuggestErrorKind = 'timeout' | 'connection_refused' | 'bad_response' | 'not_implemented';

export class SuggestError extends Error {
  kind: SuggestErrorKind;

  constructor(kind: SuggestErrorKind, message: string) {
    super(message);
    this.kind = kind;
  }
}

export interface AiLikenessRequest {
  text: string;
  model: string;
  baseUrl: string;
  apiKey?: string;
  timeout: number;
  signal: AbortSignal;
}

export interface AiLikenessResult {
  score: number;
  label: string;
  rationale: string;
}

export interface SuggestionStreamEvent {
  type: 'suggestion';
  index: number;
  text: string;
}

export interface LLMProvider {
  id: string;
  label: string;
  getSuggestions(input: SuggestionRequest): Promise<string[]>;
  streamSuggestions(input: SuggestionRequest, emit: (event: SuggestionStreamEvent) => void): Promise<string[]>;
  getAiLikeness(input: AiLikenessRequest): Promise<AiLikenessResult>;
}
