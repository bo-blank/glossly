import { get } from 'svelte/store';
import { noteStore, editorStore } from '../stores/noteStore';
import { settingsStore } from '../stores/settingsStore';
import { fetchSuggestionsStream, SuggestRequestError } from '../providers/client';
import { snapToWordBoundaries } from './wordBoundary';
import { expandToSentenceSelection } from './sentenceExpansion';
import { cacheKey, get as cacheGet, set as cacheSet } from './suggestionCache';
import { record, forPhrase } from './suggestionHistory';
import { termsInSelection } from './protectedTerms';
import { activeProtectedTerms } from '../storage/documentStore';
import { MAX_PHRASE_CHARS, MAX_SENTENCE_CHARS, MIN_SELECTION_CHARS, type SuggestionContext, type SuggestionMode } from '@glossly/shared';

const DEBOUNCE_MS = 200;

/**
 * The treatment plan's rewrites: an id the server does not know, so it uses
 * the instruction sent with it (one per finding, see utils/slop.ts).
 */
export const TREATMENT_MODIFIER = 'treatment';

export interface SelectionInfo {
  selectedText: string;
  context: SuggestionContext;
  from: number;
  to: number;
  screenPos: { left: number; bottom: number } | null;
}

let debounceTimer: ReturnType<typeof setTimeout> | undefined;
let activeController: AbortController | undefined;
let lastRequestKey: string | undefined;
let latestSelection: SelectionInfo | null = null;
// Set around every programmatic ed.commands.setTextSelection() call (word-boundary snap,
// sentence expansion). Tiptap's onSelectionUpdate fires for programmatic selection changes
// exactly like user-driven ones, so without this guard each snap/expand would re-enter
// onSelectionChange and schedule its own default-mode auto-request — a phantom request with
// a different mode/modifier than the one actually in flight, which dedupe can't catch since
// its key differs, and which would silently overwrite the real result a moment later.
let suppressSelectionSideEffects = false;

function setSelectionSilently(ed: any, from: number, to: number) {
  suppressSelectionSideEffects = true;
  try {
    ed.commands.setTextSelection({ from, to });
  } finally {
    suppressSelectionSideEffects = false;
  }
}

export const BUILT_IN_LABELS: Record<string, string> = {
  tighter: 'Tighter',
  vivid: 'More vivid',
  plain: 'Plainer',
  more: 'New suggestions',
  [TREATMENT_MODIFIER]: 'Treatment plan'
};

function historyLabel(modifier: string | undefined, mode: SuggestionMode): string {
  if (mode === 'sentence') return 'Rewrite sentence';
  if (!modifier) return 'Suggestions';
  return BUILT_IN_LABELS[modifier] ?? get(settingsStore).customModifiers.find((c) => c.id === modifier)?.label ?? 'Custom';
}


/** Called on every Tiptap selectionUpdate. Debounces, and hides the note for empty/too-short selections. */
export function onSelectionChange(info: SelectionInfo | null) {
  if (suppressSelectionSideEffects) {
    latestSelection = info;
    return;
  }

  clearTimeout(debounceTimer);
  latestSelection = info;

  if (!info || info.selectedText.length < MIN_SELECTION_CHARS) {
    activeController?.abort();
    lastRequestKey = undefined;
    noteStore.set({ visible: false, loading: false, suggestions: [], original: '', error: null, position: null, sentenceRewriteEligible: false });
    return;
  }

  if (info.selectedText.length > MAX_PHRASE_CHARS) {
    activeController?.abort();
    lastRequestKey = undefined;
    const sentenceEligible = info.selectedText.length <= MAX_SENTENCE_CHARS;
    noteStore.set({
      visible: true,
      loading: false,
      suggestions: [],
      original: info.selectedText,
      error: `That's ${info.selectedText.length} characters — select a shorter phrase (up to ${MAX_PHRASE_CHARS}).`,
      position: info.screenPos ? { x: info.screenPos.left, y: info.screenPos.bottom } : null,
      sentenceRewriteEligible: sentenceEligible
    });
    return;
  }

  debounceTimer = setTimeout(() => {
    void runRequest(info, undefined);
  }, DEBOUNCE_MS);
}

/**
 * Called from the treatment plan right after it selected a finding's sentence:
 * rewrites the current selection by the finding's instruction. A phrase up to
 * MAX_PHRASE_CHARS, a sentence up to MAX_SENTENCE_CHARS; longer, nothing.
 */
export function requestTreatment(instruction: string) {
  if (!latestSelection) return;
  const length = latestSelection.selectedText.length;
  const mode: SuggestionMode | null = length <= MAX_PHRASE_CHARS ? 'phrase' : length <= MAX_SENTENCE_CHARS ? 'sentence' : null;
  if (!mode) return;
  clearTimeout(debounceTimer);
  void runRequest(latestSelection, TREATMENT_MODIFIER, instruction, mode);
}

/** Called from a modifier chip click — reuses the current selection, no debounce, no re-select needed. */
export function requestWithModifier(modifier: string, instruction?: string) {
  if (!latestSelection) return;
  clearTimeout(debounceTimer);
  void runRequest(latestSelection, modifier, instruction);
}

/**
 * Called from the "Rewrite sentence" chip (normal 3-220 char selection) or the
 * "Rewrite as sentence(s)" button (221-600 char selection that's too long for phrase
 * mode). Expands the live selection to its enclosing sentence boundaries, reflects that
 * visually, then re-requests in sentence mode.
 */
