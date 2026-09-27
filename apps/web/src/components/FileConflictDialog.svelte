<!-- components/FileConflictDialog.svelte -->
<script>
  import { fileStatus, resolveConflict, reportFileError } from '../storage/fileStore';

  let busy = $state(false);

  async function choose(choice) {
    busy = true;
    try {
      await resolveConflict(choice);
    } catch {
      reportFileError(choice === 'file' ? 'Could not load the file from disk.' : 'Could not write the file.');
    } finally {
      busy = false;
    }
  }
</script>

{#if $fileStatus.conflict}
  {@const conflict = $fileStatus.conflict}
  <div class="modal modal-open" role="alertdialog" aria-modal="true" aria-labelledby="file-conflict-title">
    <div class="modal-box max-w-md">
      <h3 id="file-conflict-title" class="text-lg font-bold">{conflict.name} changed outside Glossly</h3>
      <p class="py-3 text-sm">
        {#if conflict.localChanged}
          The file on disk and Glossly’s copy both have changes the other lacks. Whichever you keep replaces the other.
        {:else}
          The file was edited since Glossly last saved it. Glossly’s copy has no newer changes.
        {/if}
      </p>
      <p class="text-xs opacity-60 pb-3">
        Loading from disk reads Markdown: highlights, colours, alignment and sub/superscript in Glossly’s copy are not in the file.
      </p>
      <div class="modal-action flex-wrap">
        <button class="btn btn-ghost btn-sm" disabled={busy} onclick={() => choose('later')}>Decide later</button>
        <button class="btn btn-sm" disabled={busy} onclick={() => choose('glossly')}>Keep Glossly’s version</button>
        <button class="btn btn-primary btn-sm" disabled={busy} onclick={() => choose('file')}>Load file from disk</button>
      </div>
    </div>
  </div>
{/if}
