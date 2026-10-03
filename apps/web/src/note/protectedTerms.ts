import { countWord as occurrences, MAX_PROTECTED_TERM_CHARS, MAX_PROTECTED_TERMS } from '@glossly/shared';

/** The protected words that occur in the selection — the only ones the model needs to hear about. */
export function termsInSelection(terms: readonly string[], selection: string): string[] {
  return terms.filter((t) => occurrences(t, selection) > 0);
}

/**
 * Protected words a suggestion lost: fewer occurrences than in the selection.
 * Counting, not just finding, keeps a deliberate repetition protected too.
 */
export function droppedTerms(terms: readonly string[], selection: string, suggestion: string): string[] {
  return terms.filter((t) => occurrences(t, suggestion) < occurrences(t, selection));
}

/**
 * A selection the "Protect" chip offers to protect: a name or term of one or
 * two words ("Anna", "Frau Weber"). Longer ones go through the menu — a chip
 * on every three-word phrase would be noise.
 */
export function isProtectable(selection: string): boolean {
  const term = selection.trim();
  return term.length > 0 && term.length <= MAX_PROTECTED_TERM_CHARS && !/[.!?;:,\n]/.test(term) && term.split(/\s+/).length <= 2;
}

/** The list with `term` added: trimmed, no duplicates, oldest dropped past the cap. */
export function withTerm(terms: readonly string[], term: string): string[] {
  const t = term.trim().slice(0, MAX_PROTECTED_TERM_CHARS);
  if (!t || terms.includes(t)) return [...terms];
  return [...terms, t].slice(-MAX_PROTECTED_TERMS);
}

export function withoutTerm(terms: readonly string[], term: string): string[] {
  return terms.filter((t) => t !== term.trim());
}