export function requestSentenceRewrite() {
  if (!latestSelection) return;
  const ed = get(editorStore).editor;
  if (!ed) return;

  const expanded = expandToSentenceSelection(ed.state.doc, latestSelection.from, latestSelection.to);
  if (!expanded) return;

  clearTimeout(debounceTimer);
  setSelectionSilently(ed, expanded.from, expanded.to);
  const selectedText = ed.state.doc.textBetween(expanded.from, expanded.to, '\n');
  const info: SelectionInfo = { ...latestSelection, from: expanded.from, to: expanded.to, selectedText };
  latestSelection = info;

  void runRequest(info, undefined, undefined, 'sentence');
}

async function runRequest(info: SelectionInfo, modifier: string | undefined, modifierInstruction?: string, mode: SuggestionMode = 'phrase') {
  // Snap to whole-word boundaries once the selection has settled (never mid-drag, so it
  // can't fight the browser's native selection-extension gesture), then visually reflect
  // the correction so what's sent/replaced matches what's highlighted. Sentence mode already
  // arrives pre-snapped to sentence boundaries (which are word boundaries too), so skip this.
  if (mode !== 'sentence') {
    const ed = get(editorStore).editor;
    if (ed) {
      const { from, to } = snapToWordBoundaries(ed.state.doc, info.from, info.to);
      if (from !== info.from || to !== info.to) {
        setSelectionSilently(ed, from, to);
        info = { ...info, from, to, selectedText: ed.state.doc.textBetween(from, to, '\n') };
      }
    }
  }

  const settings = get(settingsStore);
  // "more" is an action, not a style — never tuned.
  const tuning = modifier && modifier !== 'more' ? settings.modifierTuning[modifier] : undefined;
  const instructionOverride = tuning?.instruction;
  const temperature = tuning?.temperature;

  // Only the ones in the selection: the suggestion replaces nothing else.
  const terms = termsInSelection(activeProtectedTerms(), info.selectedText);
  const protectedTerms = terms.length ? terms : undefined;

  const key = JSON.stringify([info.from, info.to, info.selectedText, modifier, modifierInstruction, instructionOverride, temperature, protectedTerms, mode]);
  // "New suggestions" (more) is exempt from dedupe — repeating it for the same
  // selection is exactly its purpose, and each round sends the accumulated
  // previous suggestions so the model doesn't circle back to earlier wording.
  if (modifier !== 'more' && key === lastRequestKey) return;
  lastRequestKey = key;

  // Everything shown for this phrase this session — also on earlier visits, and
  // under any chip — so "New suggestions" can tell the model what not to repeat.
  const seen = modifier === 'more' ? forPhrase(info.selectedText).map((e) => e.text) : [];
  const previousSuggestions = seen.length ? seen : undefined;
  const label = historyLabel(modifier, mode);

  // "New suggestions" is exempt from caching too — its whole purpose is fresh output.
  const cKey =
    modifier !== 'more'
      ? cacheKey({
          selectedText: info.selectedText,
          context: info.context,
          modifier,
          modifierInstruction,
          instructionOverride,
          temperature,
          protectedTerms,
          mode,
          model: settings.model,
          endpointUrl: settings.endpointUrl
        })
      : undefined;

  if (cKey) {
    const cached = cacheGet(cKey);
    if (cached) {
      activeController?.abort();
      activeController = undefined;
      // Recorded before the store update: MarginNote derives "Earlier" from it.
      record(info.selectedText, cached, label);
      noteStore.set({
        visible: true,
        loading: false,
        suggestions: cached,
        original: info.selectedText,
        error: null,
        position: info.screenPos ? { x: info.screenPos.left, y: info.screenPos.bottom } : null,
        sentenceRewriteEligible: false
      });
      return;
    }
  }

  activeController?.abort();
  const controller = new AbortController();
  activeController = controller;
  const requestStarted = Date.now();

  noteStore.set({
    visible: true,
    loading: true,
    suggestions: [],
    original: info.selectedText,
    error: null,
    position: info.screenPos ? { x: info.screenPos.left, y: info.screenPos.bottom } : null,
    sentenceRewriteEligible: false
  });

  try {
    const suggestions = await fetchSuggestionsStream({
      settings,
      selectedText: info.selectedText,
      context: info.context,
      modifier,
      modifierInstruction,
      instructionOverride,
      temperature,
      protectedTerms,
      mode,
      previousSuggestions,
      signal: controller.signal,
      onSuggestion: (_index, text) => {
        if (controller.signal.aborted) return;
        noteStore.update((n) => ({ ...n, suggestions: [...n.suggestions, text], loadStatus: undefined }));
      },
      onStatus: (status) => {
        if (controller.signal.aborted) return;
        noteStore.update((n) => ({ ...n, loadStatus: { ...status, since: n.loadStatus?.since ?? requestStarted } }));
      }
    });

    if (controller.signal.aborted) return;
    record(info.selectedText, suggestions, label);
    if (cKey) cacheSet(cKey, suggestions);
    noteStore.update((n) => ({ ...n, loading: false, suggestions, error: null, loadStatus: undefined }));
  } catch (err) {
    if (controller.signal.aborted) return; // superseded by a newer selection — discard silently
    const message = err instanceof SuggestRequestError ? err.message : 'Could not reach the model — try again.';
    noteStore.update((n) => ({ ...n, loading: false, error: message, loadStatus: undefined }));
  }
}

export function dismiss() {
  clearTimeout(debounceTimer);
  activeController?.abort();
  lastRequestKey = undefined;
  noteStore.update((n) => ({ ...n, visible: false }));
}
