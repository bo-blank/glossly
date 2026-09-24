import {
  MarkdownParser,
  MarkdownSerializer,
  defaultMarkdownParser,
  defaultMarkdownSerializer,
  type MarkdownSerializerState
} from 'prosemirror-markdown';
import type { Node as PMNode, Schema } from 'prosemirror-model';

// prosemirror-markdown's defaults target prosemirror-schema-basic (snake_case);
// Tiptap's schema is camelCase. Everything below is re-keyed to Tiptap names.

const baseNodes = defaultMarkdownSerializer.nodes;
const baseMarks = defaultMarkdownSerializer.marks;

// Highlight, colour, underline, sub/superscript and alignment have no Markdown
// form: they export as their plain text. Serializing an unknown mark throws, so
// each needs an explicit no-op.
const plain = { open: '', close: '', mixable: true, expelEnclosingWhitespace: true };

function renderTaskList(state: MarkdownSerializerState, node: PMNode) {
  state.renderList(node, '  ', (i) => (node.child(i).attrs.checked ? '- [x] ' : '- [ ] '));
}

// The defaults read `order` and `params`; Tiptap names them `start` and
// `language`, and a node can't be re-created with foreign attribute names.
function renderOrderedList(state: MarkdownSerializerState, node: PMNode) {
  const start: number = node.attrs.start ?? 1;
  const width = String(start + node.childCount - 1).length;
  state.renderList(node, ' '.repeat(width + 2), (i) => {
    const n = String(start + i);
    return ' '.repeat(width - n.length) + n + '. ';
  });
}

function renderCodeBlock(state: MarkdownSerializerState, node: PMNode) {
  const backticks = node.textContent.match(/`{3,}/gm);
  const fence = backticks ? backticks.sort().slice(-1)[0] + '`' : '```';
  state.write(fence + (node.attrs.language ?? '') + '\n');
  state.text(node.textContent, false);
  state.write('\n');
  state.write(fence);
  state.closeBlock(node);
}

export type ImageSrcResolver = (src: string) => string;

function buildSerializer(resolveImage: ImageSrcResolver) {
  return new MarkdownSerializer(
    {
      doc: (state, node) => state.renderContent(node),
      paragraph: baseNodes.paragraph,
      text: baseNodes.text,
      heading: baseNodes.heading,
      blockquote: baseNodes.blockquote,
      horizontalRule: baseNodes.horizontal_rule,
      hardBreak: baseNodes.hard_break,
      listItem: baseNodes.list_item,
      taskItem: baseNodes.list_item,
      taskList: renderTaskList,
      bulletList: (state, node) => state.renderList(node, '  ', () => '- '),
      orderedList: renderOrderedList,
      codeBlock: renderCodeBlock,
      image: (state, node) => {
        const alt = state.esc(node.attrs.alt || '');
        const src = resolveImage(node.attrs.src ?? '').replace(/[()]/g, '\\$&');
        const title = node.attrs.title ? ` "${String(node.attrs.title).replace(/"/g, '\\"')}"` : '';
        state.write(`![${alt}](${src}${title})`);
        // A block node in Tiptap, unlike prosemirror-schema-basic's inline image.
        state.closeBlock(node);
      }
    },
    {
      bold: baseMarks.strong,
      italic: baseMarks.em,
      code: baseMarks.code,
      link: baseMarks.link,
      strike: { open: '~~', close: '~~', mixable: true, expelEnclosingWhitespace: true },
      underline: plain,
      highlight: plain,
      subscript: plain,
      superscript: plain,
      textStyle: plain
    }
  );
}

/** Serializes a document. `resolveImage` maps a stored src to what the file should contain. */
export function toMarkdown(doc: PMNode, resolveImage: ImageSrcResolver = (src) => src): string {
  // Tiptap lists carry no tight/loose flag; tight is what writers type.
  return buildSerializer(resolveImage).serialize(doc, { tightLists: true });
}

const tokenSpec = defaultMarkdownParser.tokens;

// A fresh tokenizer of the same class prosemirror-markdown bundles (markdown-it,
// CommonMark preset, no raw HTML) with strikethrough enabled. Built from the
// existing instance's constructor so markdown-it needn't be a direct dependency.
type Tokenizer = typeof defaultMarkdownParser.tokenizer;
const MarkdownIt = defaultMarkdownParser.tokenizer.constructor as new (preset: string, options: object) => Tokenizer;

type InlineToken = { type: string; content?: string };

/** Whether the text left around a lifted image is worth its own paragraph (not just line breaks or spaces). */
function hasVisibleContent(children: InlineToken[]): boolean {
  return children.some((c) => c.type === 'code_inline' || (c.type === 'text' && (c.content ?? '').trim() !== ''));
}

