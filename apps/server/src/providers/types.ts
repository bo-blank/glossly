import type { AiLikenessResult, ApiErrorKind, LoadStatus, SuggestRequestBody } from '@glossly/shared';

export type { AiLikenessResult, BuiltInModifier as Modifier, SuggestionContext, SuggestionMode } from '@glossly/shared';

/** A validated SuggestRequestBody, ready for a provider. */
export interface SuggestionRequest
  extends Pick<
    SuggestRequestBody,
    'selectedText' | 'context' | 'modifier' | 'modifierInstruction' | 'instructionOverride' | 'temperature' | 'mode' | 'previousSuggestions'
  > {
  model: string;
  baseUrl: string;
  apiKey?: string;
  timeout: number;
  signal: AbortSignal;
}

export type SuggestErrorKind = ApiErrorKind;

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

export type SuggestionStreamEvent = { type: 'suggestion'; index: number; text: string } | { type: 'status'; status: LoadStatus };

/** How long a streamed request waits, and when it reports why. Tests shorten these. */
export interface StreamTiming {
  /** Until the model's first real chunk: covers a model swap or load. */
  loadTimeoutMs: number;
  /** No answer after this long → the first status event. */
  statusDelayMs: number;
  /** How often the load state is asked again while waiting. */
  statusPollMs: number;
}

export interface LLMProvider {
  id: string;
  label: string;
  getSuggestions(input: SuggestionRequest, timing?: StreamTiming): Promise<string[]>;
  streamSuggestions(input: SuggestionRequest, emit: (event: SuggestionStreamEvent) => void, timing?: StreamTiming): Promise<string[]>;
  getAiLikeness(input: AiLikenessRequest, timing?: StreamTiming): Promise<AiLikenessResult>;
}
