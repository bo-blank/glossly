import { createDocument, Node, type JSONContent } from '@tiptap/core';
import type { Node as PMNode, Schema } from 'prosemirror-model';

// Phase 5: the document is made of blocks, one per unit of meaning. A block is
// a `section` node with an optional name; it is not in the `block` group, so
// it can only sit directly in the document and never nests.

/** The document holds blocks and nothing else. Replaces StarterKit's document. */
export const SectionDocument = Node.create({
  name: 'doc',
  topNode: true,
  content: 'section+'
});

export const Section = Node.create({
  name: 'section',
  content: 'block+',
  defining: true,
  draggable: true,

  addAttributes() {
    return {
      name: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-block') ?? '',
        // Rendered by the node itself: an unnamed block must still carry the
        // attribute, or saved HTML would read as pre-block content (see hasSectionMarkup).
        rendered: false
      }
    };
  },

  parseHTML() {
    return [{ tag: 'section[data-block]' }];
  },

  renderHTML({ node }) {
    return ['section', { 'data-block': node.attrs.name }, 0];
  }
});

export const SECTION_NAME_MAX = 60;

/** A block name as stored: one line, trimmed, at most SECTION_NAME_MAX characters. */
export function cleanSectionName(name: string): string {
  return name.replace(/\s+/g, ' ').trim().slice(0, SECTION_NAME_MAX).trim();
}

/** Whether HTML was saved with blocks. Without them it predates Phase 5 and is split by rule A. */
export function hasSectionMarkup(html: string): boolean {
  return /<section\b[^>]*\sdata-block\b/i.test(html);
}

/** H1 and H2 open a new block; H3 and below are structure inside one. */
const opensBlock = (node: PMNode) => node.type.name === 'heading' && node.attrs.level <= 2;

/**
 * Rule A, for content that has no blocks yet: a new block before every H1/H2,
 * unless the block so far holds nothing but headings — so a title and the
 * chapter heading under it stay together. No headings, one block.
 *
 * Takes the document's blocks as they are and regroups their children; the
 * text itself is never touched.
 */
export function regroupSections(doc: PMNode): PMNode {
  const schema = doc.type.schema;
  const section = schema.nodes.section;
  const groups: PMNode[][] = [];
  let current: PMNode[] = [];
  doc.forEach((block) =>
    block.forEach((node) => {
      if (opensBlock(node) && current.some((n) => n.type.name !== 'heading')) {
        groups.push(current);
        current = [];
      }
      current.push(node);
    })
  );
  if (current.length) groups.push(current);
  if (groups.length === 0) return doc;
  return doc.type.create(doc.attrs, groups.map((nodes) => section.create(null, nodes)));
}

/**
 * Whether the blocks say more than the headings do: a name, or a split that
 * rule A would not make. Only then does Markdown need block markers (decision B).
 */
export function needsBlockMarkers(doc: PMNode): boolean {
  return !regroupSections(doc).eq(doc);
}

/**
 * Stored or template HTML as editor content. HTML saved with blocks passes
 * through unchanged; older HTML is wrapped by ProseMirror's parser (into one
 * block) and then split by rule A. Needs a DOM, so browser only.
 */
export function sectionedContent(html: string, schema: Schema): string | JSONContent {
  if (hasSectionMarkup(html)) return html;
  return regroupSections(createDocument(html, schema)).toJSON();
}
