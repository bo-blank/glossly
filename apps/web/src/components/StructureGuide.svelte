<!-- components/StructureGuide.svelte -->
<script lang="ts">
  // What each part of the document is for, from the template it started with.
  // Beside the text, never in it: the writer replaces the example section by
  // section with this next to it. The place future structure tools plug into.
  import { findTemplate } from '../editor/templates';
  import { closeStructureGuide, documentStore } from '../storage/documentStore';

  interface Props {
    /** `aside`: the wide-screen side column. `inline`: collapsed above the editor where there is no side column. */
    variant: 'aside' | 'inline';
  }
  let { variant }: Props = $props();

  let doc = $derived($documentStore.documents.find((d) => d.id === $documentStore.activeId));
  let template = $derived(doc?.template && !doc.template.guideClosed ? findTemplate(doc.template.language, doc.template.id) : undefined);
  let label = $derived(doc?.template?.language === 'de' ? { title: 'Aufbau', close: 'Schließen', general: 'ganzer Text' } : { title: 'Structure', close: 'Close', general: 'whole text' });

  function close(e: MouseEvent) {
    e.preventDefault(); // inside <summary> it would toggle the details too
    if (doc) void closeStructureGuide(doc.id);
  }
</script>

{#snippet notes()}
  <dl class="space-y-2">
    {#each template!.guide as note (note.section)}
      <div>
        <!-- General notes have no block of their own; the others name one. -->
        <dt class="font-medium">{note.section}{#if note.general}<span class="font-normal opacity-60 ml-1">· {label.general}</span>{/if}</dt>
        <dd class="opacity-70 leading-snug">{note.hint}</dd>
      </div>
    {/each}
  </dl>
{/snippet}

{#if template?.guide.length}
  {#if variant === 'aside'}
    <section aria-label="{label.title}: {template.name}">
      <div class="flex items-baseline justify-between gap-2 mb-1.5">
        <h3 class="text-xs font-semibold uppercase tracking-wide opacity-60">{label.title} · {template.name}</h3>
        <button
          type="button"
          class="btn btn-ghost btn-xs btn-square min-h-0 h-5 w-5 opacity-60 hover:opacity-100"
          aria-label="{label.close}: {label.title}"
          title="{label.close} — stays closed for this document"
          onclick={close}>×</button
        >
      </div>
      {@render notes()}
    </section>
  {:else}
    <details class="group xl:hidden rounded-lg bg-base-200 px-3 py-2 text-sm">
      <summary class="cursor-pointer select-none flex items-center justify-between gap-2 list-none">
        <span class="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide opacity-70">
          <span class="inline-block transition-transform group-open:rotate-90" aria-hidden="true">▸</span>
          {label.title} · {template.name}
        </span>
        <button
          type="button"
          class="btn btn-ghost btn-xs btn-square min-h-0 h-5 w-5 opacity-60 hover:opacity-100"
          aria-label="{label.close}: {label.title}"
          title="{label.close} — stays closed for this document"
          onclick={close}>×</button
        >
      </summary>
      <div class="pt-2">{@render notes()}</div>
    </details>
  {/if}
{/if}
