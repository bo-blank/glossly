import type { Editor } from '@tiptap/core';
import { Selection, TextSelection } from 'prosemirror-state';
import { moveSection, sectionStart } from './section';

// Shared by the lists that show blocks outside the text — the table of
// contents and the outline in the structure card — so both jump, move and
// undo the same way.

// Where a jump lands: the target's top a third of the way down the window,
// so the section reads from just above the middle, with a little of what
// comes before still in view.
const LAND_AT = 1 / 3;

/**
 * Puts the cursor at `pos` and scrolls the node starting at `nodePos` to
 * LAND_AT. Not Tiptap's focus().scrollIntoView(): that scrolls only as far
 * as needed, and its focus scrolls again a frame later.
 */
export function jumpTo(editor: Editor, pos: number, nodePos: number) {
  const { view } = editor;
  const { state } = view;
  view.dispatch(state.tr.setSelection(Selection.near(state.doc.resolve(pos))));
  view.focus();
  const target = view.nodeDOM(nodePos);
  if (!(target instanceof HTMLElement)) return;
  const top = target.getBoundingClientRect().top + window.scrollY - window.innerHeight * LAND_AT;
  const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  window.scrollTo({ top: Math.max(0, top), behavior: smooth ? 'smooth' : 'auto' });
}

/** Cursor to the start of block `index`, scrolled into place. */
export function jumpToBlock(editor: Editor, index: number) {
  const start = sectionStart(editor.state.doc, index);
  jumpTo(editor, start + 1, start);
}

export function moveBlock(editor: Editor, from: number, to: number): boolean {
  return moveSection(from, to)(editor.state, editor.view.dispatch);
}

/**
 * Keys on an entry that stands for block `index`: Alt+Shift+↑/↓ moves the
 * block, Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y undo and redo (so a move made from
 * the list can be taken back there). Returns the block index that should
 * have focus afterwards, or null when the key is not one of these.
 */
export function blockListKey(e: KeyboardEvent, editor: Editor, index: number): number | null {
  const mod = e.ctrlKey || e.metaKey;
  const key = e.key.toLowerCase();
  if (e.altKey && e.shiftKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
    e.preventDefault();
    const to = index + (e.key === 'ArrowUp' ? -1 : 1);
    return moveBlock(editor, index, to) ? to : index;
  }
  if (mod && (key === 'y' || key === 'z')) {
    e.preventDefault();
    if (key === 'y' || e.shiftKey) editor.commands.redo();
    else editor.commands.undo();
    return index;
  }
  return null;
}

/**
 * Scrolls `from` to LAND_AT at once, then selects [from, to). Instant, not
 * smooth: the margin note places itself from the selection's screen position
 * the moment the selection changes, so the scroll has to be done by then.
 */
export function revealRange(editor: Editor, from: number, to: number) {
  const { view } = editor;
  const top = view.coordsAtPos(from).top + window.scrollY - window.innerHeight * LAND_AT;
  window.scrollTo({ top: Math.max(0, top), behavior: 'auto' });
  view.focus();
  view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, from, to)));
}
