import { describe, expect, it } from 'vitest';
import { openAICompatibleProvider } from './openaiCompatible';
import { resolveProvider } from './registry';

describe('resolveProvider', () => {
  it.each(['openai-compatible', 'ollama', 'lmstudio'])('knows %s', (id) => {
    expect(resolveProvider(id)).toBe(openAICompatibleProvider);
  });

  it.each(['toString', 'constructor', '__proto__', 'hasOwnProperty', 'openai', '', 42, undefined, null])('rejects %s', (id) => {
    expect(resolveProvider(id)).toBeUndefined();
  });
});
