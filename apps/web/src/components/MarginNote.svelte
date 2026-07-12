<!-- components/MarginNote.svelte -->
<script lang="ts">
  import { noteStore, editorStore } from '../stores/noteStore';

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
    
    // Update the note store to hide the note
    noteStore.update(n => ({ ...n, visible: false }));
  }
  
  function dismissNote() {
    noteStore.update(n => ({ ...n, visible: false }));
  }
</script>

{#if $noteStore.visible}
  <div
    class="absolute right-[-200px] bg-base-100 border border-base-300 rounded-xl p-4 shadow-xl w-72 z-[1000] transition-opacity duration-150"
    role="complementary"
    aria-label="Alternative phrasings"
  >
    {#if $noteStore.loading}
      <div class="flex items-center gap-2">
        <span class="loading loading-spinner loading-sm"></span>
        <span class="text-sm">Loading...</span>
      </div>
    {:else if $noteStore.error}
      <div class="alert alert-error alert-sm text-sm" role="alert">
        <span>{$noteStore.error}</span>
      </div>
    {:else}
      <div>
        <h3 class="text-base font-semibold mb-2">Alternative Phrasings</h3>
        {#each $noteStore.suggestions as suggestion, index}
          <div
            class="card bg-base-100 border border-base-200 rounded-lg p-3 cursor-pointer hover:border-base-400 hover:bg-base-200 transition-all duration-150"
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
            <div class="text-sm mb-2">{suggestion}</div>
            <div class="flex gap-2">
              <button class="btn btn-xs btn-ghost btn-outline" data-modifier="tighter">Tighter</button>
              <button class="btn btn-xs btn-ghost btn-outline" data-modifier="vivid">More vivid</button>
              <button class="btn btn-xs btn-ghost btn-outline" data-modifier="plain">Plainer</button>
            </div>
          </div>
        {/each}
      </div>
    {/if}
    <button
      class="btn btn-ghost btn-xs btn-circle absolute top-2 right-2"
      onclick={dismissNote}
      aria-label="Dismiss"
    >
      ×
    </button>
  </div>
{/if}
