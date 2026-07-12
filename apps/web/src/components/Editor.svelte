<script>
  import "./styles.scss";

  import { Color } from '@tiptap/extension-text-style';
  import { ListItem } from '@tiptap/extension-list';
  import { TextStyle } from '@tiptap/extension-text-style';
  import StarterKit from '@tiptap/starter-kit';
  import { Editor } from '@tiptap/core';
  import { onMount } from 'svelte';

  // oxlint-disable-next-line
  let element;
  let editor = $state(null);
  let dropdownOpen = $state(false);
  let dropdownPos = $state({ x: 0, y: 0 });
  let dropdownBtnRef = $state(null);
  let toolbarRef = $state(null);

  function openDropdown() {
    if (!dropdownBtnRef) return;
    const rect = dropdownBtnRef.getBoundingClientRect();
    dropdownPos = { x: rect.left, y: rect.bottom };
    dropdownOpen = true;
  }

  onMount(() => {
    const handleClick = (e) => {
      if (dropdownOpen && toolbarRef && !toolbarRef.contains(e.target)) {
        dropdownOpen = false;
      }
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  });

  function btnClass(isActive, isDisabled) {
    if (isDisabled) return 'btn btn-disabled btn-ghost btn-sm btn-square';
    if (isActive) return 'btn btn-primary btn-sm btn-square';
    return 'btn btn-ghost btn-sm btn-square';
  }

  onMount(() => {
    editor = new Editor({
      element: element,
      extensions: [
        Color.configure({ types: [TextStyle.name, ListItem.name] }),
        TextStyle.configure({ types: [ListItem.name] }),
        StarterKit,
      ],
      content: `
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
          `,
      onTransaction: () => {
        // force re-render so `editor.isActive` works as expected
        // oxlint-disable-next-line no-self-assign
        editor = editor;
      },
    });
  });
</script>

{#if editor}
  <div class="border border-base-300 rounded-xl overflow-visible">
    <div class="toolbar p-2 bg-base-100 flex items-center gap-1 flex-wrap" bind:this={toolbarRef}>

      <!-- Text formatting -->
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
        <label class="btn btn-ghost btn-sm btn-square" title="Text color">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3" fill="#958DF1" stroke="none"/><path d="M12 15v6"/></svg>
          <input
            type="color"
            value="#958DF1"
            class="color-picker w-0 h-0 opacity-0 absolute"
            onchange={(e) => {
              editor.chain().focus().setColor(e.target.value).run();
            }}
          />
        </label>
      </div>

      <div class="toolbar-divider"></div>

      <!-- Block type (dropdown) -->
      <button
        bind:this={dropdownBtnRef}
        onclick={(e) => { e.stopPropagation(); openDropdown(); }}
        class="btn btn-ghost btn-sm btn-square"
        title="Block style"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
      </button>
      {#if dropdownOpen}
        <div
          class="fixed p-2 w-48 bg-base-200 border border-base-300 rounded-lg shadow-lg z-[100]"
          style="left: {dropdownPos.x}px; top: {dropdownPos.y}px;"
        >
          <button onclick={() => { editor.chain().focus().setParagraph().run(); dropdownOpen = false; }}
            class="block w-full text-left px-3 py-2 rounded-md text-sm hover:bg-base-300 transition-colors">Paragraph</button>
          <button onclick={() => { editor.chain().focus().toggleHeading({ level: 1 }).run(); dropdownOpen = false; }}
            class="block w-full text-left px-3 py-2 rounded-md text-sm hover:bg-base-300 transition-colors">Heading 1</button>
          <button onclick={() => { editor.chain().focus().toggleHeading({ level: 2 }).run(); dropdownOpen = false; }}
            class="block w-full text-left px-3 py-2 rounded-md text-sm hover:bg-base-300 transition-colors">Heading 2</button>
          <button onclick={() => { editor.chain().focus().toggleHeading({ level: 3 }).run(); dropdownOpen = false; }}
            class="block w-full text-left px-3 py-2 rounded-md text-sm hover:bg-base-300 transition-colors">Heading 3</button>
          <button onclick={() => { editor.chain().focus().toggleHeading({ level: 4 }).run(); dropdownOpen = false; }}
            class="block w-full text-left px-3 py-2 rounded-md text-sm hover:bg-base-300 transition-colors">Heading 4</button>
          <button onclick={() => { editor.chain().focus().toggleHeading({ level: 5 }).run(); dropdownOpen = false; }}
            class="block w-full text-left px-3 py-2 rounded-md text-sm hover:bg-base-300 transition-colors">Heading 5</button>
          <button onclick={() => { editor.chain().focus().toggleHeading({ level: 6 }).run(); dropdownOpen = false; }}
            class="block w-full text-left px-3 py-2 rounded-md text-sm hover:bg-base-300 transition-colors">Heading 6</button>
        </div>
      {/if}

      <div class="toolbar-divider"></div>

      <!-- Lists -->
      <div class="toolbar-group">
        <button
          onclick={() => editor.chain().focus().toggleBulletList().run()}
          class={btnClass(editor.isActive('bulletList'), false)}
          title="Bullet list"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><circle cx="4" cy="6" r="1" fill="currentColor"/><circle cx="4" cy="12" r="1" fill="currentColor"/><circle cx="4" cy="18" r="1" fill="currentColor"/></svg>
        </button>
        <button
          onclick={() => editor.chain().focus().toggleOrderedList().run()}
          class={btnClass(editor.isActive('orderedList'), false)}
          title="Numbered list"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/><text x="3" y="8" font-size="7" fill="currentColor" stroke="none" font-weight="bold">1</text><text x="3" y="14" font-size="7" fill="currentColor" stroke="none" font-weight="bold">2</text><text x="3" y="20" font-size="7" fill="currentColor" stroke="none" font-weight="bold">3</text></svg>
        </button>
      </div>

      <div class="toolbar-divider"></div>

      <!-- Block elements -->
      <div class="toolbar-group">
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
        <button
          onclick={() => editor.chain().focus().setHorizontalRule().run()}
          class="btn btn-ghost btn-sm btn-square"
          title="Horizontal rule"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="12" x2="21" y2="12"/></svg>
        </button>
      </div>

      <div class="toolbar-divider"></div>

      <!-- Actions -->
      <div class="toolbar-group ml-auto">
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
          title="Redo (⌘ShiftZ)"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.13-9.36L23 10"/></svg>
        </button>
        <button
          onclick={() => editor.chain().focus().unsetAllMarks().run()}
          class="btn btn-ghost btn-sm btn-square"
          title="Clear text formatting"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

    </div>
  </div>
{/if}
<div bind:this={element} class="min-h-[400px] p-4"></div>
