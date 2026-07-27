import { describe, expect, it } from 'vitest';
import { expandToSentenceSelection } from './sentenceExpansion';

// expandToSentenceSelection only touches doc.resolve(pos), which in real ProseMirror
// returns a $pos with .start()/.end()/.parent.textContent — this fake mirrors that surface,
// including the node-start "+1" offset (blockOffset) that a real paragraph node introduces.
function docFrom(text: string, blockOffset = 1) {
  return {
    resolve(_pos: number) {
      return {
        start: () => blockOffset,
        end: () => blockOffset + text.length,
        parent: { textContent: text }
      };
    }
  };
}

function expandedText(text: string, from: number, to: number, blockOffset = 1): string | null {
  const doc = docFrom(text, blockOffset);
  const result = expandToSentenceSelection(doc, from, to);
  if (!result) return null;
  return text.slice(result.from - blockOffset, result.to - blockOffset);
}

describe('expandToSentenceSelection', () => {
  it('expands a mid-sentence phrase to the whole sentence', () => {
    const text = 'He walked quickly. Then he stopped. She waited.';
    // "walked" inside the first sentence (positions relative to blockOffset=1)
    expect(expandedText(text, 1 + 3, 1 + 9)).toBe('He walked quickly.');
  });

  it('leaves an already-exact sentence selection unchanged', () => {
    const text = 'He walked quickly. Then he stopped.';
    expect(expandedText(text, 1 + 0, 1 + 19)).toBe('He walked quickly.');
  });

  it('merges a selection spanning two sentences', () => {
    const text = 'He walked quickly. Then he stopped. She waited.';
    // spans from inside sentence 1 to inside sentence 2
    expect(expandedText(text, 1 + 10, 1 + 25)).toBe('He walked quickly. Then he stopped.');
  });

  it('respects the node-start offset (blockOffset != 1)', () => {
    const text = 'Short sentence one. Short sentence two.';
    const blockOffset = 47; // simulates a paragraph deep inside a larger doc
    expect(expandedText(text, blockOffset + 6, blockOffset + 14, blockOffset)).toBe('Short sentence one.');
  });

  it('caps merged selections at 600 characters', () => {
    const sentenceA = `A${'a'.repeat(298)}.`; // 300 chars
    const sentenceB = `B${'b'.repeat(298)}.`; // 300 chars
    const sentenceC = `C${'c'.repeat(298)}.`; // 300 chars
    const text = [sentenceA, sentenceB, sentenceC].join(' ');
    // Selection spans all three sentences (~900 chars); result must stay <= 600.
    const result = expandedText(text, 1, 1 + text.length);
    expect(result).not.toBeNull();
    expect(result!.length).toBeLessThanOrEqual(600);
    expect(result!.startsWith('A')).toBe(true);
  });

  it('clamps to 600 chars even for a single oversized sentence', () => {
    const hugeSentence = `${'x'.repeat(650)}.`;
    const doc = docFrom(hugeSentence);
    const result = expandToSentenceSelection(doc, 1 + 5, 1 + 10);
    expect(result).not.toBeNull();
    expect(result!.to - result!.from).toBeLessThanOrEqual(600);
  });

  it('returns null for an empty textblock', () => {
    expect(expandedText('', 1, 1)).toBeNull();
  });

  it('returns null when the selection falls outside any sentence span', () => {
    // whitespace-only text has no sentence spans at all
    expect(expandedText('   ', 1, 2)).toBeNull();
  });
});
