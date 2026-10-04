import type { Node as ProseMirrorNode } from 'prosemirror-model';

/**
 * The text of every textblock, aligned with document positions: a leaf such
 * as a hard break or an inline image counts as one character ("\n"), as it
 * takes one position. `textContent` skips them, so marks placed from it slid
 * one character to the left after every <br>.
 */
export function blockTexts(
  doc: ProseMirrorNode,
  include: (node: ProseMirrorNode) => boolean = () => true
): { text: string; pos: number; kind: 'text' | 'heading' | 'list' }[] {
  const out: { text: string; pos: number; kind: 'text' | 'heading' | 'list' }[] = [];
  doc.descendants((node, pos, parent) => {
    if (!node.isTextblock) return;
    if (include(node)) {
      const kind = node.type.name === 'heading' ? 'heading' : parent && /listItem|taskItem/.test(parent.type.name) ? 'list' : 'text';
      out.push({ text: node.textBetween(0, node.content.size, undefined, '\n'), pos: pos + 1, kind });
    }
    return false;
  });
  return out;
}
