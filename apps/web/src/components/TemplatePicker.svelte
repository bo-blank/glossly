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
  import { documentStore } from '../storage/documentStore';
  import {
    NAME_MAX,
    deleteOwnTemplate,
    loadOwnTemplates,
    ownTemplates,
    renameOwnTemplate,
    type OwnTemplate
  } from '../storage/templateStore';

  interface Props {
    onchoose: (template: TemplateText, language: TemplateLanguage) => void;
    /** The writer's own templates are listed only where a caller can use them. */
    onchooseOwn?: (template: OwnTemplate) => void;
    disabled?: boolean;
  }
  let { onchoose, onchooseOwn, disabled = false }: Props = $props();

  // Own templates live in IndexedDB; without it there are none to show.
  $effect(() => {
    if (onchooseOwn && $documentStore.backend === 'indexeddb') void loadOwnTemplates().catch(() => {});
  });

  let renamingId: string | null = $state(null);
  let renameValue = $state('');
  let deletingId: string | null = $state(null);

  // In the picker's language, like the rest of the list.
  function savedLabel(createdAt: number): string {
    const date = new Date(createdAt).toLocaleDateString(language === 'de' ? 'de-DE' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    return language === 'de' ? `Gespeichert am ${date}` : `Saved ${date}`;
  }

  function startRename(t: OwnTemplate) {
    deletingId = null;
    renamingId = t.id;
    renameValue = t.name;
  }

  function commitRename() {
    if (renamingId) void renameOwnTemplate(renamingId, renameValue);
    renamingId = null;
  }

  function confirmDelete(id: string) {
    deletingId = null;
    void deleteOwnTemplate(id);
  }

  // For buttons whose click swaps this list's content: the removed button would
  // look like a click outside to the surrounding menu, which then closes.
  const inside = (e: Event) => e.stopPropagation();

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
  {#if onchooseOwn && $ownTemplates.length}
    <p class="text-[0.65rem] font-semibold uppercase tracking-wide opacity-50 px-3 pt-2 pb-0.5">
      {language === 'de' ? 'Eigene Vorlagen' : 'Your templates'}
    </p>
    {#each $ownTemplates as own (own.id)}
      {#if renamingId === own.id}
        <form class="px-2 py-1" onsubmit={(e) => { e.preventDefault(); commitRename(); }}>
          <input
            class="input input-bordered input-xs w-full"
            maxlength={NAME_MAX}
            bind:value={renameValue}
            aria-label="Template name"
            onkeydown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); renamingId = null; } }}
            onblur={commitRename}
          />
        </form>
      {:else if deletingId === own.id}
        <div class="px-3 py-1.5 text-sm">
          <p>Delete “{own.name}”?</p>
          <div class="flex gap-1 pt-1">
            <button type="button" class="btn btn-error btn-xs" onclick={(e) => { inside(e); confirmDelete(own.id); }}>Delete</button>
            <button type="button" class="btn btn-ghost btn-xs" onclick={(e) => { inside(e); deletingId = null; }}>Cancel</button>
          </div>
        </div>
      {:else}
        <div class="group flex items-center rounded-md hover:bg-base-300 focus-within:bg-base-300">
          <button
            type="button"
            class="flex-1 min-w-0 text-left px-3 py-1.5"
            {disabled}
            onclick={() => onchooseOwn(own)}
          >
            <span class="block text-sm truncate">{own.name}</span>
            <span class="block text-xs opacity-60">{savedLabel(own.createdAt)}</span>
          </button>
          <span class="flex shrink-0 pr-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100">
            <button type="button" class="btn btn-ghost btn-xs btn-square" aria-label="Rename “{own.name}”" onclick={(e) => { inside(e); startRename(own); }}>✎</button>
            <button type="button" class="btn btn-ghost btn-xs btn-square" aria-label="Delete “{own.name}”" onclick={(e) => { inside(e); renamingId = null; deletingId = own.id; }}>×</button>
          </span>
        </div>
      {/if}
    {/each}
  {/if}
  {#each groups as group (group.label)}
    <p class="text-[0.65rem] font-semibold uppercase tracking-wide opacity-50 px-3 pt-2 pb-0.5">{group.label}</p>
    {#each group.templates as template (template.id)}
      {@render item(template)}
    {/each}
  {/each}
</div>
