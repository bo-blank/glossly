<!-- components/DocumentMenu.svelte -->
<script>
  import { onMount, tick } from 'svelte';
  import {
    documentStore,
    switchDocument,
    createDocument,
    renameDocument,
    removeDocument,
    relativeTime,
  } from '../storage/documentStore';
  import { STARTER_TEMPLATES } from '../editor/templates';

  let open = $state(false);
  // 'list' | 'new' — "New document" swaps the list for the starter templates.
  let view = $state('list');
  let renamingId = $state(null);
  let renameValue = $state('');
  let pendingDeleteId = $state(null);
  let error = $state('');
  let busy = $state(false);
  let rootRef = $state(null);
  let renameInput = $state(null);
  // Re-rendered on open so "5 min ago" isn't frozen at page load.
  let now = $state(Date.now());

  let activeTitle = $derived(
    $documentStore.documents.find((d) => d.id === $documentStore.activeId)?.title ?? 'Untitled'
  );

  function reset() {
    view = 'list';
    renamingId = null;
    pendingDeleteId = null;
    error = '';
  }

  function toggle() {
    open = !open;
    reset();
    now = Date.now();
  }

  function close() {
    open = false;
    reset();
  }

  async function run(op, failure) {
    busy = true;
    error = '';
    try {
      await op();
      return true;
    } catch {
      error = failure;
      return false;
    } finally {
      busy = false;
    }
  }

  async function choose(id) {
    if (await run(() => switchDocument(id), 'Could not save the current document, so it stayed open.')) close();
  }

  async function create(template) {
    if (await run(() => createDocument(template.content), 'Could not create the document.')) close();
  }

  async function startRename(doc) {
    pendingDeleteId = null;
    renamingId = doc.id;
    renameValue = doc.title;
    await tick();
    renameInput?.select();
  }

  async function commitRename() {
    const id = renamingId;
    renamingId = null;
    await run(() => renameDocument(id, renameValue), 'Could not rename the document.');
  }

  async function confirmDelete(id) {
    pendingDeleteId = null;
    await run(() => removeDocument(id), 'Could not delete the document.');
  }

  onMount(() => {
    // mousedown, not click — same reason as the toolbar menus in Editor.svelte:
    // the delete-confirm step re-renders its row, detaching the clicked element
    // before a click event reaches document.
    const handleOutside = (e) => {
      if (open && rootRef && !rootRef.contains(e.target)) close();
    };
    const handleKey = (e) => {
      if (open && e.key === 'Escape' && !renamingId) close();
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleKey);
    };
  });
</script>

{#if $documentStore.backend === 'indexeddb'}
  <div class="relative min-w-0" bind:this={rootRef}>
    <button
      class="btn btn-ghost btn-sm gap-1 max-w-full font-normal"
      onclick={toggle}
      aria-haspopup="menu"
      aria-expanded={open}
      title="Switch document"
    >
      <span class="truncate max-w-[16rem]">{activeTitle}</span>
      <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
    </button>

    {#if open}
      <div class="absolute left-0 top-full mt-1 p-2 w-80 max-w-[calc(100vw-2rem)] bg-base-200 border border-base-300 rounded-lg shadow-lg z-[100]" role="menu">
        {#if view === 'new'}
          <button class="btn btn-ghost btn-xs mb-1" onclick={() => (view = 'list')}>← Documents</button>
          {#each STARTER_TEMPLATES as template}
            <button
              class="block w-full text-left px-3 py-2 rounded-md hover:bg-base-300 transition-colors"
              disabled={busy}
              onclick={() => create(template)}
            >
              <span class="block text-sm">{template.name}</span>
              <span class="block text-xs opacity-60">{template.blurb}</span>
            </button>
          {/each}
        {:else}
          <button
            class="flex items-center gap-2 w-full text-left px-3 py-2 rounded-md hover:bg-base-300 text-sm font-medium"
            disabled={busy}
            onclick={() => { reset(); view = 'new'; }}
          >
            <span aria-hidden="true">＋</span> New document
          </button>
          <div class="border-t border-base-300 my-1"></div>

          <ul class="max-h-80 overflow-y-auto">
            {#each $documentStore.documents as doc (doc.id)}
              <li class="group rounded-md {doc.id === $documentStore.activeId ? 'bg-base-300' : 'hover:bg-base-300'}">
                {#if pendingDeleteId === doc.id}
                  <div class="px-3 py-2 text-sm">
                    <p class="font-medium">Delete “{doc.title}”?</p>
                    <p class="opacity-60 text-xs mt-1">This can’t be undone — unlike edits, Ctrl+Z won’t bring it back.</p>
                    <div class="flex gap-1 pt-2">
                      <button class="btn btn-error btn-sm flex-1" disabled={busy} onclick={() => confirmDelete(doc.id)}>Delete</button>
                      <button class="btn btn-ghost btn-sm flex-1" onclick={() => (pendingDeleteId = null)}>Cancel</button>
                    </div>
                  </div>
                {:else if renamingId === doc.id}
                  <form class="px-2 py-1" onsubmit={(e) => { e.preventDefault(); commitRename(); }}>
                    <input
                      bind:this={renameInput}
                      bind:value={renameValue}
                      class="input input-sm w-full"
                      maxlength="60"
                      placeholder="Leave empty to name it automatically"
                      aria-label="Document name"
                      onkeydown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); renamingId = null; } }}
                      onblur={commitRename}
                    />
                  </form>
                {:else}
                  <div class="flex items-center">
                    <button
                      class="flex-1 min-w-0 text-left px-3 py-2"
                      disabled={busy}
                      onclick={() => choose(doc.id)}
                      aria-current={doc.id === $documentStore.activeId ? 'true' : undefined}
                    >
                      <span class="block text-sm truncate">{doc.title}</span>
                      <span class="block text-xs opacity-60">{relativeTime(doc.updatedAt, now)}</span>
                    </button>
                    <button
                      class="btn btn-ghost btn-xs btn-square opacity-0 group-hover:opacity-100 focus:opacity-100"
                      title="Rename"
                      aria-label={`Rename ${doc.title}`}
                      onclick={() => startRename(doc)}
                    >✎</button>
                    <button
                      class="btn btn-ghost btn-xs btn-square opacity-0 group-hover:opacity-100 focus:opacity-100 mr-1"
                      title="Delete"
                      aria-label={`Delete ${doc.title}`}
                      onclick={() => { renamingId = null; pendingDeleteId = doc.id; }}
                    >🗑</button>
                  </div>
                {/if}
              </li>
            {/each}
          </ul>
        {/if}

        {#if error}
          <p class="text-error text-xs px-3 pt-2" role="alert">{error}</p>
        {/if}
      </div>
    {/if}
  </div>
{/if}
