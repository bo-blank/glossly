import { getHTMLFromFragment, type Editor } from '@tiptap/core';
import { blobIdFromSrc } from '../storage/blobRefs';
import { imageDataUrl } from '../storage/imageStore';
import { fromMarkdown, toMarkdown } from './markdown';

export const MARKDOWN_ACCEPT = '.md,.markdown,text/markdown,text/plain';

/** A file name from a document title: no path separators or characters filesystems reject. */
export function markdownFileName(title: string): string {
  const safe = title.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '').replace(/\s+/g, ' ').trim().slice(0, 80);
  return `${safe || 'Untitled'}.md`;
}

/**
 * The document as Markdown. Stored images become data: URLs so the file stands
 * on its own — a glossly-blob: reference means nothing outside this browser.
 */
export async function editorToMarkdown(editor: Editor): Promise<string> {
  const embedded = new Map<string, string>();
  const ids: string[] = [];
  editor.state.doc.descendants((node) => {
    const id = node.type.name === 'image' ? blobIdFromSrc(node.attrs.src) : null;
    if (id) ids.push(id);
  });
  for (const id of new Set(ids)) {
    const dataUrl = await imageDataUrl(id);
    if (dataUrl) embedded.set(id, dataUrl);
  }
  const markdown = toMarkdown(editor.state.doc, (src) => {
    const id = blobIdFromSrc(src);
    return (id && embedded.get(id)) || src;
  });
  // Text files end with a newline; git and cat both complain otherwise.
  return markdown.endsWith('\n') ? markdown : `${markdown}\n`;
}

/** Downloads a file — the export path everywhere, and the only one outside Chromium (WP5). */
export function downloadMarkdown(markdown: string, fileName: string): void {
  const url = URL.createObjectURL(new Blob([markdown], { type: 'text/markdown;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  // Revoke on the next tick: some browsers start the download asynchronously.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** Markdown text → editor HTML, ready to become a new document. */
export function markdownToHtml(markdown: string, editor: Editor): string {
  const doc = fromMarkdown(markdown, editor.schema);
  return getHTMLFromFragment(doc.content, editor.schema);
}
