// stores/tocStore.ts
import { writable } from 'svelte/store';

export interface TocItem {
  id: string;
  level: number;
  originalLevel: number;
  textContent: string;
  pos: number;
  itemIndex: number;
  isActive: boolean;
  isScrolledOver: boolean;
  dom: HTMLElement;
  node: unknown;
}

export const tocStore = writable<TocItem[]>([]);
