import { describe, expect, it } from 'vitest';
import { droppedTerms, isProtectable, termsInSelection } from './protectedTerms';

describe('termsInSelection', () => {
  it('finds whole words, case-sensitive', () => {
    expect(termsInSelection(['Anna', 'Quellwerk', 'Mara'], 'Anna ging zum Quellwerk')).toEqual(['Anna', 'Quellwerk']);
    expect(termsInSelection(['Anna'], 'Annas Weg')).toEqual([]);
    expect(termsInSelection(['Anna'], 'anna ging')).toEqual([]);
    expect(termsInSelection(['Ölmühle'], 'zur Ölmühle,')).toEqual(['Ölmühle']);
  });

  it('treats regex characters in a term literally', () => {
    expect(termsInSelection(['C++', 'v2.0'], 'mit C++ und v2.0')).toEqual(['C++', 'v2.0']);
    expect(termsInSelection(['v2.0'], 'mit v2x0')).toEqual([]);
  });
});

describe('droppedTerms', () => {
  const selection = 'Anna ging langsam zum Quellwerk';
  it('is empty when every protected word survives', () => {
    expect(droppedTerms(['Anna', 'Quellwerk'], selection, 'Anna schlenderte zum Quellwerk')).toEqual([]);
  });
  it('names the words a suggestion changed', () => {
    expect(droppedTerms(['Anna', 'Quellwerk'], selection, 'Sie schlenderte zur Quelle')).toEqual(['Anna', 'Quellwerk']);
    expect(droppedTerms(['Anna'], selection, 'Annas Weg führte zum Quellwerk')).toEqual(['Anna']);
  });
  it('protects a deliberate repetition by counting', () => {
    expect(droppedTerms(['wartete'], 'wartete und wartete', 'wartete lange')).toEqual(['wartete']);
    expect(droppedTerms(['wartete'], 'wartete und wartete', 'wartete, wartete still')).toEqual([]);
  });
  it('ignores protected words that were not in the selection', () => {
    expect(droppedTerms(['Mara'], selection, 'ganz anders')).toEqual([]);
  });
});

describe('isProtectable', () => {
  it.each(['Anna', 'Quellwerk', 'Frau Weber', 'C++', ' Anna '])('offers %s', (s) => expect(isProtectable(s)).toBe(true));
  it.each(['', '   ', 'Sie ging. Dann kam er', 'Anna, Mara', 'x'.repeat(41), 'Zeile\nzwei', 'ging Anna langsam'])('not %s', (s) =>
    expect(isProtectable(s)).toBe(false)
  );
});
