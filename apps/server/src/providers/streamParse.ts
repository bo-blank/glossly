export interface StreamParseResult {
  suggestions: string[];
  complete: boolean;
}

const EMPTY: StreamParseResult = { suggestions: [], complete: false };

/** JSON-unescapes a completed string literal's raw contents (no surrounding quotes). */
function unescapeJsonString(raw: string): string {
  let out = '';
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (ch !== '\\') {
      out += ch;
      continue;
    }
    const next = raw[++i];
    switch (next) {
      case '"':
        out += '"';
        break;
      case '\\':
        out += '\\';
        break;
      case '/':
        out += '/';
        break;
      case 'n':
        out += '\n';
        break;
      case 't':
        out += '\t';
        break;
      case 'r':
        out += '\r';
        break;
      case 'b':
        out += '\b';
        break;
      case 'f':
        out += '\f';
        break;
      case 'u':
        out += String.fromCharCode(parseInt(raw.slice(i + 1, i + 5), 16));
        i += 4;
        break;
      default:
        out += next ?? '';
    }
  }
  return out;
}

/**
 * Scans a top-level JSON string array's worth of string literals out of `buffer`,
 * which is the model output so far — eventually `{"suggestions": ["a", "b", "c"]}`,
 * possibly fenced or preceded by a `<think>` block. Handles partial/incomplete input:
 * only fully-closed string literals are returned, and `complete` reflects whether the
 * closing `]` of the array has been seen.
 */
export function extractSuggestions(buffer: string): StreamParseResult {
  let text = buffer;

  const thinkOpen = text.indexOf('<think>');
  if (thinkOpen !== -1) {
    const thinkClose = text.indexOf('</think>', thinkOpen);
    if (thinkClose === -1) return EMPTY;
    text = text.slice(thinkClose + '</think>'.length);
  }

  const fenceMatch = text.match(/```(?:json)?\s*/i);
  if (fenceMatch) {
    text = text.slice(fenceMatch.index! + fenceMatch[0].length);
  }

  const arrayStart = text.indexOf('[');
  if (arrayStart === -1) return EMPTY;

  const suggestions: string[] = [];
  let i = arrayStart + 1;
  let complete = false;

  while (i < text.length) {
    const ch = text[i];
    if (ch === ']') {
      complete = true;
      break;
    }
    if (ch !== '"') {
      i++;
      continue;
    }

    // Scan a string literal, honoring escapes, to find its closing quote.
    let j = i + 1;
    let closed = false;
    let raw = '';
    while (j < text.length) {
      const c = text[j];
      if (c === '\\') {
        const escaped = text[j + 1];
        if (escaped === undefined) {
          // Escape sequence cut off mid-chunk — incomplete literal.
          break;
        }
        if (escaped === 'u') {
          const hex = text.slice(j + 2, j + 6);
          if (hex.length < 4) break; // \uXXXX cut off mid-chunk
          raw += '\\u' + hex;
          j += 6;
          continue;
        }
        raw += '\\' + escaped;
        j += 2;
        continue;
      }
      if (c === '"') {
        closed = true;
        break;
      }
      raw += c;
      j++;
    }

    if (!closed) break; // literal not fully arrived yet

    suggestions.push(unescapeJsonString(raw));
    i = j + 1;
  }

  return { suggestions, complete };
}
