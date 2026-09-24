import { describe, expect, it } from 'vitest';
import { HINT_PLACEHOLDER, HINT_SEEN_KEY, PLAIN_PLACEHOLDER, loadHintSeen, placeholderFor, saveHintSeen } from './firstRunHint';

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v)
  };
}

const throwing = {
  getItem: () => {
    throw new Error('blocked');
  },
  setItem: () => {
    throw new Error('blocked');
  }
};

describe('firstRunHint', () => {
  it('shows the hint until it has been seen', () => {
    expect(placeholderFor(false)).toBe(HINT_PLACEHOLDER);
    expect(placeholderFor(true)).toBe(PLAIN_PLACEHOLDER);
  });

  it('remembers that the hint was seen', () => {
    const storage = memoryStorage();
    expect(loadHintSeen(storage)).toBe(false);
    saveHintSeen(storage);
    expect(storage.getItem(HINT_SEEN_KEY)).toBe('1');
    expect(loadHintSeen(storage)).toBe(true);
  });

  it('treats unavailable storage as "not seen" without throwing', () => {
    expect(loadHintSeen(throwing)).toBe(false);
    expect(() => saveHintSeen(throwing)).not.toThrow();
    expect(loadHintSeen(undefined)).toBe(false);
  });
});
