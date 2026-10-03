<!-- components/TuneChips.svelte -->
<script lang="ts">
  import { settingsStore, persistSettings, type ModifierTuning } from '../stores/settingsStore';
  import { fetchModifierDefaults } from '../providers/client';
  import { BUILT_IN_LABELS } from '../note/requestSuggestions';
  import { MAX_INSTRUCTION_CHARS, MAX_TEMPERATURE, type ModifierDefaults } from '@glossly/shared';

  // "New suggestions" and "Rewrite sentence" are actions, not styles — not tunable.
  const builtIns = Object.entries(BUILT_IN_LABELS)
    .filter(([id]) => id !== 'more')
    .map(([id, label]) => ({ id, label }));

  // Loaded from the server when the section first opens: the built-in wording
  // lives only in the server's prompt.ts, so a copy here could drift.
  let server: ModifierDefaults | null = $state(null);
  let loadError = $state('');

  let chips = $derived([
    ...builtIns.map((c) => ({ ...c, defaultInstruction: server?.defaults[c.id] ?? '' })),
    ...$settingsStore.customModifiers.map((c) => ({ id: c.id, label: c.label, defaultInstruction: c.instruction }))
  ]);

  async function load(e: Event) {
    if (!(e.currentTarget as HTMLDetailsElement).open || server) return;
    loadError = '';
    try {
      server = await fetchModifierDefaults();
    } catch (err) {
      loadError = err instanceof Error ? err.message : 'Could not load the defaults.';
    }
  }

  function setTuning(id: string, change: (t: ModifierTuning) => ModifierTuning) {
    settingsStore.update((s) => {
      const next = change({ ...s.modifierTuning[id] });
      const { [id]: _old, ...rest } = s.modifierTuning;
      const tuning = next.temperature === undefined && next.instruction === undefined ? rest : { ...rest, [id]: next };
      const updated = { ...s, modifierTuning: tuning };
      persistSettings(updated);
      return updated;
    });
  }

  function setTemperature(id: string, value: number) {
    setTuning(id, (t) => ({ ...t, temperature: value }));
  }

  function setInstruction(id: string, value: string, defaultInstruction: string) {
    const text = value.trim().slice(0, MAX_INSTRUCTION_CHARS);
    // Blank or back to the default is the same as untuned.
    setTuning(id, (t) => ({ ...t, instruction: text && text !== defaultInstruction ? text : undefined }));
  }

  function reset(id: string) {
    setTuning(id, () => ({}));
  }
</script>

<details class="form-control w-full" ontoggle={load}>
  <summary class="label-text font-medium cursor-pointer select-none">Tune chips</summary>

  {#if loadError}
    <span class="label-text-alt text-error mt-2">{loadError}</span>
  {:else if !server}
    <span class="loading loading-spinner loading-sm mt-2"></span>
  {:else}
    <ul class="space-y-3 mt-2">
      {#each chips as chip (chip.id)}
        {@const tuning = $settingsStore.modifierTuning[chip.id]}
        {@const temperature = tuning?.temperature ?? server.temperature}
        <li class="bg-base-100 border border-base-300 rounded-lg px-3 py-2">
          <div class="flex items-center justify-between gap-2">
            <span class="text-sm font-medium truncate">{chip.label}</span>
            <button
              type="button"
              class="btn btn-ghost btn-xs"
              disabled={!tuning}
              onclick={() => reset(chip.id)}
              aria-label={`Reset "${chip.label}" to its defaults`}
            >
              Reset
            </button>
          </div>
          <label class="block mt-1">
            <span class="sr-only">{chip.label} temperature</span>
            <input
              type="range"
              class="range range-xs"
              min="0"
              max={MAX_TEMPERATURE}
              step="0.1"
              value={temperature}
              onchange={(e) => setTemperature(chip.id, Number(e.currentTarget.value))}
            />
          </label>
          <div class="flex justify-between text-xs opacity-60">
            <span>steady</span>
            <span>{temperature.toFixed(1)}</span>
            <span>adventurous</span>
          </div>
          <label class="block mt-2">
            <span class="sr-only">{chip.label} instruction</span>
            <textarea
              class="textarea textarea-bordered textarea-sm w-full"
              rows="2"
              maxlength={MAX_INSTRUCTION_CHARS}
              value={tuning?.instruction ?? chip.defaultInstruction}
              onchange={(e) => {
                setInstruction(chip.id, e.currentTarget.value, chip.defaultInstruction);
                // A blank field means the default again; show it, since the bound value may not have changed.
                e.currentTarget.value = $settingsStore.modifierTuning[chip.id]?.instruction ?? chip.defaultInstruction;
              }}
            ></textarea>
          </label>
        </li>
      {/each}
    </ul>
  {/if}
</details>
