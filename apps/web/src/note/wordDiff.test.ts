import { describe, expect, it } from 'vitest';
import { diffWords, type Segment } from './wordDiff';

const join = (segments: Segment[]) => segments.map((s) => s.text).join('');
const kinds = (segments: Segment[], kind: Segment['kind']) => segments.filter((s) => s.kind === kind).map((s) => s.text);

describe('diffWords', () => {
  it('marks nothing when the texts are identical', () => {
    const d = diffWords('Der Zug hielt.', 'Der Zug hielt.');
    expect(d.original).toEqual([{ text: 'Der Zug hielt.', kind: 'same' }]);
    expect(d.suggestion).toEqual([{ text: 'Der Zug hielt.', kind: 'same' }]);
  });

  it('finds a pure insertion', () => {
    const d = diffWords('Der Zug hielt.', 'Der alte Zug hielt.');
    expect(kinds(d.suggestion, 'added')).toEqual(['alte']);
    expect(kinds(d.original, 'removed')).toEqual([]);
  });

  it('finds a pure deletion', () => {
    const d = diffWords('in the event that it rains', 'if it rains');
    expect(kinds(d.original, 'removed').join('')).toContain('the event that');
    expect(kinds(d.suggestion, 'added')).toEqual(['if']);
  });

  it('finds a substitution in the middle', () => {
    const d = diffWords('Sie stieg langsam aus', 'Sie stieg zögernd aus');
    expect(kinds(d.original, 'removed')).toEqual(['langsam']);
    expect(kinds(d.suggestion, 'added')).toEqual(['zögernd']);
  });

  it('keeps a highlighted phrase in one piece', () => {
    const d = diffWords('The furniture was never the point', 'The desk itself was irrelevant');
    expect(kinds(d.suggestion, 'added')).toEqual(['desk itself', 'irrelevant']);
    expect(kinds(d.original, 'removed')).toEqual(['furniture', 'never the point']);
  });

  it('treats punctuation as its own token', () => {
    const d = diffWords('das Haus,', 'das Haus.');
    expect(kinds(d.original, 'removed')).toEqual([',']);
    expect(kinds(d.suggestion, 'added')).toEqual(['.']);
  });

  it('handles umlauts, ß and inner hyphens as parts of words', () => {
    const d = diffWords('Grüße aus der Straße', 'Grüße vom E-Mail-Team');
    expect(kinds(d.suggestion, 'same')[0]).toBe('Grüße ');
    expect(kinds(d.suggestion, 'added').join('')).toContain('E-Mail-Team');
    expect(kinds(d.original, 'removed').join('')).toContain('Straße');
  });

  it('is case-sensitive', () => {
    expect(kinds(diffWords('Das Haus', 'das Haus').suggestion, 'added')).toEqual(['das']);
  });

  it.each([
    ['in the event that it rains', 'should it rain'],
    ['Räume deinen Schreibtisch leer.', 'Leere bis Freitag deinen Tisch!'],
    ['', 'nur neu'],
    ['nur alt', ''],
    ['  Leerzeichen  am Rand ', 'Leerzeichen am Rand']
  ])('reproduces both texts exactly: %s → %s', (a, b) => {
    const d = diffWords(a, b);
    expect(join(d.original)).toBe(a);
    expect(join(d.suggestion)).toBe(b);
  });
});
