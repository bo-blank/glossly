// stores/blocksStore.ts
import { derived } from 'svelte/store';
import type { EditorState } from 'prosemirror-state';
import { editorStore } from './noteStore';
import { tocStore } from './tocStore';
import { blockPreview, blockText } from '../editor/blockDnd';
import { countWords } from '../utils/readability';
import { splitSentences, wordsOf } from '../utils/textUnits';
import { blockTexts } from '../editor/blockText';

export interface BlockInfo {
  index: number;
  /** Empty when unnamed. */
  name: string;
  /** First words, for a block without a name. */
  preview: string;
  /** The same count as the editor's word counter. */
  words: number;
  /** Words per sentence, in order, headings left out: the block's rhythm. */
  sentences: number[];
}

export interface BlocksState {
  blocks: BlockInfo[];
  /** The block holding the cursor, -1 without an editor. */
  current: number;
}

const OUTLINE_PREVIEW_WORDS = 6;

/**
 * The document's blocks for the lists beside the text. Recomputed when the
 * document changes (the table-of-contents extension reports every edit) and
 * when the selection moves — one pass over the blocks, cheap enough to keep
 * the word counts live while typing.
 */
export const blocksStore = derived<[typeof editorStore, typeof tocStore], BlocksState>([editorStore, tocStore], ([$editor]) => {
  const ed = $editor.editor;
  if (!ed || ed.isDestroyed) return { blocks: [], current: -1 };
  const { doc, selection } = ed.state as EditorState;
  const blocks: BlockInfo[] = [];
  doc.forEach((section, _offset, index) => {
    blocks.push({
      index,
      name: section.attrs.name,
      preview: blockPreview(section, OUTLINE_PREVIEW_WORDS),
      words: countWords(blockText(section)),
      sentences: blockTexts(section, (node) => node.type.name !== 'heading').flatMap((b) =>
        splitSentences(b.text).map((sentence) => wordsOf(sentence.text).length)
      )
    });
  });
  return { blocks, current: selection.$from.index(0) };
});
