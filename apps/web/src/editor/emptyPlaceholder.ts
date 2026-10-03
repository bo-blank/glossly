import { Extension } from '@tiptap/core';
import type { Node as PMNode } from 'prosemirror-model';
import { Plugin, PluginKey } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';

/**
 * The paragraph that shows the empty-editor placeholder, or null. Empty means
 * one block holding one empty paragraph, the shape a cleared document has.
 */
export function emptyParagraphPos(doc: PMNode): number | null {
  if (doc.childCount !== 1) return null;
  const section = doc.firstChild!;
  if (section.childCount !== 1) return null;
  const p = section.firstChild!;
  return p.type.name === 'paragraph' && p.content.size === 0 ? 1 : null;
}

/**
 * Tiptap's Placeholder only looks at top-level nodes unless `includeChildren`
 * is set, and with that set it decides "the editor is empty" from the state
 * before the transaction (Tiptap 3.31), so the hint showed one keystroke late.
 * Glossly only needs the empty-document case, so it gets this instead. The
 * class and attribute match Placeholder's, so the CSS is unchanged.
 */
export const EmptyPlaceholder = Extension.create<{ placeholder: () => string }>({
  name: 'emptyPlaceholder',

  addOptions() {
    return { placeholder: () => '' };
  },

  addProseMirrorPlugins() {
    const { placeholder } = this.options;
    return [
      new Plugin({
        key: new PluginKey('emptyPlaceholder'),
        props: {
          decorations: ({ doc }) => {
            const pos = emptyParagraphPos(doc);
            if (pos === null) return null;
            const p = doc.nodeAt(pos)!;
            return DecorationSet.create(doc, [
              Decoration.node(pos, pos + p.nodeSize, { class: 'is-empty is-editor-empty', 'data-placeholder': placeholder() })
            ]);
          }
        }
      })
    ];
  }
});
