<!-- components/TableOfContents.svelte -->
<script>
  import { tick } from 'svelte';
  import { Selection } from 'prosemirror-state';
  import { tocStore } from '../stores/tocStore';
  import { editorStore } from '../stores/noteStore';
  import { gapAt, gapToIndex, groupByBlock } from '../editor/blockDnd';
  import { moveSection, sectionStart } from '../editor/section';

  // Entries are grouped by block: dragging any entry, or the group's handle,
  // moves the whole block. A heading never moves on its own.

  const editor = $derived($editorStore.editor);
  // The extension reports on every document change, so this follows moves and typing.
  const groups = $derived(editor ? groupByBlock(editor.state.doc, $tocStore) : []);
  // One block without headings has nothing to navigate or reorder.
  const visible = $derived($tocStore.length > 0 || groups.length > 1);

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

  function move(from, to) {
    return !!editor && moveSection(from, to)(editor.state, editor.view.dispatch);
  }

  async function onEntryKeydown(e, index) {
    const mod = e.ctrlKey || e.metaKey;
    if (e.altKey && e.shiftKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      e.preventDefault();
      const to = index + (e.key === 'ArrowUp' ? -1 : 1);
      if (!move(index, to)) return;
      await tick();
      groupEls[to]?.querySelector('button')?.focus();
    } else if (mod && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) {
      // Undo and redo work from here too, so a move made here can be taken back here.
      e.preventDefault();
      editor?.commands.redo();
    } else if (mod && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      editor?.commands.undo();
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
          <div class="min-w-0 flex-1">
            {#each group.headings as item (item.id)}
              <button
                class="toc-entry"
                class:is-active={item.isActive}
                class:opacity-50={item.isScrolledOver && !item.isActive}
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
  </nav>
{/if}

<style>
  .toc-block {
    position: relative;
    display: flex;
    align-items: flex-start;
    border-radius: 0.375rem;
  }

  .toc-block + .toc-block {
    margin-top: 0.375rem;
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
      background-color: var(--gray-3);
      font-weight: 500;
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
