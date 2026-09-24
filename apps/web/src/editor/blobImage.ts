import { Image } from '@tiptap/extension-image';
import { blobIdFromSrc } from '../storage/blobRefs';
import { loadObjectUrl, objectUrlFor } from '../storage/imageStore';

const PASSTHROUGH = ['alt', 'title', 'width', 'height'] as const;

/**
 * Image whose stored src is a `glossly-blob:<id>` reference. The node view
 * shows it through an object URL; getHTML() still renders the reference, so an
 * object URL (dead on the next page load) is never persisted.
 */
export const BlobImage = Image.extend({
  addNodeView() {
    return ({ node }) => {
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
          if (updated.type !== current.type) return false;
          current = updated;
          render();
          return true;
        }
      };
    };
  }
});
