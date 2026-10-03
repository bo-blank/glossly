<!-- components/SettingsPanel.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { settingsStore, persistSettings } from '../stores/settingsStore';
  import { fetchModels } from '../providers/client';
  import TuneChips from './TuneChips.svelte';
  import { MAX_INSTRUCTION_CHARS } from '@glossly/shared';

  const LABEL_MAX = 24;

  let models: string[] = [];
  let modelsError = '';
  let loadingModels = false;

  let newLabel = '';
  let newInstruction = '';

  function saveSettings() {
    persistSettings($settingsStore);
  }

  function addCustomModifier() {
    const label = newLabel.trim().slice(0, LABEL_MAX);
    const instruction = newInstruction.trim().slice(0, MAX_INSTRUCTION_CHARS);
    if (!label || !instruction) return;

    $settingsStore.customModifiers = [...$settingsStore.customModifiers, { id: crypto.randomUUID(), label, instruction }];
    saveSettings();
    newLabel = '';
    newInstruction = '';
  }

  function deleteCustomModifier(id: string) {
    $settingsStore.customModifiers = $settingsStore.customModifiers.filter((m) => m.id !== id);
    const { [id]: _removed, ...tuning } = $settingsStore.modifierTuning;
    $settingsStore.modifierTuning = tuning;
    saveSettings();
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

  <div class="form-control w-full">
    <label class="label cursor-pointer justify-start gap-3" for="readability-highlight-toggle">
      <input
        id="readability-highlight-toggle"
        type="checkbox"
        class="toggle toggle-sm"
        bind:checked={$settingsStore.readabilityHighlight}
        onchange={saveSettings}
      />
      <span class="label-text">
        <span class="font-medium">Highlight long sentences</span>
        <span class="block text-xs opacity-60">Yellow from 20 words, red from 30.</span>
      </span>
    </label>
  </div>

  <div class="divider my-1"></div>

  <div class="form-control w-full">
    <span class="label-text font-medium mb-2">Custom modifiers</span>

    {#if $settingsStore.customModifiers.length}
      <ul class="space-y-1 mb-3">
        {#each $settingsStore.customModifiers as chip (chip.id)}
          <li class="flex items-center justify-between gap-2 bg-base-100 border border-base-300 rounded-lg px-3 py-2">
            <div class="min-w-0">
              <div class="text-sm font-medium truncate">{chip.label}</div>
              <div class="text-xs opacity-60 truncate">{chip.instruction}</div>
            </div>
            <button
              type="button"
              class="btn btn-ghost btn-xs btn-square shrink-0"
              aria-label={`Delete "${chip.label}" modifier`}
              onclick={() => deleteCustomModifier(chip.id)}
            >
              ×
            </button>
          </li>
        {/each}
      </ul>
    {/if}

    <div class="flex flex-col gap-2">
      <input
        type="text"
        class="input input-bordered input-sm"
        placeholder="Label (e.g. More formal)"
        maxlength={LABEL_MAX}
        bind:value={newLabel}
      />
      <textarea
        class="textarea textarea-bordered textarea-sm"
        placeholder="Instruction sent to the model (e.g. Make each alternative more formal in register.)"
        maxlength={MAX_INSTRUCTION_CHARS}
        rows="2"
        bind:value={newInstruction}
      ></textarea>
      <button
        type="button"
        class="btn btn-sm self-start"
        disabled={!newLabel.trim() || !newInstruction.trim()}
        onclick={addCustomModifier}
      >
        Add modifier
      </button>
    </div>
  </div>

  <div class="divider my-1"></div>

  <TuneChips />
</div>
