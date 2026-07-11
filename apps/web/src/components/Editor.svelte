<!-- components/Editor.svelte -->
<script>
  import { Editor } from '@tiptap/core';
  import { EditorContent } from '@tiptap/svelte';
  import StarterKit from '@tiptap/starter-kit';
  import { EditorContent } from '@tiptap/svelte';
  
  let { editor } = $state({ editor: null });
  
  // Editor setup
  const editorElement = useEditor({
    extensions: [StarterKit],
    content: '',
    onUpdate: ({ editor }) => {
      editorStore.document = editor.getHTML();
    },
    onSelectionUpdate: ({ editor }) => {
      editorStore.selection = editor.view.state.selection;
      // Trigger suggestion request
      requestSuggestions();
    }
  });
  
  function requestSuggestions() {
    // Implementation for getting suggestions
  }
</script>

<div class="editor-container">
  <EditorContent {editor} />
</div>

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
}
</style>
