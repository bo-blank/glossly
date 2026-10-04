<!-- components/StructureGuide.svelte -->
<script lang="ts">
  // The structure card: the outline of the document's blocks, and for a
  // document started from a template, what each block is for. Beside the
  // text, never in it. The place structure tools plug into.
  import { defaultTemplateLanguage, findTemplate } from '../editor/templates';
  import { closeStructureGuide, documentStore } from '../storage/documentStore';
  import { blocksStore } from '../stores/blocksStore';
  import { settingsStore } from '../stores/settingsStore';
  import BlockOutline from './BlockOutline.svelte';

  interface Props {
    /** `aside`: the wide-screen side column. `inline`: collapsed above the editor where there is no side column. */
    variant: 'aside' | 'inline';
  }
  let { variant }: Props = $props();

  let doc = $derived($documentStore.documents.find((d) => d.id === $documentStore.activeId));
  let template = $derived(doc?.template ? findTemplate(doc.template.language, doc.template.id) : undefined);
  let guide = $derived(template?.guide ?? []);
  let showHints = $derived(guide.length > 0 && !doc?.template?.guideClosed);
  let language = $derived(doc?.template?.language ?? $settingsStore.templateLanguage ?? defaultTemplateLanguage());
  let label = $derived(
    language === 'de' ? { title: 'Aufbau', close: 'Hinweise schließen' } : { title: 'Structure', close: 'Close the notes' }
  );
  let heading = $derived(template && template.guide.length ? `${label.title} · ${template.name}` : label.title);
  // One block is no structure yet; a template's notes are worth showing from the start.
  let visible = $derived($blocksStore.blocks.length >= 2 || showHints);

  function close(e: MouseEvent) {
    e.preventDefault(); // inside <summary> it would toggle the details too
    if (doc) void closeStructureGuide(doc.id);
  }
</script>

{#snippet closeButton()}
  {#if showHints}
    <button
      type="button"
      class="btn btn-ghost btn-xs btn-square min-h-0 h-5 w-5 opacity-60 hover:opacity-100"
      aria-label={label.close}
      title="{label.close} — the outline stays"
      onclick={close}>×</button
    >
  {/if}
{/snippet}

{#if visible}
  {#if variant === 'aside'}
    <section aria-label={heading}>
      <div class="flex items-baseline justify-between gap-2 mb-1.5">
        <h3 class="text-xs font-semibold uppercase tracking-wide opacity-60">{heading}</h3>
        {@render closeButton()}
      </div>
      <BlockOutline {guide} {showHints} {language} />
    </section>
  {:else}
    <details class="group xl:hidden rounded-lg bg-base-200 px-3 py-2 text-sm">
      <summary class="cursor-pointer select-none flex items-center justify-between gap-2 list-none">
        <span class="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide opacity-70">
          <span class="inline-block transition-transform group-open:rotate-90" aria-hidden="true">▸</span>
          {heading}
        </span>
        {@render closeButton()}
      </summary>
      <div class="pt-2"><BlockOutline {guide} {showHints} {language} /></div>
    </details>
  {/if}
{/if}
