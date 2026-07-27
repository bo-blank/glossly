import { get } from 'svelte/store';
import { noteStore, editorStore } from '../stores/noteStore';
import { settingsStore } from '../stores/settingsStore';
import { fetchSuggestionsStream, SuggestRequestError } from '../providers/client';
import { snapToWordBoundaries } from './wordBoundary';
import { cacheKey, get as cacheGet, set as cacheSet } from './suggestionCache';

const DEBOUNCE_MS = 200;

export interface SelectionInfo {
  selectedText: string;
  context: string;
  from: number;
  to: number;
  screenPos: { left: number; bottom: number } | null;
}

let debounceTimer: ReturnType<typeof setTimeout> | undefined;
let activeController: AbortController | undefined;
let lastRequestKey: string | undefined;
let latestSelection: SelectionInfo | null = null;
// Everything shown for the current selection so far, so "New suggestions" can
// tell the model what not to repeat. Reset whenever the selection changes.
let seenSuggestions: string[] = [];

const MIN_LENGTH = 3;
const MAX_LENGTH = 220;

/** Called on every Tiptap selectionUpdate. Debounces, and hides the note for empty/too-short selections. */
export function onSelectionChange(info: SelectionInfo | null) {
  clearTimeout(debounceTimer);
  latestSelection = info;
  seenSuggestions = [];

  if (!info || info.selectedText.length < MIN_LENGTH) {
    activeController?.abort();
    lastRequestKey = undefined;
    noteStore.set({ visible: false, loading: false, suggestions: [], error: null, position: null });
    return;
  }

  if (info.selectedText.length > MAX_LENGTH) {
    activeController?.abort();
    lastRequestKey = undefined;
    noteStore.set({
      visible: true,
      loading: false,
      suggestions: [],
      error: `That's ${info.selectedText.length} characters — select a shorter phrase (up to ${MAX_LENGTH}).`,
      position: info.screenPos ? { x: info.screenPos.left, y: info.screenPos.bottom } : null
    });
    return;
  }

  debounceTimer = setTimeout(() => {
    void runRequest(info, undefined);
  }, DEBOUNCE_MS);
}

/** Called from a modifier chip click — reuses the current selection, no debounce, no re-select needed. */
export function requestWithModifier(modifier: string, instruction?: string) {
  if (!latestSelection) return;
  clearTimeout(debounceTimer);
  void runRequest(latestSelection, modifier, instruction);
}

async function runRequest(info: SelectionInfo, modifier: string | undefined, modifierInstruction?: string) {
  // Snap to whole-word boundaries once the selection has settled (never mid-drag, so it
  // can't fight the browser's native selection-extension gesture), then visually reflect
  // the correction so what's sent/replaced matches what's highlighted.
  const ed = get(editorStore).editor;
  if (ed) {
    const { from, to } = snapToWordBoundaries(ed.state.doc, info.from, info.to);
    if (from !== info.from || to !== info.to) {
      ed.commands.setTextSelection({ from, to });
      info = { ...info, from, to, selectedText: ed.state.doc.textBetween(from, to, '\n') };
    }
  }

  const key = `${info.from}:${info.to}:${info.selectedText}:${modifier ?? ''}:${modifierInstruction ?? ''}`;
  // "New suggestions" (more) is exempt from dedupe — repeating it for the same
  // selection is exactly its purpose, and each round sends the accumulated
  // previous suggestions so the model doesn't circle back to earlier wording.
  if (modifier !== 'more' && key === lastRequestKey) return;
  lastRequestKey = key;

  const previousSuggestions = modifier === 'more' && seenSuggestions.length ? [...seenSuggestions] : undefined;

  const settings = get(settingsStore);
  // "New suggestions" is exempt from caching too — its whole purpose is fresh output.
  const cKey =
    modifier !== 'more'
      ? cacheKey({
          selectedText: info.selectedText,
          context: info.context,
          modifier,
          modifierInstruction,
          model: settings.model,
          endpointUrl: settings.endpointUrl
        })
      : undefined;

  if (cKey) {
    const cached = cacheGet(cKey);
    if (cached) {
      activeController?.abort();
      activeController = undefined;
      seenSuggestions.push(...cached.filter((s) => !seenSuggestions.includes(s)));
      noteStore.set({
        visible: true,
        loading: false,
        suggestions: cached,
        error: null,
        position: info.screenPos ? { x: info.screenPos.left, y: info.screenPos.bottom } : null
      });
      return;
    }
  }

  activeController?.abort();
  const controller = new AbortController();
  activeController = controller;

  noteStore.set({
    visible: true,
    loading: true,
    suggestions: [],
    error: null,
    position: info.screenPos ? { x: info.screenPos.left, y: info.screenPos.bottom } : null
  });

  try {
    const suggestions = await fetchSuggestionsStream({
      settings,
      selectedText: info.selectedText,
      context: info.context,
      modifier,
      modifierInstruction,
      previousSuggestions,
      signal: controller.signal,
      onSuggestion: (_index, text) => {
        if (controller.signal.aborted) return;
        noteStore.update((n) => ({ ...n, suggestions: [...n.suggestions, text] }));
      }
    });

    if (controller.signal.aborted) return;
    seenSuggestions.push(...suggestions.filter((s) => !seenSuggestions.includes(s)));
    if (cKey) cacheSet(cKey, suggestions);
    noteStore.update((n) => ({ ...n, loading: false, suggestions, error: null }));
  } catch (err) {
    if (controller.signal.aborted) return; // superseded by a newer selection — discard silently
    const message = err instanceof SuggestRequestError ? err.message : 'Could not reach the model — try again.';
    noteStore.update((n) => ({ ...n, loading: false, error: message }));
  }
}

export function dismiss() {
  clearTimeout(debounceTimer);
  activeController?.abort();
  lastRequestKey = undefined;
  noteStore.update((n) => ({ ...n, visible: false }));
}
