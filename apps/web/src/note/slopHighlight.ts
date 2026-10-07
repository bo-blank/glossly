// note/slopHighlight.ts
// Marks the treatment plan's findings in the text while the plan is open,
// and publishes them to slopStore for the list beside the text.
import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from 'prosemirror-state';
import { Decoration, DecorationSet, type EditorView } from 'prosemirror-view';
import type { Node as ProseMirrorNode } from 'prosemirror-model';
import { detectLanguage } from '@glossly/shared';
import { findSlop, type TextBlock } from '../utils/slop';
import type { TextLanguage } from '../utils/textUnits';
import { slopStore } from '../stores/slopStore';
import { blockTexts } from '../editor/blockText';

const DEBOUNCE_MS = 300;

const slopHighlightKey = new PluginKey('slopHighlight');

let open = false;
let fallbackLanguage: () => TextLanguage = () => 'de';

/** Opens or closes the plan: findings and marks appear or go at once. */
export function setSlopPlan(on: boolean, view?: EditorView) {
  open = on;
  slopStore.update((s) => ({ ...s, open: on, findings: on ? s.findings : [] }));
  view?.dispatch(view.state.tr.setMeta(slopHighlightKey, true));
}

function build(doc: ProseMirrorNode): DecorationSet {
  if (!open) return DecorationSet.empty;
  // Code is not prose.
  const blocks: TextBlock[] = [];
  doc.forEach((section, offset, index) => {
    const name = (section.attrs.name as string) || String(index + 1);
    // blockTexts counts from the section's content; +1 steps into it.
    for (const b of blockTexts(section, (node) => node.type.name !== 'codeBlock')) blocks.push({ ...b, pos: offset + b.pos + 1, section: name });
  });
  const detected = detectLanguage(blocks.map((b) => b.text).join(' '));
  const language: TextLanguage = detected === 'German' ? 'de' : detected === 'English' ? 'en' : fallbackLanguage();
  const findings = findSlop(blocks, language);
  slopStore.set({ open: true, findings, language });
  const decorations = findings.flatMap((f) =>
    f.hits.map((h) => Decoration.inline(h.from, h.to, { class: 'slop-mark', 'data-slop': f.rule }))
  );
  return DecorationSet.create(doc, decorations);
}

export const SlopHighlight = Extension.create<{ fallbackLanguage: () => TextLanguage }>({
  name: 'slopHighlight',

  addOptions() {
    return { fallbackLanguage: () => 'de' };
  },

  addProseMirrorPlugins() {
    const key = slopHighlightKey;
    fallbackLanguage = this.options.fallbackLanguage;
    let timer: ReturnType<typeof setTimeout> | undefined;

    return [
      new Plugin({
        key,
        state: {
          init: (_, { doc }) => build(doc),
          apply(tr, old) {
            if (tr.getMeta(key)) return build(tr.doc);
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
              if (!open || view.state.doc.eq(prevState.doc)) return;
              clearTimeout(timer);
              timer = setTimeout(() => view.dispatch(view.state.tr.setMeta(key, true)), DEBOUNCE_MS);
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