/**
 * Markdown puts images inside paragraphs; Tiptap's image is a block node, and a
 * paragraph holding one would be dropped whole. This markdown-it core rule
 * lifts each image out to block level, splitting the paragraph around it.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function hoistImages(state: any) {
  const out = [];
  const tokens = state.tokens;
  for (let i = 0; i < tokens.length; i++) {
    const [open, inline, close] = [tokens[i], tokens[i + 1], tokens[i + 2]];
    const hasImage = open.type === 'paragraph_open' && inline?.children?.some((t: { type: string }) => t.type === 'image');
    if (!hasImage) {
      out.push(open);
      continue;
    }
    const inListItem = tokens[i - 1]?.type === 'list_item_open';
    const pieces: { image?: unknown; children?: unknown[] }[] = [];
    let run: unknown[] = [];
    for (const child of inline.children) {
      if (child.type === 'image') {
        pieces.push({ children: run }, { image: child });
        run = [];
      } else run.push(child);
    }
    pieces.push({ children: run });
    const paragraph = (children: unknown[]) => {
      // The space that separated text from the image now sits at a paragraph edge.
      const texts = (children as InlineToken[]).filter((c) => c.type === 'text');
      if (texts.length) {
        texts[0].content = (texts[0].content ?? '').trimStart();
        texts[texts.length - 1].content = (texts[texts.length - 1].content ?? '').trimEnd();
      }
      const inl = new state.Token('inline', '', 0);
      inl.children = children;
      out.push(new state.Token('paragraph_open', 'p', 1), inl, new state.Token('paragraph_close', 'p', -1));
    };
    let first = true;
    for (const piece of pieces) {
      if (piece.image) {
        // A list item must start with a paragraph.
        if (first && inListItem) paragraph([]);
        out.push(piece.image);
        first = false;
      } else if (hasVisibleContent(piece.children as InlineToken[])) {
        paragraph(piece.children!);
        first = false;
      }
    }
    i += 2;
  }
  state.tokens = out;
}

const COMMENT_ONLY = /^\s*(<!--[\s\S]*?-->\s*)+$/;

/**
 * Raw HTML is never rendered. HTML comments (`<!-- omit in toc -->`, common in
 * READMEs) are meant to be invisible, so they are dropped; any other HTML stays
 * as literal text — shown, not interpreted, and not lost.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function neutralizeHtml(state: any) {
  const out = [];
  for (const token of state.tokens) {
    if (token.type === 'html_block') {
      if (COMMENT_ONLY.test(token.content)) continue;
      const text = new state.Token('text', '', 0);
      text.content = token.content.trimEnd();
      const inline = new state.Token('inline', '', 0);
      inline.children = [text];
      out.push(new state.Token('paragraph_open', 'p', 1), inline, new state.Token('paragraph_close', 'p', -1));
      continue;
    }
    if (token.type === 'inline' && token.children) {
      token.children = token.children
        .filter((c: InlineToken) => !(c.type === 'html_inline' && COMMENT_ONLY.test(c.content ?? '')))
        .map((c: InlineToken) => (c.type === 'html_inline' ? Object.assign(c, { type: 'text' }) : c));
      // A comment at the end of a heading leaves a dangling space behind.
      const last = token.children[token.children.length - 1];
      if (last?.type === 'text') last.content = last.content.trimEnd();
    }
    out.push(token);
  }
  state.tokens = out;
}

export function markdownParser(schema: Schema): MarkdownParser {
  // html: true only so comments are recognised as such; neutralizeHtml makes
  // sure nothing is ever rendered as HTML.
  const tokenizer = new MarkdownIt('commonmark', { html: true }).enable('strikethrough');
  tokenizer.core.ruler.push('glossly_neutralize_html', neutralizeHtml);
  tokenizer.core.ruler.push('glossly_hoist_images', hoistImages);
  return new MarkdownParser(schema, tokenizer, {
    blockquote: tokenSpec.blockquote,
    paragraph: tokenSpec.paragraph,
    heading: tokenSpec.heading,
    list_item: { block: 'listItem' },
    bullet_list: { block: 'bulletList' },
    ordered_list: { block: 'orderedList', getAttrs: (tok) => ({ start: Number(tok.attrGet('start')) || 1 }) },
    code_block: { block: 'codeBlock', noCloseToken: true },
    fence: { block: 'codeBlock', getAttrs: (tok) => ({ language: tok.info.trim() || null }), noCloseToken: true },
    hr: { node: 'horizontalRule' },
    image: tokenSpec.image,
    hardbreak: { node: 'hardBreak' },
    em: { mark: 'italic' },
    strong: { mark: 'bold' },
    s: { mark: 'strike' },
    link: tokenSpec.link,
    code_inline: { mark: 'code', noCloseToken: true }
  });
}

type JSONNode = { type: string; attrs?: Record<string, unknown>; content?: JSONNode[]; text?: string };

const TASK_PREFIX = /^\[( |x|X)\] /;

/**
 * markdown-it's CommonMark preset has no task lists, so `- [ ] x` arrives as a
 * bullet item whose text starts with "[ ] ". Turn a bullet list into a task
 * list when every item has that prefix.
 */
function liftTaskLists(node: JSONNode): JSONNode {
  const content = node.content?.map(liftTaskLists);
  if (node.type === 'bulletList' && content?.length && content.every(isTaskItem)) {
    return { type: 'taskList', content: content.map(toTaskItem) };
  }
  return content ? { ...node, content } : node;
}

function firstText(item: JSONNode): JSONNode | undefined {
  const para = item.content?.[0];
  return para?.type === 'paragraph' ? para.content?.[0] : undefined;
}

function isTaskItem(item: JSONNode): boolean {
  const text = firstText(item);
  return item.type === 'listItem' && text?.type === 'text' && TASK_PREFIX.test(text.text ?? '');
}

function toTaskItem(item: JSONNode): JSONNode {
  const [para, ...rest] = item.content!;
  const [first, ...inline] = para.content!;
  const checked = TASK_PREFIX.exec(first.text!)![1].toLowerCase() === 'x';
  const remaining = first.text!.replace(TASK_PREFIX, '');
  const paraContent = remaining ? [{ ...first, text: remaining }, ...inline] : inline;
  return {
    type: 'taskItem',
    attrs: { checked },
    content: [{ ...para, content: paraContent.length ? paraContent : undefined }, ...rest]
  };
}

export function fromMarkdown(text: string, schema: Schema): PMNode {
  const parsed = markdownParser(schema).parse(text);
  return schema.nodeFromJSON(liftTaskLists(parsed.toJSON()));
}
