import { describe, expect, it } from 'vitest';
import { MAX_CONTEXT_CHARS, parseContext } from './validate';

const valid = { title: 'T', headingPath: ['A', 'B'], before: 'vorher ', after: ' nachher' };

describe('parseContext', () => {
  it('accepts a string from older clients, and a missing context', () => {
    expect(parseContext('Kontext')).toBe('Kontext');
    expect(parseContext(undefined)).toBe('');
  });

  it('accepts the structured shape and drops unknown fields', () => {
    expect(parseContext({ ...valid, extra: 'x' })).toEqual(valid);
  });

  it.each([
    ['a number', 42],
    ['an array', ['a']],
    ['a missing field', { title: 'T', headingPath: [], before: '' }],
    ['a non-string heading', { ...valid, headingPath: ['A', 3] }],
    ['too many headings', { ...valid, headingPath: ['1', '2', '3', '4', '5', '6', '7'] }],
    ['a non-string title', { ...valid, title: null }]
  ])('rejects %s', (_label, raw) => {
    expect(parseContext(raw)).toBeNull();
  });

  it('caps the total size', () => {
    const half = 'x'.repeat(MAX_CONTEXT_CHARS / 2);
    expect(parseContext({ ...valid, title: '', headingPath: [], before: half, after: half })).not.toBeNull();
    expect(parseContext({ ...valid, title: 'T', headingPath: [], before: half, after: half })).toBeNull();
    expect(parseContext('x'.repeat(MAX_CONTEXT_CHARS + 1))).toBeNull();
  });
});
