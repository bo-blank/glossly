import type { NodeViewRenderer } from '@tiptap/core';
import { Selection } from 'prosemirror-state';
import { renameSection, SECTION_NAME_MAX } from './section';

const NAME_THIS = 'Name this block';

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

  const contentDOM = document.createElement('div');
  contentDOM.className = 'glossly-block-content';
  dom.append(label, contentDOM);

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
    stopEvent: (event) => label.contains(event.target as globalThis.Node),
    ignoreMutation: (mutation) =>
      label.contains(mutation.target) || (mutation.type === 'attributes' && mutation.target === dom && mutation.attributeName === 'class')
  };
};
