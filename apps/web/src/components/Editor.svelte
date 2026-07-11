<!-- components/Editor.svelte -->
<script lang="ts">
  // TODO: wire up Tiptap (see docs/specification/specs.md). Tiptap has no
  // official Svelte binding, so this needs a Svelte action mounting
  // @tiptap/core's Editor onto editorElement below.
  let editorElement: HTMLDivElement;
</script>

<div class="editor-container" bind:this={editorElement}></div>

<style>
.editor-container {
  /* Editor styling matching spec */
  font-family: 'Newsreader', serif;
  font-size: 16px;
  line-height: 1.5;
  color: #000;
  background: #fff;
  padding: 2rem;
  max-width: 640px;
  margin: 0 auto;
  min-height: 300px;
}
</style>
