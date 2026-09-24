// Story 6.1: until the writer has seen their first suggestion, the empty-editor
// placeholder doubles as the one-line hint for Glossly's core gesture. Once a
// suggestion has arrived, the hint retires for good and the placeholder goes
// back to a plain prompt.

export const HINT_SEEN_KEY = 'glossly-hint-seen';

export const HINT_PLACEHOLDER = 'Start writing, then select a word or phrase to see alternatives in the margin.';
export const PLAIN_PLACEHOLDER = 'Start writing…';

export function placeholderFor(hintSeen: boolean): string {
  return hintSeen ? PLAIN_PLACEHOLDER : HINT_PLACEHOLDER;
}

// Storage can be unavailable (private mode, blocked site data). Failing to read
// shows the hint once more; failing to write only means it shows again next
// session. Neither is worth surfacing to the writer.
export function loadHintSeen(storage: Pick<Storage, 'getItem'> | undefined = globalThis.localStorage): boolean {
  try {
    return storage?.getItem(HINT_SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

export function saveHintSeen(storage: Pick<Storage, 'setItem'> | undefined = globalThis.localStorage): void {
  try {
    storage?.setItem(HINT_SEEN_KEY, '1');
  } catch {
    // see loadHintSeen
  }
}
