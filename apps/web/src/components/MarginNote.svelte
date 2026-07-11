<!-- components/MarginNote.svelte -->
<script lang="ts">
  import { noteStore } from '../stores/noteStore';

  function applySuggestion(suggestion: string) {
    // Implementation for applying suggestion
    // Use editor store to replace selected text
  }
  
  function dismissNote() {
    noteStore.update(n => ({ ...n, visible: false }));
  }
</script>

{#if $noteStore.visible}
  <div class="margin-note" role="complementary" aria-label="Alternative phrasings">
    {#if $noteStore.loading}
      <div class="loading-state">Loading...</div>
    {:else if $noteStore.error}
      <div class="error-state" role="alert">{$noteStore.error}</div>
    {:else}
      <div class="suggestions-container">
        <h3>Alternative Phrasings</h3>
        {#each $noteStore.suggestions as suggestion, index}
          <div
            class="suggestion-button"
            role="button"
            tabindex="0"
            on:click={() => applySuggestion(suggestion)}
            on:keydown={(e) => (e.key === 'Enter' || e.key === ' ') && applySuggestion(suggestion)}
            aria-label={`Apply suggestion ${index + 1}`}
          >
            <div class="suggestion-content">{suggestion}</div>
            <div class="modifier-chips">
              <button class="modifier-chip" data-modifier="tighter">Tighter</button>
              <button class="modifier-chip" data-modifier="vivid">More vivid</button>
              <button class="modifier-chip" data-modifier="plain">Plainer</button>
            </div>
          </div>
        {/each}
      </div>
    {/if}
    <button class="dismiss-button" on:click={dismissNote} aria-label="Dismiss">×</button>
  </div>
{/if}

<style>
.margin-note {
  /* Margin note styling matching spec */
  position: absolute;
  right: -200px; /* Positioned in right margin */
  background: #fff;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  max-width: 300px;
  z-index: 1000;
  transition: opacity 150ms ease;
}

.suggestion-button {
  display: block;
  width: 100%;
  text-align: left;
  padding: 12px;
  margin: 8px 0;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  background: #fff;
  cursor: pointer;
  transition: all 150ms ease;
}

.suggestion-button:hover {
  border-color: #999;
  background: #f9f9f9;
}

.modifier-chips {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}

.modifier-chip {
  padding: 4px 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: #f5f5f5;
  cursor: pointer;
  font-size: 12px;
}

.dismiss-button {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 24px;
  height: 24px;
  border: none;
  background: none;
  cursor: pointer;
  font-size: 18px;
  color: #999;
}
</style>
