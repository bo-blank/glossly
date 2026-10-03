// stores/uiStore.ts
import { writable } from 'svelte/store';

/** The settings drawer — opened from the header gear and from the endpoint status line. */
export const settingsOpen = writable(false);
