import { describe, expect, it } from 'vitest';
import { loadStatusText } from './loadStatusText';

describe('loadStatusText', () => {
  it('names both models while another one is busy', () => {
    expect(loadStatusText({ state: 'busy', model: 'qwen38-27b' }, 'gemma4-e2b-qat')).toBe(
      'qwen38-27b is still answering another request — gemma4-e2b-qat is next.'
    );
  });
  it('names the model being loaded', () => {
    expect(loadStatusText({ state: 'loading', model: 'gemma4-e2b-qat' }, 'x')).toMatch(/^Loading gemma4-e2b-qat…/);
  });
  it('falls back to plain waiting', () => {
    expect(loadStatusText({ state: 'waiting' }, 'x')).toBe('Waiting for the model server…');
  });
});
