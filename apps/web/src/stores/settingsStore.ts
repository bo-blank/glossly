// stores/settingsStore.ts
import { writable } from 'svelte/store';

export interface Settings {
  provider: 'anthropic' | 'ollama' | 'lmstudio' | 'openai-compatible';
  model: string;
  endpointUrl: string;
  apiKey: string;
  timeout: number;
}

const defaultSettings: Settings = {
  provider: 'ollama',
  model: '',
  endpointUrl: 'http://localhost:11434/api/chat',
  apiKey: '',
  timeout: 10000
};

export const settingsStore = writable<Settings>(defaultSettings);

export function updateSettings(newSettings: Partial<Settings>) {
  settingsStore.update(s => ({ ...s, ...newSettings }));
}
