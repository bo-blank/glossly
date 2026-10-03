import type { AiLikenessResult, ApiErrorKind, SuggestRequestBody } from '@glossly/shared';

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
