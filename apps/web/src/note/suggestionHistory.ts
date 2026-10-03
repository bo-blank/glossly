// Every suggestion shown this session, per selected phrase. Module memory only —
// never persisted, not even to IndexedDB: a writer's rejected phrasings are not
// something to leave on disk. A reload clears it.

const PER_PHRASE = 30;
const PHRASES = 200;

export interface HistoryEntry {
  text: string;
  /** The chip or action that produced it, e.g. "Tighter" or "New suggestions". */
  label: string;
}

const history = new Map<string, HistoryEntry[]>();

/**
 * Newest round first, each round in the model's own order. A suggestion shown
 * again moves up with its newest round and label.
 */
export function record(phrase: string, suggestions: string[], label: string): void {
  const key = phrase.trim();
  const fresh = suggestions.map((text) => ({ text, label }));
  const entries = [...fresh, ...(history.get(key) ?? [])]
    .filter((e, i, all) => all.findIndex((other) => other.text === e.text) === i)
    .slice(0, PER_PHRASE);
  // Re-insert to refresh recency (Map iteration order is insertion order).
  history.delete(key);
  history.set(key, entries);
  if (history.size > PHRASES) {
    const oldest = history.keys().next().value;
    if (oldest !== undefined) history.delete(oldest);
  }
}

export function forPhrase(phrase: string): HistoryEntry[] {
  return history.get(phrase.trim()) ?? [];
}

export function clear(): void {
  history.clear();
}
