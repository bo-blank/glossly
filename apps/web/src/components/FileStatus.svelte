<!-- components/FileStatus.svelte -->
<script>
  import { documentStore } from '../storage/documentStore';
  import { fileStatus } from '../storage/fileStore';

  let doc = $derived($documentStore.documents.find((d) => d.id === $documentStore.activeId));
  let file = $derived(doc?.file);
  let blocked = $derived(doc ? $fileStatus.blocked.includes(doc.id) : false);
  let unsaved = $derived(file && doc ? doc.updatedAt > file.syncedAt : false);
</script>

{#if file}
  <span title="Saved as Markdown on disk; Glossly keeps its own copy for crash recovery.">
    · 📄 {file.name}
    {#if blocked}
      <span class="text-warning font-medium">— changed outside Glossly, Ctrl+S to choose</span>
    {:else if unsaved}
      — not saved to disk (Ctrl+S)
    {:else}
      — saved
    {/if}
  </span>
{/if}
{#if $fileStatus.error}
  <span class="text-error font-medium" role="alert">· ⚠ {$fileStatus.error}</span>
{/if}
