<!-- components/MarginNote.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { noteStore, editorStore } from '../stores/noteStore';
  import { settingsStore } from '../stores/settingsStore';
  import { requestWithModifier, requestSentenceRewrite, dismiss } from '../note/requestSuggestions';
  import { diffWords, type Segment } from '../note/wordDiff';
  import { forPhrase } from '../note/suggestionHistory';
  import { loadStatusText } from '../note/loadStatusText';
  import { droppedTerms, isProtectable, termsInSelection, withTerm, withoutTerm } from '../note/protectedTerms';
  import { activeProtectedTerms, documentStore, setProtectedTerms } from '../storage/documentStore';

  // Tooltips say in plain words what each chip will do, for writers who don't
  // already think in terms of "register" or "concision". Custom chips show
  // their own instruction instead.
  const MODIFIER_CHIPS = [
    { label: 'Tighter', tip: 'Fewer words, same meaning', run: () => requestWithModifier('tighter') },
    { label: 'More vivid', tip: 'More concrete and sensory, without getting flowery', run: () => requestWithModifier('vivid') },
    { label: 'Plainer', tip: 'Simpler words, more direct', run: () => requestWithModifier('plain') }
  ];
  const ACTION_CHIPS = [
    { label: 'Rewrite sentence', tip: 'Rework the whole sentence, not just the selection', run: requestSentenceRewrite },
    { label: 'New suggestions', tip: 'Three different alternatives', run: () => requestWithModifier('more') }
  ];

  let noteRef: HTMLElement | undefined = $state();

  // Suggestions arrive whole (one SSE event each) and there are at most three,
  // so re-diffing the list when one lands costs nothing worth caching.
  let diffs = $derived($noteStore.suggestions.map((s) => diffWords($noteStore.original, s)));
  // The suggestion under the mouse or keyboard focus: its removed words are
  // struck through in the original line.
  let activeIndex: number | null = $state(null);
  let originalSegments: Segment[] = $derived(
    activeIndex !== null && diffs[activeIndex] ? diffs[activeIndex].original : [{ text: $noteStore.original, kind: 'same' }]
  );

  // Protected words of this document that the current selection contains. A
  // suggestion that loses one is flagged, not hidden: the writer decides.
  let docTerms = $derived(activeProtectedTerms($documentStore));
  let selectionTerms = $derived(termsInSelection(docTerms, $noteStore.original));
  let lost = $derived($noteStore.suggestions.map((s) => droppedTerms(selectionTerms, $noteStore.original, s)));
  // Only with the IndexedDB backend: it keeps a document list to store the words on.
  let canProtect = $derived(
    $documentStore.documents.some((d) => d.id === $documentStore.activeId) && isProtectable($noteStore.original)
  );
  let isProtected = $derived(docTerms.includes($noteStore.original.trim()));

  function toggleProtected() {
    const id = $documentStore.activeId;
    const term = $noteStore.original;
    void setProtectedTerms(id, isProtected ? withoutTerm(docTerms, term) : withTerm(docTerms, term));
  }

  const lostLabel = (terms: string[]) => `changes ${terms.map((t) => `“${t}”`).join(', ')}`;

  // History isn't reactive itself; every record() lands just before a noteStore
  // update, which re-runs this.
  let earlier = $derived(
    forPhrase($noteStore.original)
      .filter((e) => !$noteStore.suggestions.includes(e.text))
      .map((e) => ({
        ...e,
        segments: diffWords($noteStore.original, e.text).suggestion,
        lost: droppedTerms(selectionTerms, $noteStore.original, e.text)
      }))
  );

  // Seconds since the request started, ticking only while the server reports a wait.
  let now = $state(Date.now());
  $effect(() => {
    if (!$noteStore.loadStatus) return;
    now = Date.now();
    const tick = setInterval(() => (now = Date.now()), 1000);
    return () => clearInterval(tick);
  });
  let waitSeconds = $derived($noteStore.loadStatus ? Math.max(0, Math.round((now - $noteStore.loadStatus.since) / 1000)) : 0);

  function applySuggestion(suggestion: string) {
    // Use the editor instance to replace selected text
    const editor = $editorStore.editor;
    if (!editor) return;

    // Get the current selection range
    const { from, to } = $editorStore.selection;

    if (from === to) return; // No selection
    // The note keeps the previous suggestions until a new selection's debounce
    // fires. Alt+1–3 in that window must not paste them over different text.
    if (editor.state.doc.textBetween(from, to, '\n') !== $noteStore.original) return;

    // Create a transaction to replace the selected text with the suggestion
    // Use the editor's chain method for proper undo support as per §7.3
    editor.chain()
      .deleteRange({ from, to })
      .insertContentAt(from, suggestion)
      .run();

    dismiss();
  }

  onMount(() => {
    const handleClick = (e: MouseEvent) => {
      if (!$noteStore.visible) return;
      // Use composedPath() instead of noteRef.contains(e.target): clicking a modifier chip
      // (Tighter/vivid/Plainer) synchronously flips the note into its loading state, which
      // unmounts the suggestions/chip row — including the very button just clicked — before
      // this bubbled document listener runs. e.target would then be a detached node that
      // .contains() always reports as "outside", closing the note instead of refreshing it.
      // composedPath() is captured at dispatch time, so it still reflects the live tree.
      if (noteRef && e.composedPath().includes(noteRef)) return;
      // A text selection inside the editor ends with a trailing click on mouseup — that's a
      // new selection superseding the note via onSelectionChange, not a "click away to dismiss".
      if ((e.target as HTMLElement)?.closest?.('.ProseMirror')) return;
      dismiss();
    };
    const handleKeydown = (e: KeyboardEvent) => {
      if (!$noteStore.visible) return;
      if (e.key === 'Escape') {
        dismiss();
        return;
      }

      // Alt-combinations only — the writer is typing prose, so unmodified digits/letters
      // must never be intercepted. e.code (not e.key) is used because e.key with Alt held
      // produces layout-dependent characters, especially on macOS.
      if (!e.altKey || $noteStore.loading || $noteStore.suggestions.length === 0) return;

      const digitMatch = e.code.match(/^Digit([1-3])$/);
      if (digitMatch) {
        const suggestion = $noteStore.suggestions[Number(digitMatch[1]) - 1];
        if (suggestion) {
          e.preventDefault();
          applySuggestion(suggestion);
        }
        return;
      }

      if (e.code === 'KeyN') {
        e.preventDefault();
        requestWithModifier('more');
      }
    };
    document.addEventListener('click', handleClick);
    document.addEventListener('keydown', handleKeydown);
    return () => {
      document.removeEventListener('click', handleClick);
      document.removeEventListener('keydown', handleKeydown);
    };
  });
