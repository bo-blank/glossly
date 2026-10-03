import type { Node as PMNode } from 'prosemirror-model';
import type { AddressForm, SuggestionContext } from '@glossly/shared';

const DU_FORMS = /\b(?:du|dich|dir|dein(?:e[mnrs]?)?|euch|euer|eure[mnrs]?)\b/gi;
// Capitalized only: lowercase "sie"/"ihnen" is she/they/them.
const SIE_FORMS = /\b(?:Sie|Ihnen|Ihre?[mnrs]?)\b/g;
// Sentence-initial "Sie"/"Ihr" may mean she/they/her, so only mid-sentence capitals count.
const SENTENCE_START = /(?:^|[\n.!?:„“"»«‚‘])\s*$/;
// A document mixing both (dialogue in a novel) gets no hint at all.
const DOCUMENT_DOMINANCE = 3;

function countAddress(text: string): { du: number; sie: number } {
  const du = text.match(DU_FORMS)?.length ?? 0;
  let sie = 0;
  for (const m of text.matchAll(SIE_FORMS)) {
    if (!SENTENCE_START.test(text.slice(Math.max(0, m.index - 4), m.index))) sie++;
  }
  return { du, sie };
}

const documentAddress = new WeakMap<PMNode, AddressForm | undefined>();

/**
 * A 2.6B model does not reliably infer "du" or "Sie" from thousands of
 * characters of context (Phase 3 WP1 bench), so it is stated outright. The
 * selection's own block decides when it uses either form at all — in a novel,
 * different characters address each other differently. Otherwise the whole
 * document decides, but only when one form clearly dominates.
 */
export function detectAddress(doc: PMNode, ownText: string): AddressForm | undefined {
  const own = countAddress(ownText);
  if (own.du && !own.sie) return 'du';
  if (own.sie && !own.du) return 'Sie';
  if (own.du || own.sie) return undefined;

  // Documents are immutable: the count only changes with an edit.
  if (!documentAddress.has(doc)) {
    const { du, sie } = countAddress(doc.textBetween(0, doc.content.size, '\n', ' '));
    let form: AddressForm | undefined;
    if (du >= 2 && du >= DOCUMENT_DOMINANCE * sie) form = 'du';
    else if (sie >= 2 && sie >= DOCUMENT_DOMINANCE * du) form = 'Sie';
    documentAddress.set(doc, form);
  }
  return documentAddress.get(doc);
}

export const CONTEXT_BUDGET = 4000;
// The selection's own block is the most relevant text, but must not crowd out
// every neighbour when it is a very long paragraph.
const OWN_BLOCK_SHARE = 0.6;
const BLOCK_SEPARATOR = '\n\n';
const ELLIPSIS = '…';

/** The last `max` characters, starting at a word boundary. */
function tail(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(text.length - max + ELLIPSIS.length);
  const space = cut.search(/\s/);
  return ELLIPSIS + (space >= 0 ? cut.slice(space + 1) : '');
}

/** The first `max` characters, ending at a word boundary. */
function head(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - ELLIPSIS.length);
  const space = Math.max(cut.lastIndexOf(' '), cut.lastIndexOf('\n'));
  return (space >= 0 ? cut.slice(0, space) : '') + ELLIPSIS;
}

/** Splits `budget` between two texts, giving what one side does not need to the other. */
function share(a: number, b: number, budget: number): [number, number] {
  const half = Math.floor(budget / 2);
  if (a <= half) return [a, budget - a];
  if (b <= half) return [budget - b, b];
  return [half, budget - half];
}

function blockText(node: PMNode): string {
  // textBetween keeps list items and table cells apart; textContent runs them together.
  return node.textBetween(0, node.content.size, '\n', ' ').trim();
}

/**
 * What the model sees around a selection: the document title, the enclosing
 * headings, and neighbouring blocks filled nearest-first — alternating before
 * and after — until the next block no longer fits `budget` characters.
 * Blocks are kept whole so the passage stays contiguous; only the selection's
 * own block is trimmed, around the selection, at word boundaries.
 */
export function extractContext(doc: PMNode, from: number, to: number, title: string, budget = CONTEXT_BUDGET): SuggestionContext {
  const blocks: { node: PMNode; pos: number }[] = [];
  doc.forEach((node, pos) => blocks.push({ node, pos }));
  if (blocks.length === 0) return { title, headingPath: [], before: '', after: '' };

  // index(0) is the top-level block containing the position — a list item or
  // quote belongs to its outermost list or blockquote.
  const first = Math.min(doc.resolve(from).index(0), blocks.length - 1);
  const last = Math.max(first, Math.min(doc.resolve(to).index(0), blocks.length - 1));

  // Headings enclosing the selection, outermost first. A heading pops every
  // heading of the same or a deeper level.
  const path: { level: number; text: string; index: number }[] = [];
  for (let i = 0; i < first; i++) {
    const { node } = blocks[i];
    if (node.type.name !== 'heading') continue;
    const text = blockText(node);
    if (!text) continue;
    while (path.length && path[path.length - 1].level >= node.attrs.level) path.pop();
    path.push({ level: node.attrs.level, text, index: i });
  }
  // The title is usually derived from the first heading; don't say it twice.
  if (path.length && path[0].text === title) path.shift();
  const headingPath = path.map((h) => h.text);
  const inPath = new Set(path.map((h) => h.index));

  let remaining = budget - title.length - headingPath.reduce((n, h) => n + h.length, 0);

  const ownStart = blocks[first].pos;
  const ownEnd = blocks[last].pos + blocks[last].node.nodeSize;
  const rawBefore = doc.textBetween(ownStart, from, '\n', ' ').replace(/^\s+/, '');
  const rawAfter = doc.textBetween(to, ownEnd, '\n', ' ').replace(/\s+$/, '');
  const address = detectAddress(doc, doc.textBetween(ownStart, ownEnd, '\n', ' '));
  const ownBudget = Math.max(0, Math.floor(remaining * OWN_BLOCK_SHARE));
  const [beforeMax, afterMax] = share(rawBefore.length, rawAfter.length, ownBudget);
  const ownBefore = tail(rawBefore, beforeMax);
  const ownAfter = head(rawAfter, afterMax);
  remaining -= ownBefore.length + ownAfter.length;

  const beforeBlocks: string[] = [];
  const afterBlocks: string[] = [];
  let i = first - 1;
  let j = last + 1;
  let beforeOpen = true;
  let afterOpen = true;
  const nextBefore = () => {
    while (i >= 0 && (inPath.has(i) || !blockText(blocks[i].node))) i--;
    return i >= 0 ? blockText(blocks[i].node) : null;
  };
  const nextAfter = () => {
    while (j < blocks.length && !blockText(blocks[j].node)) j++;
    return j < blocks.length ? blockText(blocks[j].node) : null;
  };
  while (beforeOpen || afterOpen) {
    if (beforeOpen) {
      const text = nextBefore();
      const cost = (text?.length ?? 0) + BLOCK_SEPARATOR.length;
      if (text === null || cost > remaining) beforeOpen = false;
      else {
        beforeBlocks.push(text);
        remaining -= cost;
        i--;
      }
    }
    if (afterOpen) {
      const text = nextAfter();
      const cost = (text?.length ?? 0) + BLOCK_SEPARATOR.length;
      if (text === null || cost > remaining) afterOpen = false;
      else {
        afterBlocks.push(text);
        remaining -= cost;
        j++;
      }
    }
  }

  // An empty own part still gets its separator: the selection then starts a new block.
  const before = [...beforeBlocks.reverse(), ownBefore].join(BLOCK_SEPARATOR);
  const after = [ownAfter, ...afterBlocks].join(BLOCK_SEPARATOR);
  return { title, headingPath, before, after, ...(address && { address }) };
}
