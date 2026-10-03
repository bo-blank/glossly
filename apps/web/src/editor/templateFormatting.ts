import type { JSONContent } from '@tiptap/core';

// A template is a starting draft, not a formatted document (the writer's rule
// for the built-in ones, enforced by test there). Saving a document as a
// template keeps structure and plain emphasis and drops the rest.
const KEPT_MARKS = new Set(['bold', 'italic', 'link', 'code']);
const DROPPED_ATTRS = ['textAlign', 'color'];

/** The document's content with special formatting removed and every to-do unchecked. */
export function plainTemplateContent(node: JSONContent): JSONContent {
  const out: JSONContent = { ...node };
  if (node.attrs) {
    const attrs = { ...node.attrs };
    for (const key of DROPPED_ATTRS) delete attrs[key];
    if (node.type === 'taskItem') attrs.checked = false;
    out.attrs = attrs;
  }
  if (node.marks) {
    const marks = node.marks.filter((m) => KEPT_MARKS.has(m.type));
    if (marks.length) out.marks = marks;
    else delete out.marks;
  }
  if (node.content) out.content = node.content.map(plainTemplateContent);
  return out;
}
