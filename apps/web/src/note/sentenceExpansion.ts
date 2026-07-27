import { splitSentences } from '../utils/readability';

const MAX_SENTENCE_LENGTH = 600;

export interface SentenceSelection {
  from: number;
  to: number;
}

/**
 * Expands [from, to) outward to the boundaries of the sentence(s) it overlaps, within the
 * enclosing textblock — never crossing into a sibling paragraph/heading. `doc.resolve(from)`
 * gives the parent textblock; `$from.start()` is that block's first content position (the
 * "+1 node-start offset" from readabilityHighlight.ts, computed the ProseMirror way instead
 * of via manual descendants tracking). Capped at 600 chars total; returns null if `from`
 * doesn't resolve into prose text or no sentence spans overlap the selection.
 */
export function expandToSentenceSelection(doc: any, from: number, to: number): SentenceSelection | null {
  const $from = doc.resolve(from);
  const blockStart: number = $from.start();
  const blockEnd: number = $from.end();
  const text: string = $from.parent.textContent;
  if (!text) return null;

  const selStart = Math.max(0, from - blockStart);
  const selEnd = Math.min(text.length, Math.max(selStart, to - blockStart));

  const overlapping = splitSentences(text).filter((s) => s.end > selStart && s.start < selEnd);
  if (overlapping.length === 0) return null;

  const mergedStart = overlapping[0].start;
  let mergedEnd = overlapping[0].end;
  for (let i = 1; i < overlapping.length; i++) {
    const candidateEnd = overlapping[i].end;
    if (candidateEnd - mergedStart > MAX_SENTENCE_LENGTH) break;
    mergedEnd = candidateEnd;
  }
  if (mergedEnd - mergedStart > MAX_SENTENCE_LENGTH) {
    mergedEnd = mergedStart + MAX_SENTENCE_LENGTH;
  }

  return {
    from: Math.min(blockEnd, blockStart + mergedStart),
    to: Math.min(blockEnd, blockStart + mergedEnd)
  };
}
