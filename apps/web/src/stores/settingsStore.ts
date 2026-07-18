// stores/settingsStore.ts
import { writable } from 'svelte/store';

export interface Settings {
  provider: 'ollama' | 'lmstudio' | 'openai-compatible';
  model: string;
  endpointUrl: string;
  apiKey: string;
  timeout: number;
}

const STORAGE_KEY = 'glossly-settings';

const defaultSettings: Settings = {
  provider: 'openai-compatible',
  model: 'gemma4-e2b-qat',
  endpointUrl: 'http://127.0.0.1:8080/v1',
  apiKey: '',
  timeout: 10000
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

export function updateSettings(newSettings: Partial<Settings>) {
  settingsStore.update(s => ({ ...s, ...newSettings }));
}