</script>

{#if $noteStore.visible}
  <div
    bind:this={noteRef}
    class="fixed bg-base-100 border border-base-300 rounded-xl p-4 shadow-xl w-72 z-[1000] transition-opacity duration-150 max-md:!left-4 max-md:!right-4 max-md:!top-auto max-md:!bottom-4 max-md:!w-auto"
    style={$noteStore.position ? `left: ${$noteStore.position.x}px; top: ${$noteStore.position.y}px;` : ''}
    role="complementary"
    aria-label="Alternative phrasings"
  >
    {#if $noteStore.error}
      <div class="alert alert-error alert-sm text-sm" role="alert">
        <span>{$noteStore.error}</span>
      </div>
      {#if $noteStore.sentenceRewriteEligible}
        <button class="btn btn-xs btn-outline mt-2" onclick={requestSentenceRewrite}>Rewrite as sentence(s)</button>
      {/if}
    {:else}
      <div>
        <h3 class="text-base font-semibold mb-2">Alternative Phrasings</h3>
        {#if $noteStore.suggestions.length && $noteStore.original}
          <!-- Visual only: each suggestion's accessible name already carries its full text. -->
          <p class="text-xs opacity-70 mb-2 leading-snug" aria-hidden="true">
            <span class="font-medium">Original:</span>
            {#each originalSegments as seg}{#if seg.kind === 'removed'}<del class="diff-removed">{seg.text}</del>{:else}{seg.text}{/if}{/each}
          </p>
        {/if}
        {#each $noteStore.suggestions as suggestion, index}
          <div
            class="card bg-base-100 border border-base-200 rounded-lg p-3 mb-2 cursor-pointer hover:border-base-400 hover:bg-base-200 transition-all duration-150"
            role="button"
            tabindex="0"
            onclick={() => applySuggestion(suggestion)}
            onmouseenter={() => (activeIndex = index)}
            onmouseleave={() => (activeIndex = null)}
            onfocus={() => (activeIndex = index)}
            onblur={() => (activeIndex = null)}
            onkeydown={(e: KeyboardEvent) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                applySuggestion(suggestion);
              }
            }}
            aria-label={`Apply suggestion ${index + 1}: ${suggestion}${lost[index]?.length ? ` — ${lostLabel(lost[index])}` : ''}`}
          >
            <div class="text-sm" class:opacity-60={lost[index]?.length}>{#each diffs[index]?.suggestion ?? [] as seg}{#if seg.kind === 'added'}<mark class="diff-added">{seg.text}</mark>{:else}{seg.text}{/if}{/each}</div>
            {#if lost[index]?.length}
              <span class="badge badge-warning badge-xs mt-1.5">{lostLabel(lost[index])}</span>
            {/if}
          </div>
        {/each}
        {#if $noteStore.loading}
          <div class="flex items-center gap-2 py-1">
            <span class="loading loading-spinner loading-sm shrink-0"></span>
            {#if $noteStore.loadStatus}
              <span class="text-sm opacity-70" role="status">
                {loadStatusText($noteStore.loadStatus, $settingsStore.model)}
                <span class="tabular-nums">({waitSeconds} s)</span> · Esc cancels
              </span>
            {:else}
              <span class="text-sm opacity-70">Loading...</span>
            {/if}
          </div>
        {:else}
          <div class="flex gap-2 mt-2 flex-wrap">
            {#each MODIFIER_CHIPS as chip (chip.label)}
              <span class="tooltip tooltip-bottom" data-tip={chip.tip}>
                <button class="btn btn-xs btn-ghost btn-outline" onclick={chip.run}>{chip.label}</button>
              </span>
            {/each}
            {#each $settingsStore.customModifiers as chip (chip.id)}
              <span class="tooltip tooltip-bottom" data-tip={chip.instruction}>
                <button class="btn btn-xs btn-ghost btn-outline" onclick={() => requestWithModifier(chip.id, chip.instruction)}>{chip.label}</button>
              </span>
            {/each}
            {#each ACTION_CHIPS as chip (chip.label)}
              <span class="tooltip tooltip-bottom" data-tip={chip.tip}>
                <button class="btn btn-xs btn-ghost btn-outline" onclick={chip.run}>{chip.label}</button>
              </span>
            {/each}
            {#if canProtect}
              <span
                class="tooltip tooltip-bottom"
                data-tip={isProtected ? 'Suggestions may change this word again' : 'Suggestions keep this word exactly as written — in this document'}
              >
                <button class="btn btn-xs btn-ghost btn-outline" onclick={toggleProtected}>{isProtected ? 'Unprotect' : 'Protect'}</button>
              </span>
            {/if}
          </div>
          <div class="text-xs opacity-60 mt-2">Alt+1–3 apply · Alt+N new · Esc dismiss</div>
        {/if}
        {#if earlier.length}
          <!-- Below the chips, so expanding it never pushes them out of view. Keyed on the
               phrase so a new selection starts collapsed again. -->
          {#key $noteStore.original}
            <details class="mt-2">
              <summary class="text-xs opacity-70 cursor-pointer select-none py-1">Earlier ({earlier.length})</summary>
              <div class="max-h-48 overflow-y-auto mt-1">
                {#each earlier as entry (entry.text)}
                  <button
                    class="block w-full text-left rounded-md px-2 py-1.5 mb-1 hover:bg-base-200 focus:bg-base-200 transition-colors duration-150"
                    onclick={() => applySuggestion(entry.text)}
                    aria-label={`Apply earlier suggestion (${entry.label}): ${entry.text}${entry.lost.length ? ` — ${lostLabel(entry.lost)}` : ''}`}
                  >
                    <span class="text-sm" class:opacity-60={entry.lost.length}>{#each entry.segments as seg}{#if seg.kind === 'added'}<mark class="diff-added">{seg.text}</mark>{:else}{seg.text}{/if}{/each}</span>
                    <span class="block text-[0.65rem] mt-0.5">
                      <span class="opacity-50">{entry.label}</span>
                      {#if entry.lost.length}<span class="badge badge-warning badge-xs ml-1">{lostLabel(entry.lost)}</span>{/if}
                    </span>
                  </button>
                {/each}
              </div>
            </details>
          {/key}
        {/if}
      </div>
    {/if}
    <button
      class="btn btn-ghost btn-xs btn-circle absolute top-2 right-2"
      onclick={dismiss}
      aria-label="Dismiss"
    >
      ×
    </button>
  </div>
{/if}

<style>
  /* Theme colours, mixed down so the highlight stays quiet in light and dark mode. */
  .diff-added {
    background-color: color-mix(in oklab, var(--color-primary) 22%, transparent);
    color: inherit;
    border-radius: 0.2em;
    box-decoration-break: clone;
    -webkit-box-decoration-break: clone;
  }
  .diff-removed {
    text-decoration: line-through;
    text-decoration-color: var(--color-error);
    text-decoration-thickness: 2px;
  }
</style>
