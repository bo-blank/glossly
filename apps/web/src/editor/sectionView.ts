import type { NodeViewRenderer } from '@tiptap/core';
import { NodeSelection, Selection } from 'prosemirror-state';
import { insertSectionAt, renameSection, SECTION_NAME_MAX } from './section';

const NAME_THIS = 'Name this block';

// Six dots, drawn rather than typed: the ⠿ glyph renders too thin to find.
const GRIP =
  '<svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor" aria-hidden="true">' +
  [3, 8, 13].map((y) => `<circle cx="2.5" cy="${y}" r="1.5"/><circle cx="7.5" cy="${y}" r="1.5"/>`).join('') +
  '</svg>';

/**
 * A block in the editor: its name in a small grey line above the text, and
 * the text itself. The name is not document text — it never reaches
 * textContent, the word count or the model. Unnamed blocks show
 * "Name this block" on hover only (decision C).
 */
export const sectionView: NodeViewRenderer = ({ node: initial, getPos, editor }) => {
  let node = initial;

  const dom = document.createElement('div');
  dom.className = 'glossly-block';

  const label = document.createElement('div');
  label.className = 'glossly-block-label';
  label.contentEditable = 'false';

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'glossly-block-name';
  label.append(button);

  // Mouse only: the keyboard moves blocks with Alt+Shift+↑/↓.
  const handle = document.createElement('div');
  handle.className = 'glossly-block-handle';
  handle.contentEditable = 'false';
  handle.draggable = true;
  handle.dataset.dragHandle = '';
  handle.innerHTML = GRIP;
  handle.title = 'Drag to move this block (Alt+Shift+↑/↓)';
  handle.setAttribute('aria-hidden', 'true');

  const contentDOM = document.createElement('div');
  contentDOM.className = 'glossly-block-content';

  // A line with a + in the gap above the block (and below the last one, see
  // styles.scss), shown on hover: click adds an empty block there.
  const insertBefore = inserter('before');
  const insertAfter = inserter('after');
  dom.append(insertBefore, handle, label, contentDOM, insertAfter);

  function inserter(side: 'before' | 'after') {
    const gap = document.createElement('div');
    gap.className = `glossly-gap glossly-gap-${side}`;
    gap.contentEditable = 'false';
    const plus = document.createElement('button');
    plus.type = 'button';
    plus.className = 'glossly-gap-add';
    plus.textContent = '+';
    plus.title = 'Add a block here';
    plus.setAttribute('aria-label', side === 'before' ? 'Add a block above' : 'Add a block below');
    gap.append(plus);
    // Keep the editor's focus and selection until the click decides.
    gap.addEventListener('mousedown', (e) => e.preventDefault());
    gap.addEventListener('click', (e) => {
      e.preventDefault();
      const pos = getPos();
      if (typeof pos !== 'number' || !editor.isEditable) return;
      const { state } = editor.view;
      const index = state.doc.resolve(pos).index(0);
      insertSectionAt(side === 'before' ? index : index + 1)(state, editor.view.dispatch);
      editor.view.focus();
    });
    return gap;
  }

  let dragging: typeof editor.view.dragging = null;
  // The drag is started here rather than by ProseMirror, which would drag an
  // existing text selection instead of the block when one lies under the
  // pointer. The drop is handled by moveSection (section.ts).
  handle.addEventListener('dragstart', (e) => {
    const pos = getPos();
    const { view } = editor;
    if (typeof pos !== 'number' || !e.dataTransfer || !editor.isEditable) {
      e.preventDefault();
      return;
    }
    const selection = NodeSelection.create(view.state.doc, pos);
    const slice = selection.content();
    const { dom: html, text } = view.serializeForClipboard(slice);
    e.dataTransfer.clearData();
    e.dataTransfer.setData('text/html', html.innerHTML);
    e.dataTransfer.setData('text/plain', text);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setDragImage(dom, 0, 0);
    // `node` is what ProseMirror's own drags carry too; sectionDrop reads it.
    dragging = Object.assign({ slice, move: true }, { node: selection });
    view.dragging = dragging;
    dom.classList.add('is-dragging');
  });
  handle.addEventListener('dragend', () => {
    dom.classList.remove('is-dragging');
    // A drop in the editor clears it; one outside (or Escape) does not.
    const ended = dragging;
    setTimeout(() => {
      if (editor.view.dragging === ended) editor.view.dragging = null;
    }, 50);
  });

  let input: HTMLInputElement | null = null;

  function render() {
    const name = node.attrs.name as string;
    dom.classList.toggle('is-named', !!name);
    button.textContent = name || NAME_THIS;
    button.title = name ? `Rename block “${name}”` : NAME_THIS;
    button.setAttribute('aria-label', name ? `Block “${name}” — rename` : NAME_THIS);
  }

  function rename(name: string) {
    const pos = getPos();
    if (typeof pos === 'number') renameSection(pos, name)(editor.view.state, editor.view.dispatch);
  }

  function startEditing() {
    if (input || !editor.isEditable) return;
    input = document.createElement('input');
    input.type = 'text';
    input.className = 'glossly-block-input';
    input.value = node.attrs.name;
    input.maxLength = SECTION_NAME_MAX;
    input.placeholder = NAME_THIS;
    input.setAttribute('aria-label', 'Block name');
    let done = false;
    const finish = (save: boolean) => {
      if (done || !input) return;
      done = true;
      const value = input.value;
      input.replaceWith(button);
      input = null;
      dom.classList.remove('is-editing');
      if (save) rename(value);
      // Back to the text, at the start of this block.
      const pos = getPos();
      if (typeof pos === 'number') {
        const { state } = editor.view;
        editor.view.dispatch(state.tr.setSelection(Selection.near(state.doc.resolve(pos + 1))));
        editor.view.focus();
      }
    };
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        finish(true);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        finish(false);
      }
    });
    input.addEventListener('blur', () => finish(true));
    dom.classList.add('is-editing');
    button.replaceWith(input);
    input.focus();
    input.select();
  }

  button.addEventListener('click', (e) => {
    e.preventDefault();
    startEditing();
  });

  const isUI = (target: globalThis.Node) =>
    [label, handle, insertBefore, insertAfter].some((el) => el.contains(target));

  render();

  return {
    dom,
    contentDOM,
    update(updated) {
      if (updated.type !== node.type) return false;
      node = updated;
      if (!input) render();
      return true;
    },
    // The label is UI, not document: ProseMirror must neither handle its
    // events nor treat its changes as edits. That includes the state classes
    // on the block itself — any other mutation of it makes ProseMirror rebuild
    // the view, which would throw away an open name input.
    // Except drops on the + strips: they sit exactly where a dragged block goes.
    stopEvent: (event) => {
      const target = event.target as globalThis.Node;
      const onGap = insertBefore.contains(target) || insertAfter.contains(target);
      if (onGap && (event.type.startsWith('drag') || event.type === 'drop')) return false;
      return isUI(target);
    },
    ignoreMutation: (mutation) =>
      isUI(mutation.target) || (mutation.type === 'attributes' && mutation.target === dom && mutation.attributeName === 'class')
  };
};
