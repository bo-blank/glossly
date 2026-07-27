export type Modifier = 'tighter' | 'vivid' | 'plain' | 'more';

export interface SuggestionRequest {
  selectedText: string;
  context: string;
  modifier?: Modifier;
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

export interface LLMProvider {
  id: string;
  label: string;
  getSuggestions(input: SuggestionRequest): Promise<string[]>;
  getAiLikeness(input: AiLikenessRequest): Promise<AiLikenessResult>;
}
