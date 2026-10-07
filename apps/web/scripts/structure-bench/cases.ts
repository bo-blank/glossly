// Gold data for the structure bench (Phase 6 WP3). The templates already
// have exact blocks with names and, in their guide notes, a purpose per
// block, so every case is derived from them: flattened for segmentation,
// perturbed in a known way for the red-thread check.
//
// Templates are split into a tuning and a held-out half by id (the same ids
// in both languages). Prompt changes may only look at tuning results.

import { DE } from '../../src/editor/templates/de';
import { EN } from '../../src/editor/templates/en';
import type { TemplateText } from '../../src/editor/templates/types';

export type Language = 'de' | 'en';
export type Split = 'tuning' | 'held-out';

export const TUNING_IDS = ['business-email', 'linkedin-post', 'newsletter', 'scene'];

export interface Unit {
  kind: 'heading' | 'text' | 'list' | 'quote';
  text: string;
}

export interface Block {
  name: string;
  /** From the template's guide note; empty for an intruder or a block without one. */
  purpose: string;
  units: Unit[];
}

export interface TemplateDoc {
  id: string;
  language: Language;
  split: Split;
  blocks: Block[];
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', nbsp: ' ', '#39': "'" };

function plain(html: string): string {
  return html
    .replace(/<br\s*\/?>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&(\w+|#\d+);/g, (m, e: string) => ENTITIES[e] ?? m)
    .replace(/[ \t]*\n[ \t]*/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

/** The top-level children of a section: the units the editor would number. */
function unitsOf(sectionHtml: string): Unit[] {
  const units: Unit[] = [];
  for (const m of sectionHtml.matchAll(/<(p|h[1-6]|ul|ol|blockquote)\b[^>]*>([\s\S]*?)<\/\1>/g)) {
    const [, tag, inner] = m;
    if (tag === 'ul' || tag === 'ol') {
      const items = [...inner.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/g)].map((li) => `- ${plain(li[1])}`);
      units.push({ kind: 'list', text: items.join('\n') });
    } else {
      const text = plain(inner);
      if (text) units.push({ kind: tag.startsWith('h') ? 'heading' : tag === 'blockquote' ? 'quote' : 'text', text });
    }
  }
  return units;
}

function toDoc(t: TemplateText, language: Language): TemplateDoc {
  const purposes = new Map(t.guide.filter((g) => !g.general).map((g) => [g.section.toLowerCase(), g.hint]));
  const blocks = [...t.content.matchAll(/<section data-block="([^"]*)">([\s\S]*?)<\/section>/g)].map(([, name, inner]) => ({
    name,
    purpose: purposes.get(name.toLowerCase()) ?? '',
    units: unitsOf(inner)
  }));
  return { id: t.id, language, split: TUNING_IDS.includes(t.id) ? 'tuning' : 'held-out', blocks };
}

export const DOCS: TemplateDoc[] = [
  ...DE.filter((t) => t.id !== 'blank').map((t) => toDoc(t, 'de')),
  ...EN.filter((t) => t.id !== 'blank').map((t) => toDoc(t, 'en'))
];

// --- Segmentation ----------------------------------------------------------

export interface SegmentCase {
  doc: TemplateDoc;
  variant: 'headings' | 'no headings';
  units: Unit[];
  /** 0-based unit index where each block after the first starts. */
  gold: number[];
  goldNames: string[];
}

function segmentCase(doc: TemplateDoc, dropHeadings: boolean): SegmentCase {
  const units: Unit[] = [];
  const gold: number[] = [];
  for (const block of doc.blocks) {
    const kept = dropHeadings ? block.units.filter((u) => u.kind !== 'heading') : block.units;
    if (!kept.length) continue;
    if (units.length) gold.push(units.length);
    units.push(...kept);
  }
  return { doc, variant: dropHeadings ? 'no headings' : 'headings', units, gold, goldNames: doc.blocks.map((b) => b.name) };
}

export const SEGMENT_CASES: SegmentCase[] = DOCS.flatMap((d) => [segmentCase(d, false), segmentCase(d, true)]);

/**
 * Boundary F1. An exact boundary counts 1, one unit off counts ½; each gold
 * boundary is matched at most once, exact matches first.
 */
export function boundaryF1(gold: number[], predicted: number[]): number {
  if (!gold.length && !predicted.length) return 1;
  const free = new Set(predicted);
  let score = 0;
  const near: number[] = [];
  for (const g of gold) {
    if (free.delete(g)) score += 1;
    else near.push(g);
  }
  for (const g of near) {
    const hit = [g - 1, g + 1].find((p) => free.has(p));
    if (hit !== undefined) {
      free.delete(hit);
      score += 0.5;
    }
  }
  const precision = predicted.length ? score / predicted.length : 0;
  const recall = gold.length ? score / gold.length : 0;
  return precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
}

// --- Red thread ------------------------------------------------------------

export type Perturbation = 'clean' | 'swap' | 'intruder' | 'missing' | 'hollow';

export interface CheckCase {
  doc: TemplateDoc;
  kind: Perturbation;
  /** With the template's planned parts (names + purposes, original order) or without. */
  withPlan: boolean;
  blocks: Block[];
  plan: { name: string; purpose: string }[];
  /** 0-based indices into `blocks` where the finding is expected. */
  expectAt: number[];
  /** For "missing": the planned part that no block delivers. */
  expectMissing?: string;
}

const FILLER: Record<Language, string> = {
  de: 'Zu diesem Punkt ließe sich vieles sagen. Es ist ein wichtiges Thema, das uns alle betrifft, und es lohnt sich, in Ruhe darüber nachzudenken. Am Ende kommt es darauf an, was man daraus macht.',
  en: 'There is a lot one could say about this point. It is an important topic that affects all of us, and it is worth thinking about calmly. In the end, it comes down to what you make of it.'
};

/** The middle block, never the first or the last. */
const middle = (n: number) => Math.max(1, Math.min(n - 2, Math.floor(n / 2)));

function perturb(doc: TemplateDoc, kind: Perturbation, withPlan: boolean): CheckCase | null {
  const b = doc.blocks;
  const n = b.length;
  const plan = b.map(({ name, purpose }) => ({ name, purpose }));
  const base = { doc, kind, withPlan, plan: withPlan ? plan : [] };
  switch (kind) {
    case 'clean':
      return { ...base, blocks: b, expectAt: [] };
    case 'swap': {
      if (n < 3) return null;
      const [i, j] = n >= 4 ? [1, n - 1] : [0, 2];
      const blocks = [...b];
      [blocks[i], blocks[j]] = [blocks[j], blocks[i]];
      return { ...base, blocks, expectAt: [i, j] };
    }
    case 'intruder': {
      // The longest block of the next template in the same language: a different topic.
      const same = DOCS.filter((d) => d.language === doc.language);
      const source = same[(same.indexOf(doc) + 1) % same.length];
      const pasted = [...source.blocks].sort((x, y) => chars(y) - chars(x))[0];
      const at = middle(n + 1);
      const blocks = [...b.slice(0, at), { name: '', purpose: '', units: pasted.units }, ...b.slice(at)];
      return { ...base, blocks, expectAt: [at] };
    }
    case 'missing': {
      if (!withPlan || n < 3) return null;
      const at = middle(n);
      if (!b[at].purpose) return null;
      return { ...base, blocks: b.filter((_, k) => k !== at), expectAt: [], expectMissing: b[at].name };
    }
    case 'hollow': {
      const at = middle(n);
      if (!b[at].purpose) return null;
      const blocks = b.map((x, k) => (k === at ? { ...x, units: [{ kind: 'text' as const, text: FILLER[doc.language] }] } : x));
      return { ...base, blocks, expectAt: [at] };
    }
  }
}

const chars = (b: Block) => b.units.reduce((s, u) => s + u.text.length, 0);

const KINDS: Perturbation[] = ['clean', 'swap', 'intruder', 'missing', 'hollow'];

export const CHECK_CASES: CheckCase[] = DOCS.flatMap((d) =>
  [true, false].flatMap((withPlan) => KINDS.map((k) => perturb(d, k, withPlan)).filter((c): c is CheckCase => c !== null))
);

export const wordCount = (units: Unit[]) => units.reduce((s, u) => s + (u.text.match(/[\p{L}\p{N}]+/gu)?.length ?? 0), 0);
