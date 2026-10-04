import { createDocument, Node, type JSONContent } from '@tiptap/core';
import { Fragment, Slice, type Node as PMNode, type Schema } from 'prosemirror-model';
import { NodeSelection, Plugin, Selection, TextSelection, type Command } from 'prosemirror-state';
import { closeHistory } from 'prosemirror-history';
import { dropPoint } from 'prosemirror-transform';
import { sectionView } from './sectionView';
import { gapToIndex } from './blockDnd';

// Phase 5: the document is made of blocks, one per unit of meaning. A block is
// a `section` node with an optional name; it is not in the `block` group, so
// it can only sit directly in the document and never nests.

/** The document holds blocks and nothing else. Replaces StarterKit's document. */
export const SectionDocument = Node.create({
  name: 'doc',
  topNode: true,
  content: 'section+'
});

export const Section = Node.create({
  name: 'section',
  content: 'block+',
  defining: true,
  draggable: true,

  addAttributes() {
    return {
      name: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-block') ?? '',
        // Rendered by the node itself: an unnamed block must still carry the
        // attribute, or saved HTML would read as pre-block content (see hasSectionMarkup).
        rendered: false
      }
    };
  },

  parseHTML() {
    return [{ tag: 'section[data-block]' }];
  },

  renderHTML({ node }) {
    return ['section', { 'data-block': node.attrs.name }, 0];
  },

  addNodeView() {
    return sectionView;
  },

  addKeyboardShortcuts() {
    const run = (command: Command) => () => command(this.editor.state, this.editor.view.dispatch);
    return {
      'Mod-Shift-Enter': run(splitSection),
      Backspace: run(joinSectionBackward),
      Delete: run(joinSectionForward),
      // Swallowed at the ends too, so the browser does not extend the selection instead.
      'Alt-Shift-ArrowUp': () => (run(moveSectionBy(-1))(), true),
      'Alt-Shift-ArrowDown': () => (run(moveSectionBy(1))(), true)
    };
  },

  addProseMirrorPlugins() {
    return [sectionMoves];
  }
});

/**
 * New block from the cursor on (Mod+Shift+Enter). In the middle or at the end
 * of a paragraph the paragraph splits too; at its start, or anywhere in a
 * list or quote, the block splits before that paragraph, list or quote.
 * Nothing happens where the new block would be empty before the cursor.
 */
export const splitSection: Command = (state, dispatch) => {
  const { $from, empty } = state.selection;
  if (!empty || $from.depth < 2) return false;
  // The new block starts unnamed; split would copy the name otherwise.
  const unnamed = { type: state.schema.nodes.section, attrs: { name: '' } };
  if ($from.depth === 2 && $from.parent.isTextblock && $from.parentOffset > 0) {
    dispatch?.(state.tr.split($from.pos, 2, [unnamed, null]).scrollIntoView());
    return true;
  }
  if ($from.index(1) === 0) return false;
  dispatch?.(state.tr.split($from.before(2), 1, [unnamed]).scrollIntoView());
  return true;
};

/**
 * An empty block in `gap` (0 = before the first block, n = after the last),
 * with the cursor in it. Used by the + between blocks.
 */
export function insertSectionAt(gap: number): Command {
  return (state, dispatch) => {
    const { doc, schema } = state;
    if (gap < 0 || gap > doc.childCount) return false;
    if (dispatch) {
      const at = sectionStart(doc, gap);
      const tr = state.tr.insert(at, schema.nodes.section.create(null, schema.nodes.paragraph.create()));
      dispatch(tr.setSelection(TextSelection.create(tr.doc, at + 2)).scrollIntoView());
    }
    return true;
  };
}

/**
 * An empty block right after the one holding the cursor, with the cursor in
 * it. For places that have no cursor position to split at, like the table of
 * contents.
 */
export const insertSectionAfter: Command = (state, dispatch) =>
  insertSectionAt(state.selection.$from.index(0) + 1)(state, dispatch);

