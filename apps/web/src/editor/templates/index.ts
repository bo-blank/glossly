import { DE } from './de';
import { EN } from './en';
import type { TemplateGroup, TemplateText } from './types';

export type { GuideNote, TemplateGroup, TemplateText } from './types';
export type TemplateLanguage = 'de' | 'en';

const BY_LANGUAGE: Record<TemplateLanguage, TemplateText[]> = { de: DE, en: EN };

export const TEMPLATE_LANGUAGES: { id: TemplateLanguage; label: string }[] = [
  { id: 'de', label: 'DE' },
  { id: 'en', label: 'EN' }
];

export const BLANK_TEMPLATE_ID = 'blank';

/** The picker's sections, in order. Every template but the blank page is in exactly one. */
export const TEMPLATE_GROUPS: { id: TemplateGroup; label: Record<TemplateLanguage, string>; ids: string[] }[] = [
  { id: 'work', label: { de: 'Arbeit', en: 'Work' }, ids: ['business-email', 'cover-letter', 'meeting-notes'] },
  {
    id: 'publishing',
    label: { de: 'Veröffentlichen', en: 'Publishing' },
    ids: ['linkedin-post', 'video-script', 'blog-article', 'newsletter', 'essay']
  },
  { id: 'fiction', label: { de: 'Erzählen', en: 'Fiction' }, ids: ['scene'] }
];

export function templatesIn(language: TemplateLanguage): TemplateText[] {
  return BY_LANGUAGE[language];
}

export function findTemplate(language: TemplateLanguage, id: string): TemplateText | undefined {
  return BY_LANGUAGE[language]?.find((t) => t.id === id);
}

/** German for a German-speaking browser, English otherwise — until the writer picks. */
export function defaultTemplateLanguage(languages: readonly string[] = globalThis.navigator?.languages ?? []): TemplateLanguage {
  return languages[0]?.toLowerCase().startsWith('de') ? 'de' : 'en';
}

/** Blank-ish documents can be replaced without warning the writer. */
export function isDocumentDisposable(text: string): boolean {
  return text.trim().length === 0;
}

/**
 * Hohenheim's two yardsticks: web texts (target 16, no sentence over 20
 * words) and specialist/press texts (target 12). Short-form publishing reads
 * on screens, in passing; everything else, and a document without a
 * template, is held to the specialist standard. The writer can switch.
 */
const WEB_TEXT_TEMPLATES = new Set(['linkedin-post', 'newsletter', 'video-script']);

export function textTypeFor(doc: { textType?: 'fach' | 'web'; template?: { id: string } } | undefined): 'fach' | 'web' {
  return doc?.textType ?? (doc?.template && WEB_TEXT_TEMPLATES.has(doc.template.id) ? 'web' : 'fach');
}
