<!-- components/SettingsPanel.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { settingsStore } from '../stores/settingsStore';
  import { fetchModels } from '../providers/client';

  let models: string[] = [];
  let modelsError = '';
  let loadingModels = false;

  function saveSettings() {
    // Save settings locally
    localStorage.setItem('glossly-settings', JSON.stringify($settingsStore));
  }

  async function loadModels() {
    loadingModels = true;
    modelsError = '';
    try {
      models = await fetchModels($settingsStore.endpointUrl, $settingsStore.apiKey);
      if (models.length && !models.includes($settingsStore.model)) {
        $settingsStore.model = models[0];
        saveSettings();
      }
    } catch (err) {
      models = [];
      modelsError = err instanceof Error ? err.message : 'Failed to load models.';
    } finally {
      loadingModels = false;
    }
  }

  onMount(loadModels);
</script>

<div class="space-y-3">
  <div class="form-control w-full">
    <label class="label" for="provider-select">
      <span class="label-text font-medium">Provider</span>
    </label>
    <select
      id="provider-select"
      class="select select-bordered select-sm"
      bind:value={$settingsStore.provider}
      onchange={() => { saveSettings(); loadModels(); }}
    >
      <option value="ollama">Ollama (local)</option>
      <option value="lmstudio">LM Studio (local)</option>
      <option value="openai-compatible">OpenAI-compatible</option>
    </select>
  </div>

  <div class="form-control w-full">
    <label class="label" for="model-select">
      <span class="label-text font-medium">Model</span>
    </label>
    {#if models.length}
      <div class="flex gap-2">
        <select
          id="model-select"
          class="select select-bordered select-sm flex-1"
          bind:value={$settingsStore.model}
          onchange={saveSettings}
        >
          {#each models as modelId}
            <option value={modelId}>{modelId}</option>
          {/each}
        </select>
        <button
          type="button"
          class="btn btn-sm"
          disabled={loadingModels}
          onclick={loadModels}
        >
          {loadingModels ? '...' : '⟳'}
        </button>
      </div>
    {:else}
      <div class="flex gap-2">
        <input
          id="model-select"
          type="text"
          class="input input-bordered input-sm flex-1"
          placeholder="Model name"
          bind:value={$settingsStore.model}
          onchange={saveSettings}
        />
        <button
          type="button"
          class="btn btn-sm"
          disabled={loadingModels}
          onclick={loadModels}
        >
          {loadingModels ? '...' : '⟳'}
        </button>
      </div>
      {#if modelsError}
        <span class="label-text-alt text-error mt-1">{modelsError}</span>
      {/if}
    {/if}
  </div>

  <div class="form-control w-full">
    <label class="label" for="api-key-input">
      <span class="label-text font-medium">API Key (optional)</span>
    </label>
    <input
      id="api-key-input"
      type="password"
      class="input input-bordered input-sm"
      bind:value={$settingsStore.apiKey}
      onchange={saveSettings}
    />
  </div>

  <div class="form-control w-full">
    <label class="label" for="endpoint-url-input">
      <span class="label-text font-medium">Endpoint URL</span>
    </label>
    <input
      id="endpoint-url-input"
      type="text"
      class="input input-bordered input-sm"
      bind:value={$settingsStore.endpointUrl}
      onchange={() => { saveSettings(); loadModels(); }}
    />
  </div>
  
  <div class="form-control w-full">
    <label class="label" for="timeout-input">
      <span class="label-text font-medium">Timeout (ms)</span>
    </label>
    <input
      id="timeout-input"
      type="number"
      class="input input-bordered input-sm"
      bind:value={$settingsStore.timeout}
      onchange={saveSettings}
    />
  </div>
</div>
