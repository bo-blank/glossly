// stores/themeStore.ts
import { writable } from 'svelte/store';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'glossly-theme';

function loadInitialTheme(): Theme {
  if (typeof localStorage !== 'undefined') {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  }
  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
}

function applyTheme(theme: Theme) {
  if (typeof document !== 'undefined') document.documentElement.dataset.theme = theme;
}

export const themeStore = writable<Theme>(loadInitialTheme());

themeStore.subscribe((theme) => {
  applyTheme(theme);
  if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, theme);
});

export function toggleTheme() {
  themeStore.update((t) => (t === 'light' ? 'dark' : 'light'));
}
