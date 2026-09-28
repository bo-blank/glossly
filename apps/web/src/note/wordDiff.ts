export type SegmentKind = 'same' | 'added' | 'removed';

export interface Segment {
  text: string;
  kind: SegmentKind;
}

export interface WordDiff {
  /** The original: `same` and `removed` segments. */
  original: Segment[];
  /** The suggestion: `same` and `added` segments. */
  suggestion: Segment[];
}

// Words (letters and digits, with inner apostrophes or hyphens) and everything
// between them. Keeping the separators as tokens means joining the segments
// reproduces each text exactly.
const TOKEN = /[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*|[^\p{L}\p{N}]+/gu;

function tokenize(text: string): string[] {
  return text.match(TOKEN) ?? [];
}

// Matching a word must outweigh matching any number of the spaces around it,
// or the LCS happily pairs up two spaces and gives up the word between them.
const WORD_WEIGHT = 1000;
const isWord = (token: string) => /[\p{L}\p{N}]/u.test(token);

function push(segments: Segment[], text: string, kind: SegmentKind) {
  const last = segments[segments.length - 1];
  if (last?.kind === kind) last.text += text;
  else segments.push({ text, kind });
}

// Highlights cover words, not the spaces around them: a space kept between two
// changed words is folded into the change (one phrase, not single words), and
// spaces at the edges of a change go back to the unchanged text.
function tidy(segments: Segment[]): Segment[] {
  const bridged: Segment[] = [];
  segments.forEach((s, i) => {
    const prev = segments[i - 1];
    const next = segments[i + 1];
    const bridge = s.kind === 'same' && /^\s+$/.test(s.text) && prev && next && prev.kind !== 'same' && prev.kind === next.kind;
    push(bridged, s.text, bridge ? prev.kind : s.kind);
  });
  const out: Segment[] = [];
  for (const s of bridged) {
    if (s.kind === 'same') {
      push(out, s.text, 'same');
      continue;
    }
    const [, lead, core, trail] = s.text.match(/^(\s*)([\s\S]*?)(\s*)$/)!;
    if (lead) push(out, lead, 'same');
    if (core) push(out, core, s.kind);
    if (trail) push(out, trail, 'same');
  }
  return out;
}

/**
 * Word-level diff between a selection and a suggestion, case-sensitive.
 * Selections are at most 600 characters, so a plain O(n·m) LCS is fine.
 * Words dominate the alignment; spaces and punctuation only break ties.
 */
export function diffWords(original: string, suggestion: string): WordDiff {
  const a = tokenize(original);
  const b = tokenize(suggestion);
  // lcs[i][j] = weight of the best common subsequence of a[i..] and b[j..]
  const lcs = Array.from({ length: a.length + 1 }, () => new Uint32Array(b.length + 1));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      const skip = Math.max(lcs[i + 1][j], lcs[i][j + 1]);
      lcs[i][j] = a[i] === b[j] ? Math.max(skip, lcs[i + 1][j + 1] + (isWord(a[i]) ? WORD_WEIGHT : 1)) : skip;
    }
  }

  const left: Segment[] = [];
  const right: Segment[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j] && lcs[i][j] === lcs[i + 1][j + 1] + (isWord(a[i]) ? WORD_WEIGHT : 1)) {
      push(left, a[i++], 'same');
      push(right, b[j++], 'same');
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      push(left, a[i++], 'removed');
    } else {
      push(right, b[j++], 'added');
    }
  }
  while (i < a.length) push(left, a[i++], 'removed');
  while (j < b.length) push(right, b[j++], 'added');
  return { original: tidy(left), suggestion: tidy(right) };
}
