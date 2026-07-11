<!-- components/SettingsPanel.svelte -->
<script lang="ts">
  import { settingsStore } from '../stores/settingsStore';

  function saveSettings() {
    // Save settings locally
    localStorage.setItem('glossly-settings', JSON.stringify($settingsStore));
  }
</script>

<div class="settings-panel">
  <h3>Settings</h3>
  
  <div class="form-group">
    <label>Provider</label>
    <select bind:value={$settingsStore.provider} on:change={saveSettings}>
      <option value="anthropic">Anthropic (cloud)</option>
      <option value="ollama">Ollama (local)</option>
      <option value="lmstudio">LM Studio (local)</option>
      <option value="openai-compatible">OpenAI-compatible</option>
    </select>
  </div>
  
  <div class="form-group">
    <label>Model</label>
    <input type="text" bind:value={$settingsStore.model} on:change={saveSettings} />
  </div>
  
  {#if $settingsStore.provider === 'anthropic'}
    <div class="form-group">
      <label>API Key</label>
      <input type="password" bind:value={$settingsStore.apiKey} on:change={saveSettings} />
    </div>
  {/if}
  
  <div class="form-group">
    <label>Endpoint URL</label>
    <input type="text" bind:value={$settingsStore.endpointUrl} on:change={saveSettings} />
  </div>
  
  <div class="form-group">
    <label>Timeout (ms)</label>
    <input type="number" bind:value={$settingsStore.timeout} on:change={saveSettings} />
  </div>
</div>

<style>
.settings-panel {
  padding: 16px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  background: #f9f9f9;
}

.form-group {
  margin: 12px 0;
}

label {
  display: block;
  margin-bottom: 4px;
  font-weight: 500;
}

input, select {
  width: 100%;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
}
</style>
