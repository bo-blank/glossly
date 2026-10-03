<!-- components/TemplatePicker.svelte -->
<script lang="ts">
  import {
    BLANK_TEMPLATE_ID,
    TEMPLATE_GROUPS,
    TEMPLATE_LANGUAGES,
    defaultTemplateLanguage,
    findTemplate,
    type TemplateLanguage,
    type TemplateText
  } from '../editor/templates';
  import { persistSettings, settingsStore } from '../stores/settingsStore';

  interface Props {
    onchoose: (template: TemplateText, language: TemplateLanguage) => void;
    disabled?: boolean;
  }
  let { onchoose, disabled = false }: Props = $props();

  let language = $derived<TemplateLanguage>($settingsStore.templateLanguage ?? defaultTemplateLanguage());
  let blank = $derived(findTemplate(language, BLANK_TEMPLATE_ID)!);
  let groups = $derived(
    TEMPLATE_GROUPS.map((g) => ({ label: g.label[language], templates: g.ids.map((id) => findTemplate(language, id)!) }))
  );

  function setLanguage(next: TemplateLanguage) {
    settingsStore.update((s) => {
      const updated = { ...s, templateLanguage: next };
      persistSettings(updated);
      return updated;
    });
  }
</script>

<div class="flex items-center justify-between gap-2 px-2 pb-1">
  <span class="text-xs opacity-60">{language === 'de' ? 'Vorlagen auf Deutsch' : 'Templates in English'}</span>
  <div class="join" role="group" aria-label="Template language">
    {#each TEMPLATE_LANGUAGES as option (option.id)}
      <button
        type="button"
        class="join-item btn btn-xs"
        class:btn-active={option.id === language}
        aria-pressed={option.id === language}
        onclick={(e) => {
          // Keeps the surrounding menu's outside-click handler from closing it.
          e.stopPropagation();
          setLanguage(option.id);
        }}
      >
        {option.label}
      </button>
    {/each}
  </div>
</div>

<div class="max-h-[60vh] overflow-y-auto">
  {#snippet item(template: TemplateText)}
    <button
      type="button"
      class="block w-full text-left px-3 py-1.5 rounded-md hover:bg-base-300 focus-visible:bg-base-300 transition-colors"
      {disabled}
      onclick={() => onchoose(template, language)}
    >
      <span class="block text-sm">{template.name}</span>
      <span class="block text-xs opacity-60">{template.blurb}</span>
    </button>
  {/snippet}

  {@render item(blank)}
  {#each groups as group (group.label)}
    <p class="text-[0.65rem] font-semibold uppercase tracking-wide opacity-50 px-3 pt-2 pb-0.5">{group.label}</p>
    {#each group.templates as template (template.id)}
      {@render item(template)}
    {/each}
  {/each}
</div>
