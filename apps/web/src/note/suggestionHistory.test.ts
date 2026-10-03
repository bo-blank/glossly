import { beforeEach, describe, expect, it } from 'vitest';
import { clear, forPhrase, record } from './suggestionHistory';

const texts = (phrase: string) => forPhrase(phrase).map((e) => e.text);

describe('suggestionHistory', () => {
  beforeEach(() => clear());

  it('is empty for an unknown phrase', () => {
    expect(forPhrase('walked quickly')).toEqual([]);
  });

  it('keeps the newest round first, each round in its own order', () => {
    record('walked quickly', ['a', 'b', 'c'], 'Tighter');
    record('walked quickly', ['d', 'e', 'f'], 'More vivid');
    expect(texts('walked quickly')).toEqual(['d', 'e', 'f', 'a', 'b', 'c']);
    expect(forPhrase('walked quickly')[0].label).toBe('More vivid');
    expect(forPhrase('walked quickly')[3].label).toBe('Tighter');
  });

  it('dedupes across rounds, moving a repeat up under its newest label', () => {
    record('walked quickly', ['a', 'b', 'c'], 'Tighter');
    record('walked quickly', ['b', 'd'], 'Plainer');
    expect(texts('walked quickly')).toEqual(['b', 'd', 'a', 'c']);
    expect(forPhrase('walked quickly')[0]).toEqual({ text: 'b', label: 'Plainer' });
  });

  it('keys on the trimmed phrase', () => {
    record(' walked quickly ', ['a'], 'Tighter');
    expect(texts('walked quickly')).toEqual(['a']);
  });

  it('caps a phrase at 30, dropping the oldest', () => {
    for (let round = 0; round < 12; round++) record('p', [`${round}a`, `${round}b`, `${round}c`], 'New suggestions');
    const all = texts('p');
    expect(all).toHaveLength(30);
    expect(all[0]).toBe('11a');
    expect(all.at(-1)).toBe('2c'); // rounds 0 and 1 fell off
  });

  it('caps at 200 phrases, evicting the least recently recorded', () => {
    for (let i = 0; i < 200; i++) record(`phrase ${i}`, ['x'], 'Tighter');
    record('phrase 0', ['y'], 'Tighter'); // refreshes phrase 0
    record('phrase 200', ['x'], 'Tighter');
    expect(texts('phrase 0')).toEqual(['y', 'x']);
    expect(forPhrase('phrase 1')).toEqual([]);
    expect(texts('phrase 200')).toEqual(['x']);
  });
});
