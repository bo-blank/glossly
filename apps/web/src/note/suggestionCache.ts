const CAPACITY = 100;

const cache = new Map<string, string[]>();

export interface CacheKeyParts {
  selectedText: string;
  context: string;
  modifier?: string;
  modifierInstruction?: string;
  mode?: string;
  model: string;
  endpointUrl: string;
}

export function cacheKey({ selectedText, context, modifier, modifierInstruction, mode, model, endpointUrl }: CacheKeyParts): string {
  return JSON.stringify([selectedText, context, modifier ?? '', modifierInstruction ?? '', mode ?? '', model, endpointUrl]);
}

export function get(key: string): string[] | undefined {
  const hit = cache.get(key);
  if (hit === undefined) return undefined;
  // Re-insert to refresh recency (Map iteration order is insertion order).
  cache.delete(key);
  cache.set(key, hit);
  return hit;
}

export function set(key: string, suggestions: string[]): void {
  cache.delete(key);
  cache.set(key, suggestions);
  if (cache.size > CAPACITY) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
}

export function clear(): void {
  cache.clear();
}
