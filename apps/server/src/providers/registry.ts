import type { Provider } from '@glossly/shared';
import { openAICompatibleProvider } from './openaiCompatible';
import type { LLMProvider } from './types';

// Ollama and LM Studio both speak the OpenAI-compatible API.
const providers: Record<Provider, LLMProvider> = {
  'openai-compatible': openAICompatibleProvider,
  ollama: openAICompatibleProvider,
  lmstudio: openAICompatibleProvider
};

/** An own key only: a plain lookup would find Object.prototype's "toString" or "constructor". */
export function resolveProvider(provider: unknown): LLMProvider | undefined {
  return typeof provider === 'string' && Object.prototype.hasOwnProperty.call(providers, provider)
    ? providers[provider as Provider]
    : undefined;
}
