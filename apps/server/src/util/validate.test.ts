import { describe, expect, it } from 'vitest';
import { MAX_CONTEXT_CHARS, parseContext, parseInstruction, parseTemperature } from './validate';

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

  it('accepts only du or Sie as the form of address', () => {
    expect(parseContext({ ...valid, address: 'du' })).toEqual({ ...valid, address: 'du' });
    expect(parseContext({ ...valid, address: 'Sie' })).toEqual({ ...valid, address: 'Sie' });
    expect(parseContext({ ...valid, address: 'ihr' })).toBeNull();
    expect(parseContext({ ...valid, address: 1 })).toBeNull();
  });

  it('caps the total size', () => {
    const half = 'x'.repeat(MAX_CONTEXT_CHARS / 2);
    expect(parseContext({ ...valid, title: '', headingPath: [], before: half, after: half })).not.toBeNull();
    expect(parseContext({ ...valid, title: 'T', headingPath: [], before: half, after: half })).toBeNull();
    expect(parseContext('x'.repeat(MAX_CONTEXT_CHARS + 1))).toBeNull();
  });
});

describe('parseTemperature', () => {
  it.each([0, 0.2, 0.8, 1.5])('accepts %s', (t) => expect(parseTemperature(t)).toBe(t));
  it('is undefined when absent', () => expect(parseTemperature(undefined)).toBeUndefined());
  it.each([-0.1, 1.6, Number.NaN, Infinity, '0.8', null, true])('rejects %s', (t) => expect(parseTemperature(t)).toBeNull());
});

describe('parseInstruction', () => {
  it('accepts a string up to 300 characters', () => {
    expect(parseInstruction('Keep it short.')).toBe('Keep it short.');
    expect(parseInstruction('x'.repeat(300))).toHaveLength(300);
  });
  it('is undefined when absent', () => expect(parseInstruction(undefined)).toBeUndefined());
  it.each(['', '   ', 'x'.repeat(301), 42, null, ['a']])('rejects %s', (raw) => expect(parseInstruction(raw)).toBeNull());
});
