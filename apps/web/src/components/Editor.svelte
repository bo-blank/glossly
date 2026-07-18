<script>
  import "./styles.scss";

  import { Color } from '@tiptap/extension-text-style';
  import { ListItem, TaskItem, TaskList } from '@tiptap/extension-list';
  import { TextStyle } from '@tiptap/extension-text-style';
  import { Highlight } from '@tiptap/extension-highlight';
  import { TextAlign } from '@tiptap/extension-text-align';
  import { Subscript } from '@tiptap/extension-subscript';
  import { Superscript } from '@tiptap/extension-superscript';
  import { Image } from '@tiptap/extension-image';
  import { Placeholder, Selection, CharacterCount } from '@tiptap/extensions';
  import { TableOfContents, getHierarchicalIndexes } from '@tiptap/extension-table-of-contents';
  import StarterKit from '@tiptap/starter-kit';
  import { Editor } from '@tiptap/core';
  import { onMount } from 'svelte';
  import { editorStore } from '../stores/noteStore';
  import { tocStore } from '../stores/tocStore';
  import { dashboardStore } from '../stores/dashboardStore';
  import { onSelectionChange } from '../note/requestSuggestions';
  import { computeReadability } from '../utils/readability';

  const DOC_STORAGE_KEY = 'glossly-document';
  const CONTEXT_CHAR_BUDGET = 2000;

  // oxlint-disable-next-line
  let element;
  let editor = $state(null);
  let toolbarRef = $state(null);
  let imageInputRef = $state(null);

  let headingOpen = $state(false);
  let headingPos = $state({ x: 0, y: 0 });
  let headingBtnRef = $state(null);

  let listOpen = $state(false);
  let listPos = $state({ x: 0, y: 0 });
  let listBtnRef = $state(null);

  let highlightOpen = $state(false);
  let highlightPos = $state({ x: 0, y: 0 });
  let highlightBtnRef = $state(null);

  let linkOpen = $state(false);
  let linkPos = $state({ x: 0, y: 0 });
  let linkBtnRef = $state(null);
  let linkUrl = $state('');

  const headingLevels = [1, 2, 3, 4];

  const highlightColors = [
    { label: 'Green', color: '#bbf7d0' },
    { label: 'Blue', color: '#bfdbfe' },
    { label: 'Red', color: '#fecaca' },
    { label: 'Purple', color: '#e9d5ff' },
    { label: 'Yellow', color: '#fef08a' },
  ];

  function closeAllMenus() {
    headingOpen = false;
    listOpen = false;
    highlightOpen = false;
    linkOpen = false;
  }

  function positionOf(btnRef) {
    const rect = btnRef.getBoundingClientRect();
    return { x: rect.left, y: rect.bottom };
  }

  function toggleHeadingMenu() {
    const wasOpen = headingOpen;
    closeAllMenus();
    if (!wasOpen && headingBtnRef) {
      headingPos = positionOf(headingBtnRef);
      headingOpen = true;
    }
  }

  function toggleListMenu() {
    const wasOpen = listOpen;
    closeAllMenus();
    if (!wasOpen && listBtnRef) {
      listPos = positionOf(listBtnRef);
      listOpen = true;
    }
  }

  function toggleHighlightMenu() {
    const wasOpen = highlightOpen;
    closeAllMenus();
    if (!wasOpen && highlightBtnRef) {
      highlightPos = positionOf(highlightBtnRef);
      highlightOpen = true;
    }
  }

  function toggleLinkMenu() {
    const wasOpen = linkOpen;
    closeAllMenus();
    if (!wasOpen && linkBtnRef) {
      linkUrl = editor.getAttributes('link').href || '';
      linkPos = positionOf(linkBtnRef);
      linkOpen = true;
    }
  }

  function applyLink() {
    if (!linkUrl) return;
    editor.chain().focus().extendMarkRange('link').setLink({ href: linkUrl }).run();
    linkOpen = false;
  }

  function removeLink() {
    editor.chain().focus().extendMarkRange('link').unsetLink().run();
    linkUrl = '';
    linkOpen = false;
  }

  function triggerImageUpload() {
    if (imageInputRef) imageInputRef.click();
  }

  function handleImageFile(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      editor.chain().focus().setImage({ src: reader.result }).run();
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  onMount(() => {
    const handleClick = (e) => {
      if (toolbarRef && !toolbarRef.contains(e.target)) {
        closeAllMenus();
      }
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  });

  function extractContext(doc, from) {
    const blocks = [];
    let currentIndex = -1;
    let i = 0;
    doc.forEach((node, offset) => {
      if (from >= offset && from <= offset + node.nodeSize) currentIndex = i;
      blocks.push(node);
      i++;
    });

    const parts = [];
    for (let idx = Math.max(0, currentIndex - 1); idx <= Math.min(blocks.length - 1, currentIndex + 1); idx++) {
      const text = blocks[idx]?.textContent?.trim();
      if (text) parts.push(text);
    }
    return parts.join('\n\n').slice(0, CONTEXT_CHAR_BUDGET);
  }

  function handleSelectionUpdate(ed) {
    const { from, to, empty } = ed.state.selection;
    editorStore.set({ editor: ed, selection: { from, to }, document: ed.getHTML() });

    if (empty) {
      onSelectionChange(null);
      return;
    }

    const selectedText = ed.state.doc.textBetween(from, to, '\n');
    const context = extractContext(ed.state.doc, from);

    let screenPos = null;
    try {
      const coords = ed.view.coordsAtPos(to);
      const NOTE_WIDTH = 288;
      const NOTE_MAX_HEIGHT = 400;
      const MARGIN = 16;
      const left = Math.min(coords.right + 24, window.innerWidth - NOTE_WIDTH - MARGIN);
      const top = Math.min(coords.bottom, window.innerHeight - NOTE_MAX_HEIGHT - MARGIN);
      screenPos = { left: Math.max(MARGIN, left), bottom: Math.max(MARGIN, top) };
    } catch {
      screenPos = null;
    }

    onSelectionChange({ selectedText, context, from, to, screenPos });
  }

  let autosaveTimer;
  function scheduleAutosave(ed) {
    clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(() => {
      localStorage.setItem(DOC_STORAGE_KEY, ed.getHTML());
    }, 500);
  }

  function publishDashboardStats(ed) {
    dashboardStore.set(
      computeReadability(ed.getText(), {
        words: ed.storage.characterCount.words(),
        characters: ed.storage.characterCount.characters()
      })
    );
  }

  // `editor = editor` doesn't bump Svelte 5's reactivity for an unchanged object
  // reference, so the word count needs its own version counter to know when to recompute.
  let docVersion = $state(0);
  let wordCount = $derived.by(() => {
    docVersion;
    return editor?.storage.characterCount.words() ?? 0;
  });
  let charCount = $derived.by(() => {
    docVersion;
    return editor?.storage.characterCount.characters() ?? 0;
  });

  function btnClass(isActive, isDisabled) {
    if (isDisabled) return 'btn btn-disabled btn-ghost btn-sm btn-square';
    if (isActive) return 'btn btn-primary btn-sm btn-square';
    return 'btn btn-ghost btn-sm btn-square';
  }

  const DEFAULT_CONTENT = `
            <h2>
              Hi there,
            </h2>
            <p>
              this is a <em>basic</em> example of <strong>Tiptap</strong>. Sure, there are all kind of basic text styles you'd probably expect from a text editor. But wait until you see the lists:
            </p>
            <ul>
              <li>
                That's a bullet list with one …
              </li>
              <li>
                … or two list items.
              </li>
            </ul>
            <p>
              Isn't that great? And all of that is editable. But wait, there's more. Let's try a code block:
            </p>
            <pre><code class="language-css">body {
  display: none;
}</code></pre>
            <p>
              I know, I know, this is impressive. It's only the tip of the iceberg though. Give it a try and click a little bit around. Don't forget to check the other examples too.
            </p>
            <blockquote>
              Wow, that's amazing. Good work, boy! 👏
              <br />
              — Mom
            </blockquote>
          `;

  onMount(() => {
    const savedContent = localStorage.getItem(DOC_STORAGE_KEY);

    editor = new Editor({
      element: element,
      extensions: [
        Color.configure({ types: [TextStyle.name, ListItem.name] }),
        TextStyle.configure({ types: [ListItem.name] }),
        StarterKit,
        Highlight.configure({ multicolor: true }),
        TextAlign.configure({ types: ['heading', 'paragraph'] }),
        TaskList,
        TaskItem.configure({ nested: true }),
        Subscript,
        Superscript,
        Image,
        Placeholder.configure({ placeholder: 'Start writing…' }),
        Selection,
        CharacterCount,
        TableOfContents.configure({
          getIndex: getHierarchicalIndexes,
          onUpdate: (content) => tocStore.set(content),
        }),
      ],
      content: savedContent || DEFAULT_CONTENT,
      onTransaction: () => {
        // force re-render so `editor.isActive` works as expected
        // oxlint-disable-next-line no-self-assign
        editor = editor;
      },
      onSelectionUpdate: ({ editor: ed }) => handleSelectionUpdate(ed),
      onUpdate: ({ editor: ed }) => {
        docVersion++;
        scheduleAutosave(ed);
        publishDashboardStats(ed);
      },
    });

    publishDashboardStats(editor);
  });
</script>

{#if editor}
  <div class="border border-base-300 rounded-xl overflow-visible">
    <div class="toolbar p-2 bg-base-100 flex items-center gap-1 flex-wrap" bind:this={toolbarRef}>

      <!-- Undo / redo -->
      <div class="toolbar-group">
        <button
          onclick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().chain().focus().undo().run()}
          class={btnClass(false, !editor.can().chain().focus().undo().run())}
          title="Undo (⌘Z)"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
        </button>
        <button
          onclick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().chain().focus().redo().run()}
          class={btnClass(false, !editor.can().chain().focus().redo().run())}
          title="Redo (⌘⇧Z)"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.13-9.36L23 10"/></svg>
        </button>
      </div>

      <div class="toolbar-divider"></div>

      <!-- Heading dropdown / list dropdown / blockquote / code block -->
      <div class="toolbar-group">
        <button
          bind:this={headingBtnRef}
          onclick={(e) => { e.stopPropagation(); toggleHeadingMenu(); }}
          class={btnClass(editor.isActive('heading'), false)}
          title="Heading"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5v14"/><path d="M16 5v14"/><path d="M4 12h12"/></svg>
          <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
        </button>
        {#if headingOpen}
          <div
            class="fixed p-2 w-48 bg-base-200 border border-base-300 rounded-lg shadow-lg z-[100]"
            style="left: {headingPos.x}px; top: {headingPos.y}px;"
          >
            <button onclick={() => { editor.chain().focus().setParagraph().run(); headingOpen = false; }}
              class="block w-full text-left px-3 py-2 rounded-md text-sm hover:bg-base-300 transition-colors">Paragraph</button>
            {#each headingLevels as level}
              <button onclick={() => { editor.chain().focus().toggleHeading({ level }).run(); headingOpen = false; }}
                class="block w-full text-left px-3 py-2 rounded-md text-sm hover:bg-base-300 transition-colors">Heading {level}</button>
            {/each}
          </div>
        {/if}

        <button
          bind:this={listBtnRef}
          onclick={(e) => { e.stopPropagation(); toggleListMenu(); }}
          class={btnClass(editor.isActive('bulletList') || editor.isActive('orderedList') || editor.isActive('taskList'), false)}
          title="List"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><circle cx="4" cy="6" r="1" fill="currentColor"/><circle cx="4" cy="12" r="1" fill="currentColor"/><circle cx="4" cy="18" r="1" fill="currentColor"/></svg>
          <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
        </button>
        {#if listOpen}
          <div
            class="fixed p-2 w-40 bg-base-200 border border-base-300 rounded-lg shadow-lg z-[100]"
            style="left: {listPos.x}px; top: {listPos.y}px;"
          >
            <button onclick={() => { editor.chain().focus().toggleBulletList().run(); listOpen = false; }}
              class="block w-full text-left px-3 py-2 rounded-md text-sm hover:bg-base-300 transition-colors">Bullet list</button>
            <button onclick={() => { editor.chain().focus().toggleOrderedList().run(); listOpen = false; }}
              class="block w-full text-left px-3 py-2 rounded-md text-sm hover:bg-base-300 transition-colors">Ordered list</button>
            <button onclick={() => { editor.chain().focus().toggleTaskList().run(); listOpen = false; }}
              class="block w-full text-left px-3 py-2 rounded-md text-sm hover:bg-base-300 transition-colors">Task list</button>
          </div>
        {/if}

        <button
          onclick={() => editor.chain().focus().toggleBlockquote().run()}
          class={btnClass(editor.isActive('blockquote'), false)}
          title="Quote"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M10 8c-1.1 0-2 .9-2 2v8h4v-6c0-.6.4-1 1-1h2v-3h-5zm8 0c-1.1 0-2 .9-2 2v8h4v-6c0-.6.4-1 1-1h2v-3h-5z"/></svg>
        </button>
        <button
          onclick={() => editor.chain().focus().toggleCodeBlock().run()}
          class={btnClass(editor.isActive('codeBlock'), false)}
          title="Code block"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="8 6 3 12 8 18"/><polyline points="16 6 21 12 16 18"/></svg>
        </button>
      </div>

      <div class="toolbar-divider"></div>

      <!-- Marks -->
      <div class="toolbar-group">
        <button
          onclick={() => editor.chain().focus().toggleBold().run()}
          disabled={!editor.can().chain().focus().toggleBold().run()}
          class={btnClass(editor.isActive('bold'), !editor.can().chain().focus().toggleBold().run())}
          title="Bold (⌘B)"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/><path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/></svg>
        </button>
        <button
          onclick={() => editor.chain().focus().toggleItalic().run()}
          disabled={!editor.can().chain().focus().toggleItalic().run()}
          class={btnClass(editor.isActive('italic'), !editor.can().chain().focus().toggleItalic().run())}
          title="Italic (⌘I)"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="4" x2="10" y2="4"/><line x1="14" y1="20" x2="5" y2="20"/><line x1="15" y1="4" x2="9" y2="20"/></svg>
        </button>
        <button
          onclick={() => editor.chain().focus().toggleStrike().run()}
          disabled={!editor.can().chain().focus().toggleStrike().run()}
          class={btnClass(editor.isActive('strike'), !editor.can().chain().focus().toggleStrike().run())}
          title="Strikethrough"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 12H5"/><path d="M4 17h6a3 3 0 0 0 3-3 3 3 0 0 0-3-3H4"/><path d="M20 7h-6a3 3 0 0 0-3 3 3 3 0 0 0 3 3h12"/></svg>
        </button>
        <button
          onclick={() => editor.chain().focus().toggleCode().run()}
          disabled={!editor.can().chain().focus().toggleCode().run()}
          class={btnClass(editor.isActive('code'), !editor.can().chain().focus().toggleCode().run())}
          title="Inline code"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
        </button>
        <button
          onclick={() => editor.chain().focus().toggleUnderline().run()}
          disabled={!editor.can().chain().focus().toggleUnderline().run()}
          class={btnClass(editor.isActive('underline'), !editor.can().chain().focus().toggleUnderline().run())}
          title="Underline (⌘U)"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4v6a6 6 0 0 0 12 0V4"/><line x1="4" y1="20" x2="20" y2="20"/></svg>
        </button>

        <button
          bind:this={highlightBtnRef}
          onclick={(e) => { e.stopPropagation(); toggleHighlightMenu(); }}
          class={btnClass(editor.isActive('highlight'), false)}
          title="Highlight"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l6-6 4 4-8 8H7v-4z"/><line x1="5" y1="21" x2="11" y2="21"/></svg>
        </button>
        {#if highlightOpen}
          <div
            class="fixed p-2 bg-base-200 border border-base-300 rounded-lg shadow-lg z-[100] flex items-center gap-1"
            style="left: {highlightPos.x}px; top: {highlightPos.y}px;"
          >
            {#each highlightColors as swatch}
              <button
                onclick={() => { editor.chain().focus().toggleHighlight({ color: swatch.color }).run(); highlightOpen = false; }}
                class="w-6 h-6 rounded-full border border-base-300"
                style="background-color: {swatch.color};"
                title={swatch.label}
                aria-label="{swatch.label} highlight"
              ></button>
            {/each}
            <button
              onclick={() => { editor.chain().focus().unsetHighlight().run(); highlightOpen = false; }}
              class="btn btn-ghost btn-sm btn-square"
              title="Remove highlight"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><line x1="5" y1="19" x2="19" y2="5"/></svg>
            </button>
          </div>
        {/if}

        <button
          bind:this={linkBtnRef}
          onclick={(e) => { e.stopPropagation(); toggleLinkMenu(); }}
          class={btnClass(editor.isActive('link'), false)}
          title="Link"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 12a3 3 0 0 1 3-3h2l2-2a4 4 0 1 1 4 4l-2 2"/><path d="M16 12a3 3 0 0 1-3 3h-2l-2 2a4 4 0 1 1-4-4l2-2"/></svg>
        </button>
        {#if linkOpen}
          <div
            class="fixed p-2 w-64 bg-base-200 border border-base-300 rounded-lg shadow-lg z-[100]"
            style="left: {linkPos.x}px; top: {linkPos.y}px;"
          >
            <div class="flex items-center gap-1">
              <input
                type="url"
                placeholder="Paste a link…"
                bind:value={linkUrl}
                onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); applyLink(); } }}
                class="input input-sm input-bordered flex-1"
              />
              <button onclick={applyLink} class="btn btn-ghost btn-sm btn-square" title="Apply link">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 10 4 15 9 20"/><path d="M20 4v7a4 4 0 0 1-4 4H4"/></svg>
              </button>
              <button onclick={removeLink} class="btn btn-ghost btn-sm btn-square" title="Remove link">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 6 8 6 20 6"/><path d="M9 6V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1"/><path d="M18 6l-1 13a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L6 6"/></svg>
              </button>
            </div>
          </div>
        {/if}
      </div>

      <div class="toolbar-divider"></div>

      <!-- Super / subscript -->
      <div class="toolbar-group">
        <button
          onclick={() => editor.chain().focus().toggleSuperscript().run()}
          class={btnClass(editor.isActive('superscript'), false)}
          title="Superscript"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><text x="2" y="18" font-size="13" fill="currentColor" stroke="none">x</text><text x="14" y="9" font-size="8" fill="currentColor" stroke="none">2</text></svg>
        </button>
        <button
          onclick={() => editor.chain().focus().toggleSubscript().run()}
          class={btnClass(editor.isActive('subscript'), false)}
          title="Subscript"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><text x="2" y="14" font-size="13" fill="currentColor" stroke="none">x</text><text x="14" y="21" font-size="8" fill="currentColor" stroke="none">2</text></svg>
        </button>
      </div>

      <div class="toolbar-divider"></div>

      <!-- Text align -->
      <div class="toolbar-group">
        <button
          onclick={() => editor.chain().focus().setTextAlign('left').run()}
          class={btnClass(editor.isActive({ textAlign: 'left' }), false)}
          title="Align left"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="15" y2="12"/><line x1="3" y1="18" x2="18" y2="18"/></svg>
        </button>
        <button
          onclick={() => editor.chain().focus().setTextAlign('center').run()}
          class={btnClass(editor.isActive({ textAlign: 'center' }), false)}
          title="Align center"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="6" y1="12" x2="18" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></svg>
        </button>
        <button
          onclick={() => editor.chain().focus().setTextAlign('right').run()}
          class={btnClass(editor.isActive({ textAlign: 'right' }), false)}
          title="Align right"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="9" y1="12" x2="21" y2="12"/><line x1="6" y1="18" x2="21" y2="18"/></svg>
        </button>
        <button
          onclick={() => editor.chain().focus().setTextAlign('justify').run()}
          class={btnClass(editor.isActive({ textAlign: 'justify' }), false)}
          title="Justify"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
        </button>
      </div>

      <div class="toolbar-divider"></div>

      <!-- Image upload -->
      <div class="toolbar-group">
        <button
          onclick={triggerImageUpload}
          class="btn btn-ghost btn-sm btn-square"
          title="Add image"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" stroke="none"/><path d="M21 15l-5-5-4 4-3-3-6 6"/></svg>
        </button>
        <input
          type="file"
          accept="image/*"
          bind:this={imageInputRef}
          onchange={handleImageFile}
          class="hidden"
        />
      </div>

    </div>
  </div>
{/if}
<div bind:this={element} class="min-h-[400px]"></div>
{#if editor}
  <div class="word-count px-4 pb-2 text-xs opacity-60">
    {wordCount} words · {charCount} characters
  </div>
{/if}
