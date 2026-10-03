// stores/settingsStore.ts
import { writable } from 'svelte/store';
import type { Provider } from '@glossly/shared';

export interface CustomModifier {
  id: string;
  label: string;
  instruction: string;
}

/** Per style chip; unset fields mean the server's defaults (temperature 0.8, built-in instruction). */
export interface ModifierTuning {
  temperature?: number;
  instruction?: string;
}

export interface Settings {
  provider: Provider;
  model: string;
  endpointUrl: string;
  apiKey: string;
  timeout: number;
  customModifiers: CustomModifier[];
  /** Keyed by chip id: the built-ins' tighter/vivid/plain or a custom chip's id. */
  modifierTuning: Record<string, ModifierTuning>;
}

const STORAGE_KEY = 'glossly-settings';

const defaultSettings: Settings = {
  provider: 'openai-compatible',
  model: 'gemma4-e2b-qat',
  endpointUrl: 'http://127.0.0.1:8080/v1',
  apiKey: '',
  timeout: 10000,
  customModifiers: [],
  modifierTuning: {}
};

function loadSettings(): Settings {
  if (typeof localStorage === 'undefined') return defaultSettings;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? { ...defaultSettings, ...JSON.parse(stored) } : defaultSettings;
  } catch {
    return defaultSettings;
  }
}

export const settingsStore = writable<Settings>(loadSettings());

export function persistSettings(settings: Settings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export function updateSettings(newSettings: Partial<Settings>) {
  settingsStore.update(s => ({ ...s, ...newSettings }));
}
