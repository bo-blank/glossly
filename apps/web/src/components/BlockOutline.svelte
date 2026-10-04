<!-- components/BlockOutline.svelte -->
<script lang="ts">
  // The outline of the document's blocks in the structure card: one row per
  // block with its name (or first words) and word count, the template's
  // guide note under the block it belongs to. Rows move blocks (drag,
  // Alt+Shift+↑/↓), jump to them (click) and rename them (double-click,
  // pencil, F2) — through the same commands as the text and the table of contents.
  import { flushSync } from 'svelte';
  import { editorStore } from '../stores/noteStore';
  import { blocksStore } from '../stores/blocksStore';
  import { gapAt, gapToIndex } from '../editor/blockDnd';
  import { blockListKey, jumpToBlock, moveBlock } from '../editor/blockNav';
  import { renameSection, sectionStart, SECTION_NAME_MAX } from '../editor/section';
  import type { GuideNote } from '../editor/templates';
  import { SLOP_LIMITS } from '../utils/slop';

  interface Props {
    /** The template's guide notes; empty without a template. */
    guide: GuideNote[];
    /** False once the writer closed the guide: the outline stays, the notes go. */
    showHints: boolean;
    language: 'de' | 'en';
  }
  let { guide, showHints, language }: Props = $props();

  const T = {
    de: {
      words: 'Wörter',
      rename: 'Umbenennen',
      name: 'Blockname',
      general: 'ganzer Text',
      move: 'Ziehen oder Alt+Shift+↑/↓ zum Verschieben',
      rhythm: 'Rhythmus: ein Balken pro Satz, Höhe = Länge. Blau: höchstens 4 Wörter, gelb: über 20.',
      lengths: 'Satzlängen'
    },
    en: {
      words: 'words',
      rename: 'Rename',
      name: 'Block name',
      general: 'whole text',
      move: 'Drag or Alt+Shift+↑/↓ to move',
      rhythm: 'Rhythm: one bar per sentence, height = length. Blue: 4 words or fewer, yellow: over 20.',
      lengths: 'Sentence lengths'
    }
  };
  const t = $derived(T[language]);

  // The rhythm strip: one bar per sentence, the height capped at 24 words —
  // past that, all are simply long.
  const BAR = 4;
  const BAR_HEIGHT = 20;
  const STACCATO_WORDS = SLOP_LIMITS.staccato.maxWords;
  const LONG_SENTENCE_WORDS = 20;
  const barHeight = (words: number) => Math.max(2.5, (Math.min(words, 24) / 24) * BAR_HEIGHT);

  const editor = $derived($editorStore.editor);
  const blocks = $derived($blocksStore.blocks);
  const current = $derived($blocksStore.current);

  // A note belongs to the block of the same name (any case). Notes that apply
  // to the whole text, or whose block was renamed or removed, go below.
  const key = (s: string) => s.trim().toLowerCase();
  const hintFor = $derived.by(() => {
    const byName = new Map<string, GuideNote>();
    if (showHints) for (const note of guide) if (!note.general) byName.set(key(note.section), note);
    return blocks.map((b) => (b.name ? byName.get(key(b.name)) : undefined));
  });
  const otherNotes = $derived.by(() => {
    if (!showHints) return [];
    const names = new Set(blocks.map((b) => key(b.name)).filter(Boolean));
    return guide.filter((note) => note.general || !names.has(key(note.section)));
  });

  const rowEls: HTMLElement[] = [];
  let dragFrom = $state<number | null>(null);
  let dropGap = $state<number | null>(null);
  let editing = $state<number | null>(null);
  let draft = $state('');

  // Render now and focus the row before the next key arrives: the change may
  // re-render the focused row, and focus left on the page would swallow the
  // next Alt+Shift+arrow or Ctrl+Z.
  function focusRow(index: number) {
    flushSync();
    rowEls[Math.min(index, blocks.length - 1)]?.querySelector<HTMLElement>('.ol-label')?.focus();
  }

  function onRowKeydown(e: KeyboardEvent, index: number) {
    if (!editor) return;
    if (e.key === 'F2') {
      e.preventDefault();
      startRename(index);
      return;
    }
    const next = blockListKey(e, editor, index);
    if (next != null) focusRow(next);
  }

  function startRename(index: number) {
    if (!editor?.isEditable) return;
    draft = blocks[index]?.name ?? '';
    editing = index;
    flushSync();
    const input = rowEls[index]?.querySelector<HTMLInputElement>('input');
    input?.focus();
    input?.select();
  }

  function finishRename(save: boolean) {
    if (editing === null) return;
    const index = editing;
    editing = null;
    if (save && editor) renameSection(sectionStart(editor.state.doc, index), draft)(editor.state, editor.view.dispatch);
    focusRow(index);
  }

  function onInputKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      finishRename(true);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      finishRename(false);
    }
  }

  function onDragStart(e: DragEvent, index: number) {
    if (!e.dataTransfer || editing !== null) return;
    dragFrom = index;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('application/x-glossly-block', String(index));
  }

  function endDrag() {
    dragFrom = null;
    dropGap = null;
  }

  function gapFor(e: DragEvent): number | null {
    if (dragFrom === null) return null;
    const gap = gapAt(e.clientY, rowEls.slice(0, blocks.length).map((el) => el.getBoundingClientRect()));
    // The gaps around the dragged block change nothing, so they show no line.
    return gapToIndex(dragFrom, gap) === dragFrom ? null : gap;
  }

  function onDragOver(e: DragEvent) {
    if (dragFrom === null) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
    dropGap = gapFor(e);
  }

  function onDragLeave(e: DragEvent) {
    if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node | null)) dropGap = null;
  }

  function onDrop(e: DragEvent) {
    if (dragFrom === null) return;
    e.preventDefault();
    const gap = gapFor(e);
    if (gap !== null && editor) moveBlock(editor, dragFrom, gapToIndex(dragFrom, gap));
    endDrag();
    // Back to the text, so Ctrl+Z works right away.
    editor?.view.focus();
  }
