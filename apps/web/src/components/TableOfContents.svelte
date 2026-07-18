<!-- components/TableOfContents.svelte -->
<script>
  import { tocStore } from '../stores/tocStore';
  import { editorStore } from '../stores/noteStore';

  function scrollToHeading(item) {
    const editor = $editorStore.editor;
    if (!editor) return;
    editor.chain().focus().setTextSelection(item.pos).scrollIntoView().run();
  }
</script>

{#if $tocStore.length > 0}
  <nav
    class="fixed top-24 hidden xl:block w-56 max-h-[70vh] overflow-y-auto text-sm"
    style="left: max(1rem, calc(50% - 320px - 15rem));"
    aria-label="Table of contents"
  >
    <ul class="menu menu-sm p-0 gap-0.5">
      {#each $tocStore as item (item.id)}
        <li>
          <button
            class="rounded-md px-2 py-1 truncate"
            class:active={item.isActive}
            class:opacity-50={item.isScrolledOver && !item.isActive}
            style="padding-left: {0.5 + (item.level - 1) * 0.75}rem;"
            onclick={() => scrollToHeading(item)}
            title={item.textContent}
          >
            {item.textContent || 'Untitled'}
          </button>
        </li>
      {/each}
    </ul>
  </nav>
{/if}
