<!-- components/TableOfContents.svelte -->
<script>
  import { flushSync } from 'svelte';
  import { Selection } from 'prosemirror-state';
  import { tocStore } from '../stores/tocStore';
  import { editorStore } from '../stores/noteStore';
  import { gapAt, gapToIndex, groupByBlock } from '../editor/blockDnd';
  import { insertSectionAfter, moveSection, sectionStart } from '../editor/section';

  // Entries are grouped by block: dragging any entry, or the group's handle,
  // moves the whole block. A heading never moves on its own.

  const editor = $derived($editorStore.editor);
  // The extension reports on every document change, so this follows moves and typing.
  const groups = $derived(editor ? groupByBlock(editor.state.doc, $tocStore) : []);
  // Where the writer is: the block holding the cursor, and in it the last
  // heading at or before the cursor. The extension's own isActive follows the
  // scroll position instead, which never changes in a document that fits on screen.
  // $editorStore is set on every selection change, $tocStore on every edit.
  const cursor = $derived.by(() => {
    $tocStore;
    if (!editor || !$editorStore.selection) return { block: -1, heading: null };
    const from = editor.state.selection.$from;
    const block = from.index(0);
    const group = groups[block];
    const heading = group?.headings.filter((item) => item.pos <= from.pos).at(-1)?.id ?? null;
    return { block, heading };
  });

  // Always there with a document: it also holds the New block button.
  const visible = $derived(groups.length > 0);

  /** @type {HTMLElement[]} */
  const groupEls = [];
  let dragFrom = $state(null);
  let dropGap = $state(null);

  function scrollToHeading(item) {
    editor?.chain().focus().setTextSelection(item.pos).scrollIntoView().run();
  }

  function scrollToBlock(index) {
    if (!editor) return;
    const { doc } = editor.state;
    const at = Selection.near(doc.resolve(sectionStart(doc, index) + 1)).from;
    editor.chain().focus().setTextSelection(at).scrollIntoView().run();
  }

  function newBlock() {
    if (!editor) return;
    insertSectionAfter(editor.state, editor.view.dispatch);
    editor.view.focus();
  }

  function move(from, to) {
    return !!editor && moveSection(from, to)(editor.state, editor.view.dispatch);
  }

  // Render now and put focus on the block's entry before the next key arrives:
  // the focused entry may have been replaced by the change, and focus left on
  // the page would swallow the next Alt+Shift+arrow or Ctrl+Z.
  function focusGroup(index) {
    flushSync();
    groupEls[Math.min(index, groups.length - 1)]?.querySelector('button')?.focus();
  }

  function onEntryKeydown(e, index) {
    const mod = e.ctrlKey || e.metaKey;
    const key = e.key.toLowerCase();
    if (e.altKey && e.shiftKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      e.preventDefault();
      const to = index + (e.key === 'ArrowUp' ? -1 : 1);
      if (move(index, to)) focusGroup(to);
    } else if (mod && (key === 'y' || key === 'z')) {
      // Undo and redo work from here too, so a move made here can be taken back here.
      e.preventDefault();
      if (key === 'y' || e.shiftKey) editor?.commands.redo();
      else editor?.commands.undo();
      focusGroup(index);
    }
  }

  function onDragStart(e, index) {
    if (!e.dataTransfer) return;
    dragFrom = index;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('application/x-glossly-block', String(index));
  }

  function endDrag() {
    dragFrom = null;
    dropGap = null;
  }

  function gapFor(e) {
    const extents = groupEls.slice(0, groups.length).map((el) => el.getBoundingClientRect());
    const gap = gapAt(e.clientY, extents);
    // The gaps around the dragged block change nothing, so they show no line.
    return gapToIndex(dragFrom, gap) === dragFrom ? null : gap;
  }

  function onDragOver(e) {
    if (dragFrom === null) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    dropGap = gapFor(e);
  }

  function onDragLeave(e) {
    if (!e.currentTarget.contains(e.relatedTarget)) dropGap = null;
  }

  function onDrop(e) {
    if (dragFrom === null) return;
    e.preventDefault();
    const gap = gapFor(e);
    if (gap !== null) move(dragFrom, gapToIndex(dragFrom, gap));
    endDrag();
    // Back to the text, cursor where it was: the pressed entry may be re-rendered
    // by the move, and focus left on the page would make Ctrl+Z do nothing.
    editor?.view.focus();
  }
</script>

