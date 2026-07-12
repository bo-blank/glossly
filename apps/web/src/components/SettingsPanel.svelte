<!-- components/SettingsPanel.svelte -->
<script lang="ts">
  import { settingsStore } from '../stores/settingsStore';

  function saveSettings() {
    // Save settings locally
    localStorage.setItem('glossly-settings', JSON.stringify($settingsStore));
  }
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
      onchange={saveSettings}
    >
      <option value="anthropic">Anthropic (cloud)</option>
      <option value="ollama">Ollama (local)</option>
      <option value="lmstudio">LM Studio (local)</option>
      <option value="openai-compatible">OpenAI-compatible</option>
    </select>
  </div>
  
  <div class="form-control w-full">
    <label class="label" for="model-input">
      <span class="label-text font-medium">Model</span>
    </label>
    <input
      id="model-input"
      type="text"
      class="input input-bordered input-sm"
      bind:value={$settingsStore.model}
      onchange={saveSettings}
    />
  </div>
  
  {#if $settingsStore.provider === 'anthropic'}
    <div class="form-control w-full">
      <label class="label" for="api-key-input">
        <span class="label-text font-medium">API Key</span>
      </label>
      <input
        id="api-key-input"
        type="password"
        class="input input-bordered input-sm"
        bind:value={$settingsStore.apiKey}
        onchange={saveSettings}
      />
    </div>
  {/if}
  
  <div class="form-control w-full">
    <label class="label" for="endpoint-url-input">
      <span class="label-text font-medium">Endpoint URL</span>
    </label>
    <input
      id="endpoint-url-input"
      type="text"
      class="input input-bordered input-sm"
      bind:value={$settingsStore.endpointUrl}
      onchange={saveSettings}
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
