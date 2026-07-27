// stores/noteStore.ts
import { writable } from 'svelte/store';

export interface NoteState {
  visible: boolean;
  loading: boolean;
  suggestions: string[];
  error: string | null;
  position: { x: number; y: number } | null;
  // True while `error` is the "selection too long" message and the selection is still
  // within sentence-mode's 600-char ceiling — offers "Rewrite as sentence(s)" instead of
  // just the plain error.
  sentenceRewriteEligible: boolean;
}

export const noteStore = writable<NoteState>({
  visible: false,
  loading: false,
  suggestions: [],
  error: null,
  position: null,
  sentenceRewriteEligible: false
});

export interface EditorStore {
  editor: any; // Tiptap editor instance
  selection: any; // Selection range
  document: string; // Current document content
}

export const editorStore = writable<EditorStore>({
  editor: null,
  selection: null,
  document: ''
});
