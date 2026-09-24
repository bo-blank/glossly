import { Image } from '@tiptap/extension-image';
import { blobIdFromSrc } from '../storage/blobRefs';
import { loadObjectUrl, objectUrlFor } from '../storage/imageStore';

const PASSTHROUGH = ['alt', 'title', 'width', 'height'] as const;

/**
 * Remote images (typical in an imported README) are not fetched: rendering one
 * would be a network call to a third-party server, and Glossly promises none.
 * The node stays in the document and exports unchanged.
 */
export function isRemoteSrc(src: string | null | undefined): boolean {
  return !!src && /^(https?:)?\/\//i.test(src.trim());
}

function remotePlaceholder(src: string, alt: string | null): HTMLElement {
  const box = document.createElement('div');
  box.className = 'glossly-remote-image inline-block text-xs opacity-70 border border-dashed border-base-300 rounded px-2 py-1 my-1';
  box.title = src;
  let host = src;
  try {
    host = new URL(src, 'https://x').host;
  } catch {
    // keep the raw src
  }
  box.textContent = `🖼 ${alt ? `${alt} — ` : ''}remote image from ${host}, not loaded (Glossly makes no network calls)`;
  return box;
}

/**
 * Image whose stored src is a `glossly-blob:<id>` reference. The node view
 * shows it through an object URL; getHTML() still renders the reference, so an
 * object URL (dead on the next page load) is never persisted.
 */
export const BlobImage = Image.extend({
  addNodeView() {
    return ({ node }) => {
      const remote = isRemoteSrc(node.attrs.src);
      if (remote) {
        return {
          dom: remotePlaceholder(node.attrs.src, node.attrs.alt),
          // Re-create the view if the src stops being remote (or changes host).
          update: (updated) => updated.type === node.type && updated.attrs.src === node.attrs.src && updated.attrs.alt === node.attrs.alt
        };
      }

      const img = document.createElement('img');
      let current = node;

      function render() {
        for (const name of PASSTHROUGH) {
          const value = current.attrs[name];
          if (value == null) img.removeAttribute(name);
          else img.setAttribute(name, String(value));
        }
        const src: string | null = current.attrs.src;
        const id = blobIdFromSrc(src);
        if (!id) {
          if (src) img.src = src;
          return;
        }
        const url = objectUrlFor(id);
        if (url) {
          img.src = url;
          return;
        }
        // Not preloaded (e.g. pasted from another document): fetch, then show
        // it unless the node changed in the meantime.
        img.removeAttribute('src');
        loadObjectUrl(id).then((loaded) => {
          if (loaded && current.attrs.src === src) img.src = loaded;
        });
      }

      render();
      return {
        dom: img,
        update(updated) {
          if (updated.type !== current.type || isRemoteSrc(updated.attrs.src)) return false;
          current = updated;
          render();
          return true;
        }
      };
    };
  }
});
