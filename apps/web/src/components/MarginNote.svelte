<!-- components/MarginNote.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { noteStore, editorStore } from '../stores/noteStore';
  import { settingsStore } from '../stores/settingsStore';
  import { requestWithModifier, dismiss } from '../note/requestSuggestions';

  let noteRef: HTMLElement;

  function applySuggestion(suggestion: string) {
    // Use the editor instance to replace selected text
    const editor = $editorStore.editor;
    if (!editor) return;

    // Get the current selection range
    const { from, to } = $editorStore.selection;

    if (from === to) return; // No selection

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
    {:else}
      <div>
        <h3 class="text-base font-semibold mb-2">Alternative Phrasings</h3>
        {#each $noteStore.suggestions as suggestion, index}
          <div
            class="card bg-base-100 border border-base-200 rounded-lg p-3 mb-2 cursor-pointer hover:border-base-400 hover:bg-base-200 transition-all duration-150"
            role="button"
            tabindex="0"
            onclick={() => applySuggestion(suggestion)}
            onkeydown={(e: KeyboardEvent) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                applySuggestion(suggestion);
              }
            }}
            aria-label={`Apply suggestion ${index + 1}`}
          >
            <div class="text-sm">{suggestion}</div>
          </div>
        {/each}
        {#if $noteStore.loading}
          <div class="flex items-center gap-2 py-1">
            <span class="loading loading-spinner loading-sm"></span>
            <span class="text-sm opacity-70">Loading...</span>
          </div>
        {:else}
          <div class="flex gap-2 mt-2 flex-wrap">
            <button class="btn btn-xs btn-ghost btn-outline" onclick={() => requestWithModifier('tighter')}>Tighter</button>
            <button class="btn btn-xs btn-ghost btn-outline" onclick={() => requestWithModifier('vivid')}>More vivid</button>
            <button class="btn btn-xs btn-ghost btn-outline" onclick={() => requestWithModifier('plain')}>Plainer</button>
            {#each $settingsStore.customModifiers as chip (chip.id)}
              <button class="btn btn-xs btn-ghost btn-outline" onclick={() => requestWithModifier(chip.id, chip.instruction)}>{chip.label}</button>
            {/each}
            <button class="btn btn-xs btn-ghost btn-outline" onclick={() => requestWithModifier('more')}>New suggestions</button>
          </div>
          <div class="text-xs opacity-60 mt-2">Alt+1–3 apply · Alt+N new · Esc dismiss</div>
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