/** Whether the cursor sits at the very start (or end) of its block's text. */
function atSectionEdge(state: Parameters<Command>[0], side: 'start' | 'end'): number | null {
  const { $from, empty } = state.selection;
  if (!empty || $from.depth < 2 || !$from.parent.isTextblock) return null;
  if (side === 'start' ? $from.parentOffset !== 0 : $from.parentOffset !== $from.parent.content.size) return null;
  for (let d = $from.depth; d >= 2; d--) {
    const index = $from.index(d - 1);
    if (side === 'start' ? index !== 0 : index !== $from.node(d - 1).childCount - 1) return null;
  }
  return $from.index(0);
}

/** Joins the blocks around `boundary`; the merged block keeps the first name it finds. */
function joinAt(state: Parameters<Command>[0], dispatch: Parameters<Command>[1], boundary: number): boolean {
  const before = state.doc.resolve(boundary).nodeBefore!;
  const after = state.doc.resolve(boundary).nodeAfter!;
  const tr = state.tr.join(boundary);
  const sectionStart = boundary - before.nodeSize;
  tr.setNodeMarkup(sectionStart, undefined, { ...before.attrs, name: before.attrs.name || after.attrs.name });
  dispatch?.(tr.scrollIntoView());
  return true;
}

/**
 * Backspace at the very start of a block merges it into the one before; the
 * paragraphs stay apart. A second Backspace then joins them as usual.
 */
export const joinSectionBackward: Command = (state, dispatch) => {
  const index = atSectionEdge(state, 'start');
  if (index === null || index === 0) return false;
  return joinAt(state, dispatch, state.selection.$from.before(1));
};

/** Delete at the very end of a block merges the next one into it. */
export const joinSectionForward: Command = (state, dispatch) => {
  const index = atSectionEdge(state, 'end');
  if (index === null || index === state.doc.childCount - 1) return false;
  return joinAt(state, dispatch, state.selection.$from.after(1));
};

/** Names the block at `pos` (empty = unnamed), cleaned as stored. One undo step. */
export function renameSection(pos: number, name: string): Command {
  return (state, dispatch) => {
    const node = state.doc.nodeAt(pos);
    if (node?.type.name !== 'section') return false;
    const clean = cleanSectionName(name);
    if (clean === node.attrs.name) return false;
    dispatch?.(state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, name: clean }));
    return true;
  };
}

/**
 * Moves the block at index `from` so it ends up at index `to`. One transaction
 * and its own undo step, even right after typing or another move. A cursor or
 * selection inside the block travels with it; a selection collapses to its
 * head, which closes the margin note (ground rule 4). Shared by every way of
 * moving a block: keyboard, drag handle, outline, table of contents.
 */
export function moveSection(from: number, to: number): Command {
  return (state, dispatch) => {
    const { doc } = state;
    if (from === to || from < 0 || to < 0 || from >= doc.childCount || to >= doc.childCount) return false;
    if (!dispatch) return true;
    const node = doc.child(from);
    const start = sectionStart(doc, from);
    const tr = state.tr.delete(start, start + node.nodeSize);
    const target = sectionStart(tr.doc, to);
    tr.insert(target, node);

    const { selection } = state;
    const inside = selection.from >= start && selection.to <= start + node.nodeSize;
    if (inside && !(selection instanceof NodeSelection)) {
      const head = selection.head - start + target;
      tr.setSelection(TextSelection.create(tr.doc, head));
    } else if (inside) {
      tr.setSelection(Selection.near(tr.doc.resolve(target + 1)));
    }
    dispatch(closeHistory(tr).setMeta(SECTION_MOVE, true).scrollIntoView());
    return true;
  };
}

const SECTION_MOVE = 'glosslySectionMove';

/** Moves the block holding the cursor one place up (-1) or down (+1). */
export function moveSectionBy(delta: -1 | 1): Command {
  return (state, dispatch) => {
    const index = state.selection.$from.index(0);
    return moveSection(index, index + delta)(state, dispatch);
  };
}

/** Document position where the block at `index` starts. */
export function sectionStart(doc: PMNode, index: number): number {
  let pos = 0;
  for (let i = 0; i < index; i++) pos += doc.child(i).nodeSize;
  return pos;
}

