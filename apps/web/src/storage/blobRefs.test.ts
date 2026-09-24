import { describe, expect, it } from 'vitest';
import { blobIdFromSrc, dataUrlToBlob, extractBlobIds, findDataUrls, missingIds, orphanIds, replaceSrc } from './blobRefs';

describe('blobRefs', () => {
  it('extracts glossly-blob ids from HTML without duplicates', () => {
    const html = '<p>x</p><img src="glossly-blob:a1"><img src="glossly-blob:b2"><img src="glossly-blob:a1"><img src="https://x/y.png">';
    expect([...extractBlobIds(html)]).toEqual(['a1', 'b2']);
    expect(extractBlobIds('<p>no images</p>').size).toBe(0);
  });

  it('reads the id back from a src', () => {
    expect(blobIdFromSrc('glossly-blob:abc')).toBe('abc');
    expect(blobIdFromSrc('data:image/png;base64,AA==')).toBeNull();
    expect(blobIdFromSrc(null)).toBeNull();
  });

  it('computes orphans as stored minus referenced', () => {
    expect(orphanIds(['a', 'b', 'c'], new Set(['b']))).toEqual(['a', 'c']);
    expect(orphanIds([], new Set(['b']))).toEqual([]);
  });

  it('computes missing as referenced minus stored', () => {
    expect(missingIds(['a'], new Set(['a', 'b']))).toEqual(['b']);
  });

  it('converts a data URL to a Blob with its type and bytes', async () => {
    const blob = dataUrlToBlob('data:image/png;base64,iVBORw0KGgo=');
    expect(blob?.type).toBe('image/png');
    expect([...new Uint8Array(await blob!.arrayBuffer())]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  });

  it('rejects malformed data URLs', () => {
    expect(dataUrlToBlob('data:image/png,not-base64')).toBeNull();
    expect(dataUrlToBlob('data:image/png;base64,***')).toBeNull();
    expect(dataUrlToBlob('https://example.com/a.png')).toBeNull();
    expect(dataUrlToBlob('data:image/png;base64,abcde')).toBeNull(); // impossible length
  });

  it('finds data-URL images and replaces srcs literally', () => {
    const url = 'data:image/png;base64,AA+/==';
    const html = `<img src="${url}"><img src="${url}"><img src="glossly-blob:x">`;
    expect(findDataUrls(html)).toEqual([url]);
    expect(replaceSrc(html, url, 'glossly-blob:new')).toBe('<img src="glossly-blob:new"><img src="glossly-blob:new"><img src="glossly-blob:x">');
  });
});
