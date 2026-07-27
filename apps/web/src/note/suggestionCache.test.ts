import { beforeEach, describe, expect, it } from 'vitest';
import { cacheKey, clear, get, set } from './suggestionCache';

const BASE = { selectedText: 'walked quickly', context: 'He walked quickly.', model: 'gemma', endpointUrl: 'http://127.0.0.1:8080/v1' };

describe('suggestionCache', () => {
  beforeEach(() => clear());

  it('returns undefined for a miss', () => {
    expect(get(cacheKey(BASE))).toBeUndefined();
  });

  it('stores and retrieves by key', () => {
    const key = cacheKey(BASE);
    set(key, ['a', 'b', 'c']);
    expect(get(key)).toEqual(['a', 'b', 'c']);
  });

  it('is sensitive to selectedText', () => {
    const key1 = cacheKey(BASE);
    const key2 = cacheKey({ ...BASE, selectedText: 'walked slowly' });
    set(key1, ['a']);
    expect(get(key2)).toBeUndefined();
  });

  it('is sensitive to context', () => {
    const key1 = cacheKey(BASE);
    const key2 = cacheKey({ ...BASE, context: 'Different surrounding text.' });
    set(key1, ['a']);
    expect(get(key2)).toBeUndefined();
  });

  it('is sensitive to modifier', () => {
    const key1 = cacheKey({ ...BASE, modifier: 'tighter' });
    const key2 = cacheKey({ ...BASE, modifier: 'vivid' });
    set(key1, ['a']);
    expect(get(key2)).toBeUndefined();
  });

  it('is sensitive to modifierInstruction', () => {
    const key1 = cacheKey({ ...BASE, modifier: 'custom-1', modifierInstruction: 'More formal.' });
    const key2 = cacheKey({ ...BASE, modifier: 'custom-1', modifierInstruction: 'Less formal.' });
    set(key1, ['a']);
    expect(get(key2)).toBeUndefined();
  });

  it('is sensitive to mode', () => {
    const key1 = cacheKey({ ...BASE, mode: 'phrase' });
    const key2 = cacheKey({ ...BASE, mode: 'sentence' });
    set(key1, ['a']);
    expect(get(key2)).toBeUndefined();
  });

  it('is sensitive to model', () => {
    const key1 = cacheKey(BASE);
    const key2 = cacheKey({ ...BASE, model: 'other-model' });
    set(key1, ['a']);
    expect(get(key2)).toBeUndefined();
  });

  it('is sensitive to endpointUrl', () => {
    const key1 = cacheKey(BASE);
    const key2 = cacheKey({ ...BASE, endpointUrl: 'http://127.0.0.1:9090/v1' });
    set(key1, ['a']);
    expect(get(key2)).toBeUndefined();
  });

  it('treats an absent modifier the same across calls', () => {
    expect(cacheKey(BASE)).toBe(cacheKey({ ...BASE, modifier: undefined }));
  });

  it('evicts the least-recently-used entry once over capacity', () => {
    for (let i = 0; i < 100; i++) {
      set(cacheKey({ ...BASE, selectedText: `text-${i}` }), [`s${i}`]);
    }
    // 101st insertion should evict text-0 (oldest, never touched since insertion).
    set(cacheKey({ ...BASE, selectedText: 'text-100' }), ['s100']);
    expect(get(cacheKey({ ...BASE, selectedText: 'text-0' }))).toBeUndefined();
    expect(get(cacheKey({ ...BASE, selectedText: 'text-1' }))).toEqual(['s1']);
  });

  it('refreshes recency on hit, protecting it from eviction', () => {
    for (let i = 0; i < 100; i++) {
      set(cacheKey({ ...BASE, selectedText: `text-${i}` }), [`s${i}`]);
    }
    // Touch text-0 so it's no longer the least-recently-used entry.
    get(cacheKey({ ...BASE, selectedText: 'text-0' }));
    set(cacheKey({ ...BASE, selectedText: 'text-100' }), ['s100']);
    // text-1 was the oldest untouched entry now, so it gets evicted instead.
    expect(get(cacheKey({ ...BASE, selectedText: 'text-0' }))).toEqual(['s0']);
    expect(get(cacheKey({ ...BASE, selectedText: 'text-1' }))).toBeUndefined();
  });
});
