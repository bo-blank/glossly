import type { Node as PMNode } from 'prosemirror-model';

// Moving blocks from outside the text (table of contents, later the outline):
// which entries belong to which block, and where a drop lands. Every path
// ends in moveSection, so they cannot drift apart from the editor's own drag.

export interface BlockGroup<T> {
  /** The block's index in the document. */
  index: number;
  /** Its headings, in order; may be empty. */
  headings: T[];
  /** Short grey stand-in for a block without headings: its name, else its first words (decision E). */
  label: string;
}

const PREVIEW_WORDS = 4;

/** First words of a block, for a block the table of contents has no heading for. */
export function blockPreview(section: PMNode): string {
  const words = section.textBetween(0, section.content.size, ' ', ' ').split(/\s+/).filter(Boolean);
  if (words.length === 0) return 'Empty block';
  return words.slice(0, PREVIEW_WORDS).join(' ') + (words.length > PREVIEW_WORDS ? ' …' : '');
}

/** Groups table-of-contents items (by their document position) under the block that holds them. */
export function groupByBlock<T extends { pos: number }>(doc: PMNode, items: T[]): BlockGroup<T>[] {
  const groups: BlockGroup<T>[] = [];
  doc.forEach((section, _offset, index) => {
    groups.push({ index, headings: [], label: (section.attrs.name as string) || blockPreview(section) });
  });
  for (const item of items) {
    if (item.pos < 0 || item.pos > doc.content.size) continue;
    groups[doc.resolve(item.pos).index(0)]?.headings.push(item);
  }
  return groups;
}

/**
 * The block's index after the move, for a drop into `gap` (0 = before the
 * first block, n = after the last). The gaps right before and after the
 * dragged block give its own index: a no-op.
 */
export function gapToIndex(from: number, gap: number): number {
  return gap > from ? gap - 1 : gap;
}

/** Which gap a pointer at `y` is nearest to, given each block's vertical extent on screen. */
export function gapAt(y: number, extents: { top: number; bottom: number }[]): number {
  for (let i = 0; i < extents.length; i++) {
    if (y < (extents[i].top + extents[i].bottom) / 2) return i;
  }
  return extents.length;
}
