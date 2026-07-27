import { describe, expect, it } from 'vitest';
import { extractSuggestions } from './streamParse';

describe('extractSuggestions', () => {
  it('extracts nothing from an empty or pre-array buffer', () => {
    expect(extractSuggestions('')).toEqual({ suggestions: [], complete: false });
    expect(extractSuggestions('{"suggestions": ')).toEqual({ suggestions: [], complete: false });
  });

  it('extracts completed strings and flags completion on the closing bracket', () => {
    const buffer = '{"suggestions": ["first", "second", "third"]}';
    expect(extractSuggestions(buffer)).toEqual({
      suggestions: ['first', 'second', 'third'],
      complete: true
    });
  });

  it('returns only fully-arrived strings while the buffer is still incomplete', () => {
    const buffer = '{"suggestions": ["first", "second", "thi';
    expect(extractSuggestions(buffer)).toEqual({
      suggestions: ['first', 'second'],
      complete: false
    });
  });

  it('does not complete on a bracket inside a string', () => {
    const buffer = '{"suggestions": ["a bracket like ] this", "second"';
    const result = extractSuggestions(buffer);
    expect(result.suggestions).toEqual(['a bracket like ] this', 'second']);
    expect(result.complete).toBe(false);
  });

  it('handles chunk boundaries mid-escape sequence', () => {
    // Buffer cut right after the backslash of an escaped quote.
    const buffer = '{"suggestions": ["she said \\';
    expect(extractSuggestions(buffer)).toEqual({ suggestions: [], complete: false });
  });

  it('handles chunk boundaries mid-\\u sequence', () => {
    const buffer = '{"suggestions": ["caf\\u00';
    expect(extractSuggestions(buffer)).toEqual({ suggestions: [], complete: false });
  });

  it('unescapes \\", \\\\, \\n and \\uXXXX correctly once complete', () => {
    const buffer = '{"suggestions": ["she said \\"hi\\\\bye\\" then\\nleft", "caf\\u00e9"]}';
    expect(extractSuggestions(buffer)).toEqual({
      suggestions: ['she said "hi\\bye" then\nleft', 'café'],
      complete: true
    });
  });

  it('handles chunk boundaries between a completed string and the next comma/quote', () => {
    const a = '{"suggestions": ["first"';
    const b = a + ', "second"]}';
    expect(extractSuggestions(a)).toEqual({ suggestions: ['first'], complete: false });
    expect(extractSuggestions(b)).toEqual({ suggestions: ['first', 'second'], complete: true });
  });

  it('strips a leading <think> block', () => {
    const buffer = '<think>reasoning about the task</think>{"suggestions": ["a", "b", "c"]}';
    expect(extractSuggestions(buffer)).toEqual({ suggestions: ['a', 'b', 'c'], complete: true });
  });

  it('returns empty/incomplete while inside an unclosed <think> block', () => {
    const buffer = '<think>still reasoning, no suggestions yet';
    expect(extractSuggestions(buffer)).toEqual({ suggestions: [], complete: false });
  });

  it('strips an opening json code fence', () => {
    const buffer = '```json\n{"suggestions": ["a", "b", "c"]}\n```';
    expect(extractSuggestions(buffer)).toEqual({ suggestions: ['a', 'b', 'c'], complete: true });
  });

  it('strips a bare opening code fence', () => {
    const buffer = '```\n{"suggestions": ["a", "b"]}';
    expect(extractSuggestions(buffer).suggestions).toEqual(['a', 'b']);
  });

  it('handles a buffer that never completes', () => {
    const buffer = '{"suggestions": ["only one so far"';
    expect(extractSuggestions(buffer)).toEqual({ suggestions: ['only one so far'], complete: false });
  });

  it('handles a plain top-level array without the suggestions wrapper', () => {
    const buffer = '["a", "b", "c"]';
    expect(extractSuggestions(buffer)).toEqual({ suggestions: ['a', 'b', 'c'], complete: true });
  });
});
