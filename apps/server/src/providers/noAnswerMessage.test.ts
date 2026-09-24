import { describe, expect, it } from 'vitest';
import { noAnswerMessage } from './openaiCompatible';

describe('noAnswerMessage', () => {
  it('blames reasoning when the thought channel ate the whole token limit', () => {
    expect(noAnswerMessage('length', true)).toMatch(/used up its token limit while thinking/);
  });

  it('reports a plain token-limit cut-off when there was no reasoning', () => {
    expect(noAnswerMessage('length', false)).toBe('The model hit its token limit before finishing its answer.');
  });

  it('falls back to the generic message for any other finish reason', () => {
    expect(noAnswerMessage('stop', true)).toBe('Local model server returned an empty response.');
    expect(noAnswerMessage(undefined, false)).toBe('Local model server returned an empty response.');
  });
});