{#if visible}
  <nav
    class="fixed top-24 hidden xl:block w-56 max-h-[70vh] overflow-y-auto text-sm"
    style="left: max(1rem, calc(50% - 320px - 15rem));"
    aria-label="Table of contents"
  >
    <ul class="toc" ondragover={onDragOver} ondragleave={onDragLeave} ondrop={onDrop}>
      {#each groups as group (group.index)}
        <li
          class="toc-block"
          class:is-current={cursor.block === group.index}
          class:drop-above={dropGap === group.index}
          class:drop-below={dropGap === groups.length && group.index === groups.length - 1}
          class:is-dragging={dragFrom === group.index}
          draggable="true"
          bind:this={groupEls[group.index]}
          ondragstart={(e) => onDragStart(e, group.index)}
          ondragend={endDrag}
          title="Drag to move this block (Alt+Shift+↑/↓)"
        >
          <span class="toc-handle" aria-hidden="true">
            <svg width="8" height="14" viewBox="0 0 10 16" fill="currentColor">
              {#each [3, 8, 13] as y}<circle cx="2.5" cy={y} r="1.5" /><circle cx="7.5" cy={y} r="1.5" />{/each}
            </svg>
          </span>
          <div class="toc-entries">
            {#each group.headings as item (item.id)}
              <button
                class="toc-entry"
                class:is-active={cursor.heading === item.id}
                aria-current={cursor.heading === item.id ? 'location' : undefined}
                style="padding-left: {0.5 + (item.level - 1) * 0.75}rem;"
                onclick={() => scrollToHeading(item)}
                onkeydown={(e) => onEntryKeydown(e, group.index)}
                title={item.textContent}
              >
                {item.textContent || 'Untitled'}
              </button>
            {:else}
              <button
                class="toc-entry toc-preview"
                class:is-active={cursor.block === group.index}
                aria-current={cursor.block === group.index ? 'location' : undefined}
                onclick={() => scrollToBlock(group.index)}
                onkeydown={(e) => onEntryKeydown(e, group.index)}
                title={group.label}
              >
                {group.label}
              </button>
            {/each}
          </div>
        </li>
      {/each}
    </ul>
    <button class="toc-new" onclick={newBlock} title="New empty block after the one with the cursor">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
      New block
    </button>
  </nav>
{/if}

<style>
  .toc-block {
    position: relative;
    display: flex;
    align-items: flex-start;
    border-radius: 0.375rem;
  }

  /* The block with the cursor: a tint and an accent bar beside its entries. */
  .toc-block.is-current .toc-entries {
    background-color: color-mix(in oklab, var(--color-primary) 6%, transparent);
    border-radius: 0.375rem;
    box-shadow: inset 2px 0 0 var(--color-primary);
  }

  .toc-block + .toc-block {
    margin-top: 0.375rem;
  }

  .toc-entries {
    flex: 1;
    min-width: 0;
  }

  .toc-handle {
    flex: none;
    width: 0.875rem;
    height: 1.75rem;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--gray-5);
    cursor: grab;
    opacity: 0;
    transition: opacity 0.15s;
  }

  .toc-block:hover .toc-handle,
  .toc-block:focus-within .toc-handle {
    opacity: 1;
  }

  .toc-entry {
    display: block;
    width: 100%;
    text-align: left;
    padding: 0.25rem 0.5rem;
    border-radius: 0.375rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    cursor: pointer;

    &:hover {
      background-color: var(--gray-2);
    }

    &:focus-visible {
      outline: 2px solid var(--color-primary);
      outline-offset: -2px;
    }

    &.is-active {
      background-color: color-mix(in oklab, var(--color-primary) 16%, transparent);
      font-weight: 600;
    }
  }

  .toc-new {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    margin: 0.75rem 0 0 0.875rem;
    padding: 0.25rem 0.5rem;
    border-radius: 0.375rem;
    color: var(--gray-5);
    cursor: pointer;

    &:hover {
      background-color: var(--gray-2);
      color: inherit;
    }

    &:focus-visible {
      outline: 2px solid var(--color-primary);
      outline-offset: -2px;
    }
  }

  .toc-preview {
    color: var(--gray-5);
    font-style: italic;
  }

  .is-dragging {
    opacity: 0.4;
  }

  /* The insertion line: drawn, not inserted, so the entries do not shift under the pointer. */
  .drop-above {
    box-shadow: 0 -2px 0 0 var(--color-primary);
  }

  .drop-below {
    box-shadow: 0 2px 0 0 var(--color-primary);
  }
</style>