</script>

<ol class="ol" ondragover={onDragOver} ondragleave={onDragLeave} ondrop={onDrop}>
  {#each blocks as block (block.index)}
    {@const hint = hintFor[block.index]}
    <li
      class="ol-row"
      class:is-current={current === block.index}
      class:drop-above={dropGap === block.index}
      class:drop-below={dropGap === blocks.length && block.index === blocks.length - 1}
      class:is-dragging={dragFrom === block.index}
      draggable={editing === null}
      bind:this={rowEls[block.index]}
      ondragstart={(e) => onDragStart(e, block.index)}
      ondragend={endDrag}
      title={t.move}
    >
      <span class="ol-handle" aria-hidden="true">
        <svg width="8" height="14" viewBox="0 0 10 16" fill="currentColor">
          {#each [3, 8, 13] as y}<circle cx="2.5" cy={y} r="1.5" /><circle cx="7.5" cy={y} r="1.5" />{/each}
        </svg>
      </span>
      <div class="ol-body">
        <div class="ol-line">
          {#if editing === block.index}
            <input
              class="ol-input"
              bind:value={draft}
              maxlength={SECTION_NAME_MAX}
              placeholder={block.preview}
              aria-label={t.name}
              onkeydown={onInputKeydown}
              onblur={() => finishRename(true)}
            />
          {:else}
            <button
              class="ol-label"
              class:unnamed={!block.name}
              aria-current={current === block.index ? 'location' : undefined}
              onclick={() => editor && jumpToBlock(editor, block.index)}
              ondblclick={() => startRename(block.index)}
              onkeydown={(e) => onRowKeydown(e, block.index)}
            >
              {block.name || block.preview}
            </button>
            <button class="ol-rename" tabindex="-1" aria-label="{t.rename}: {block.name || block.preview}" title="{t.rename} (F2)" onclick={() => startRename(block.index)}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
            </button>
          {/if}
          <span class="ol-words" title="{block.words} {t.words}">{block.words}</span>
        </div>
        {#if block.sentences.length >= 2}
          <!-- The block's rhythm at a glance: staccato is a comb of stubs, monotony a flat line. -->
          <svg
            class="ol-rhythm"
            viewBox="0 0 {block.sentences.length * BAR} {BAR_HEIGHT}"
            preserveAspectRatio="none"
            style="width: {Math.min(block.sentences.length * BAR * 1.5, 180)}px"
            role="img"
            aria-label="{t.lengths}: {block.sentences.join(', ')}"
          >
            <title>{t.rhythm}</title>
            {#each block.sentences as n, i}
              <rect
                x={i * BAR}
                y={BAR_HEIGHT - barHeight(n)}
                width={BAR - 1}
                height={barHeight(n)}
                class:short={n <= STACCATO_WORDS}
                class:long={n > LONG_SENTENCE_WORDS}
              />
            {/each}
          </svg>
        {/if}
        {#if hint}<p class="ol-hint">{hint.hint}</p>{/if}
      </div>
    </li>
  {/each}
</ol>

{#if otherNotes.length}
  <dl class="ol-notes">
    {#each otherNotes as note (note.section)}
      <div>
        <dt class="font-medium">{note.section}{#if note.general}<span class="font-normal opacity-60 ml-1">· {t.general}</span>{/if}</dt>
        <dd class="opacity-70 leading-snug">{note.hint}</dd>
      </div>
    {/each}
  </dl>
{/if}

<style>
  .ol-row {
    position: relative;
    display: flex;
    align-items: flex-start;
    border-radius: 0.375rem;
  }

  .ol-row + .ol-row {
    margin-top: 0.25rem;
  }

  .ol-handle {
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

  .ol-row:hover .ol-handle,
  .ol-row:focus-within .ol-handle {
    opacity: 1;
  }

  .ol-body {
    flex: 1;
    min-width: 0;
    padding: 0 0.25rem 0.25rem 0.375rem;
    border-radius: 0.375rem;
  }

  /* The block with the cursor, as in the table of contents. */
  .is-current .ol-body {
    background-color: color-mix(in oklab, var(--color-primary) 8%, transparent);
    box-shadow: inset 2px 0 0 var(--color-primary);
  }

  .ol-line {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    min-height: 1.75rem;
  }

  .ol-label {
    flex: 1;
    min-width: 0;
    text-align: left;
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    cursor: pointer;
    border-radius: 0.25rem;

    &.unnamed {
      font-weight: 400;
      font-style: italic;
      color: var(--gray-5);
    }

    &:focus-visible {
      outline: 2px solid var(--color-primary);
      outline-offset: 1px;
    }
  }

  .ol-rename {
    flex: none;
    padding: 0.125rem;
    border-radius: 0.25rem;
    color: var(--gray-5);
    cursor: pointer;
    opacity: 0;

    &:hover {
      color: inherit;
      background-color: var(--gray-2);
    }
  }

  .ol-row:hover .ol-rename,
  .ol-row:focus-within .ol-rename {
    opacity: 1;
  }

  .ol-words {
    flex: none;
    font-size: 0.75rem;
    font-variant-numeric: tabular-nums;
    color: var(--gray-5);
  }

  .ol-input {
    flex: 1;
    min-width: 0;
    font: inherit;
    font-weight: 500;
    background: transparent;
    border: none;
    border-bottom: 1px solid var(--gray-4);
    outline: none;
    padding: 0;
  }

  .ol-rhythm {
    display: block;
    height: 20px;
    margin: 0.125rem 0 0.25rem;

    rect {
      fill: var(--gray-4);
    }

    rect.short {
      fill: color-mix(in oklab, var(--color-primary) 70%, transparent);
    }

    rect.long {
      fill: color-mix(in oklab, var(--color-warning) 85%, transparent);
    }
  }

  .ol-hint {
    font-size: 0.8125rem;
    line-height: 1.35;
    opacity: 0.7;
    padding-bottom: 0.125rem;
  }

  .ol-notes {
    margin-top: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .is-dragging {
    opacity: 0.4;
  }

  /* The insertion line: drawn, not inserted, so rows do not shift under the pointer. */
  .drop-above {
    box-shadow: 0 -2px 0 0 var(--color-primary);
  }

  .drop-below {
    box-shadow: 0 2px 0 0 var(--color-primary);
  }
</style>
