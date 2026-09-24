import type { AnyExtension, Extensions } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { Color, TextStyle } from '@tiptap/extension-text-style';
import { ListItem, TaskItem, TaskList } from '@tiptap/extension-list';
import { Highlight } from '@tiptap/extension-highlight';
import { TextAlign } from '@tiptap/extension-text-align';
import { Subscript } from '@tiptap/extension-subscript';
import { Superscript } from '@tiptap/extension-superscript';
import { BlobImage } from './blobImage';

/**
 * The extensions that define the document schema — the editor and the
 * Markdown import/export must agree on it, so both build from this list.
 * Behaviour-only extensions (placeholder, character count, ...) stay in Editor.svelte.
 */
export const schemaExtensions: Extensions = [
  Color.configure({ types: [TextStyle.name, ListItem.name] }),
  TextStyle,
  // StarterKit's own extensions resolve a newer nested @tiptap/core (3.29 vs the
  // pinned 3.27), so its type isn't assignable to ours. Runtime is unaffected;
  // aligning the @tiptap versions removes the need for this cast.
  StarterKit as unknown as AnyExtension,
  Highlight.configure({ multicolor: true }),
  TextAlign.configure({ types: ['heading', 'paragraph'] }),
  TaskList,
  TaskItem.configure({ nested: true }),
  Subscript,
  Superscript,
  // allowBase64: the localStorage fallback still inserts data: URLs, and
  // documents from before WP3 hold them until their one-time conversion.
  BlobImage.configure({ allowBase64: true })
];
