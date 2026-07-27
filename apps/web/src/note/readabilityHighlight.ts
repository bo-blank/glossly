// note/readabilityHighlight.ts
import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';
import type { Node as ProseMirrorNode } from 'prosemirror-model';
import { splitSentences, scoreSentence } from '../utils/readability';

const DEBOUNCE_MS = 300;
// Headings/code aren't prose sentences - scoring them by word count is meaningless.
const UNSCORED_NODE_TYPES = new Set(['codeBlock', 'heading']);

export const readabilityHighlightKey = new PluginKey('readabilityHighlight');

function buildDecorations(doc: ProseMirrorNode): DecorationSet {
  const decorations: Decoration[] = [];

  doc.descendants((node, pos) => {
    if (!node.isTextblock || UNSCORED_NODE_TYPES.has(node.type.name)) return;
    const text = node.textContent;
    if (!text.trim()) return;

    const blockStart = pos + 1;
    for (const sentence of splitSentences(text)) {
      const result = scoreSentence(sentence.text);
      if (!result) continue;
      decorations.push(
        Decoration.inline(blockStart + sentence.start, blockStart + sentence.end, {
          class: `readability-${result.tier}`
        })
      );
    }
  });

  return DecorationSet.create(doc, decorations);
}

export const ReadabilityHighlight = Extension.create({
  name: 'readabilityHighlight',

  addProseMirrorPlugins() {
    const key = readabilityHighlightKey;
    let timer: ReturnType<typeof setTimeout> | undefined;

    return [
      new Plugin({
        key,
        state: {
          init: (_, { doc }) => buildDecorations(doc),
          apply(tr, old) {
            if (tr.getMeta(key)) return buildDecorations(tr.doc);
            if (tr.docChanged) return old.map(tr.mapping, tr.doc);
            return old;
          }
        },
        props: {
          decorations(state) {
            return key.getState(state);
          }
        },
        view() {
          return {
            update(view, prevState) {
              if (view.state.doc.eq(prevState.doc)) return;
              clearTimeout(timer);
              timer = setTimeout(() => {
                view.dispatch(view.state.tr.setMeta(key, true));
              }, DEBOUNCE_MS);
            },
            destroy() {
              clearTimeout(timer);
            }
          };
        }
      })
    ];
  }
});
