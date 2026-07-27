import { describe, expect, it } from 'vitest';
import { snapToWordBoundaries } from './wordBoundary';

// snapToWordBoundaries only touches doc.content.size and doc.textBetween, so a
// plain string stand-in is enough — no ProseMirror doc needed.
function docFrom(text: string) {
  return {
    content: { size: text.length },
    textBetween: (from: number, to: number) => text.slice(from, to)
  };
}

function snapped(text: string, from: number, to: number): string {
  const doc = docFrom(text);
  const result = snapToWordBoundaries(doc, from, to);
  return text.slice(result.from, result.to);
}

describe('snapToWordBoundaries', () => {
  it('expands a mid-word selection to the full word', () => {
    //           0123456789
    const text = 'The quick brown fox';
    expect(snapped(text, 5, 7)).toBe('quick');
  });

  it('leaves an exact word selection untouched', () => {
    const text = 'The quick brown fox';
    expect(snapped(text, 4, 9)).toBe('quick');
  });

  it('expands both ends of a partial multi-word selection', () => {
    const text = 'The quick brown fox';
    expect(snapped(text, 6, 12)).toBe('quick brown');
  });

  it('absorbs trailing punctuation for multi-word selections', () => {
    const text = 'He walked quickly. Then he stopped.';
    expect(snapped(text, 3, 17)).toBe('walked quickly.');
  });

  it('does not absorb trailing punctuation for single words', () => {
    const text = 'He walked quickly. Then he stopped.';
    expect(snapped(text, 10, 17)).toBe('quickly');
  });

  it('keeps apostrophes and hyphens inside words', () => {
    const text = "it's a well-known fact";
    expect(snapped(text, 8, 12)).toBe('well-known');
    expect(snapped(text, 1, 3)).toBe("it's");
  });

  it('handles selections at document edges', () => {
    const text = 'edge case';
    expect(snapped(text, 0, 2)).toBe('edge');
    expect(snapped(text, 6, 9)).toBe('case');
  });
});
