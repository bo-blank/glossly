const WORD_CHAR = /[\p{L}\p{N}'’-]/u;
const TRAILING_PUNCT = /[.,!?;:'’"”)\]}…]/u;

function charAt(doc: any, pos: number): string {
  if (pos < 0 || pos >= doc.content.size) return '';
  return doc.textBetween(pos, pos + 1, '￼', '￼');
}

function isWordChar(ch: string): boolean {
  return ch !== '' && WORD_CHAR.test(ch);
}

function isTrailingPunct(ch: string): boolean {
  return ch !== '' && TRAILING_PUNCT.test(ch);
}

/**
 * Expands [from, to) outward so it never starts or ends mid-word. For multi-word
 * selections, also absorbs punctuation sitting directly against the end (e.g. selecting
 * "walked quickly" in "walked quickly." picks up the period too) — single-word selections
 * are left as just the word, since a lone word plus its trailing punctuation changes what's
 * actually being asked for a replacement.
 */
export function snapToWordBoundaries(doc: any, from: number, to: number): { from: number; to: number } {
  let start = from;
  while (start > 0 && isWordChar(charAt(doc, start - 1)) && isWordChar(charAt(doc, start))) {
    start--;
  }

  let end = to;
  while (end < doc.content.size && isWordChar(charAt(doc, end - 1)) && isWordChar(charAt(doc, end))) {
    end++;
  }

  const isMultiWord = /\s/.test(doc.textBetween(start, end, '\n', '\n'));
  if (isMultiWord) {
    while (end < doc.content.size && isTrailingPunct(charAt(doc, end))) {
      end++;
    }
  }

  return { from: start, to: end };
}