/**
 * Where a dragged block would land: the index it ends up at, or null when the
 * drop is not a block move. Uses the same dropPoint as ProseMirror's drop
 * cursor, so the line the writer sees is where the block goes — a drop inside
 * a paragraph snaps to the nearest gap between blocks.
 */
export function sectionDropTarget(doc: PMNode, from: number, mousePos: number): number | null {
  const node = doc.child(from);
  const point = dropPoint(doc, mousePos, new Slice(Fragment.from(node), 0, 0));
  if (point === null) return null;
  const $point = doc.resolve(point);
  if ($point.depth !== 0) return null;
  return gapToIndex(from, $point.index(0));
}

/**
 * Block moves in the editor. Drops of a block dragged by its handle go through
 * moveSection instead of ProseMirror's generic delete-and-insert, so they
 * behave like the keyboard move — including dropping a block onto itself,
 * which changes nothing.
 */
export const sectionMoves = new Plugin({
  // The moved block is one big inserted range, so typing in it right after the
  // move would count as "adjacent" and join the move's undo step. A step-less
  // transaction that closes the history makes the next edit its own step.
  appendTransaction: (transactions, _old, state) =>
    transactions.some((tr) => tr.getMeta(SECTION_MOVE)) ? closeHistory(state.tr) : null,
  props: {
    handleDrop(view, event, _slice, moved) {
      const dragged = (view.dragging as { node?: NodeSelection } | null)?.node;
      if (!moved || !(dragged instanceof NodeSelection) || dragged.node.type.name !== 'section') return false;
      const from = view.state.doc.resolve(dragged.from).index(0);
      const mouse = view.posAtCoords({ left: event.clientX, top: event.clientY });
      const to = mouse ? sectionDropTarget(view.state.doc, from, mouse.pos) : null;
      if (to !== null) moveSection(from, to)(view.state, view.dispatch);
      view.focus();
      return true;
    }
  }
});

export const SECTION_NAME_MAX = 60;

/** A block name as stored: one line, trimmed, at most SECTION_NAME_MAX characters. */
export function cleanSectionName(name: string): string {
  return name.replace(/\s+/g, ' ').trim().slice(0, SECTION_NAME_MAX).trim();
}

/** Whether HTML was saved with blocks. Without them it predates Phase 5 and is split by rule A. */
export function hasSectionMarkup(html: string): boolean {
  return /<section\b[^>]*\sdata-block\b/i.test(html);
}

/** H1 and H2 open a new block; H3 and below are structure inside one. */
const opensBlock = (node: PMNode) => node.type.name === 'heading' && node.attrs.level <= 2;

/**
 * Rule A, for content that has no blocks yet: a new block before every H1/H2,
 * unless the block so far holds nothing but headings — so a title and the
 * chapter heading under it stay together. No headings, one block.
 *
 * Takes the document's blocks as they are and regroups their children; the
 * text itself is never touched.
 */
export function regroupSections(doc: PMNode): PMNode {
  const schema = doc.type.schema;
  const section = schema.nodes.section;
  const groups: PMNode[][] = [];
  let current: PMNode[] = [];
  doc.forEach((block) =>
    block.forEach((node) => {
      if (opensBlock(node) && current.some((n) => n.type.name !== 'heading')) {
        groups.push(current);
        current = [];
      }
      current.push(node);
    })
  );
  if (current.length) groups.push(current);
  if (groups.length === 0) return doc;
  return doc.type.create(doc.attrs, groups.map((nodes) => section.create(null, nodes)));
}

/**
 * Whether the blocks say more than the headings do: a name, or a split that
 * rule A would not make. Only then does Markdown need block markers (decision B).
 */
export function needsBlockMarkers(doc: PMNode): boolean {
  return !regroupSections(doc).eq(doc);
}

/**
 * Stored or template HTML as editor content. HTML saved with blocks passes
 * through unchanged; older HTML is wrapped by ProseMirror's parser (into one
 * block) and then split by rule A. Needs a DOM, so browser only.
 */
export function sectionedContent(html: string, schema: Schema): string | JSONContent {
  if (hasSectionMarkup(html)) return html;
  return regroupSections(createDocument(html, schema)).toJSON();
}
