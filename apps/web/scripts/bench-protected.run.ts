// Protected-words bench (Phase 4 WP4). How often does the model change a
// protected word, without and with the "Keep these words" prompt line? The
// margin note flags a miss either way; this measures how often it has to.
//
//   BENCH_URL    default http://127.0.0.1:8080/v1
//   BENCH_MODEL  default gemma4-e2b-qat
//   BENCH_ROUNDS default 10
//   BENCH_OUT    default <tmpdir>/glossly-bench-protected.md

import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { it } from 'vitest';
import type { SuggestionContext } from '@glossly/shared';
import { buildMessages, SUGGESTIONS_JSON_SCHEMA } from '../../server/src/providers/prompt';
import { DEFAULT_TEMPERATURE, MAX_TOKENS_SUGGESTIONS, NO_THINKING } from '../../server/src/providers/openaiCompatible';
import { droppedTerms } from '../src/note/protectedTerms';

const URL = process.env.BENCH_URL ?? 'http://127.0.0.1:8080/v1';
const MODEL = process.env.BENCH_MODEL ?? 'gemma4-e2b-qat';
const ROUNDS = Number(process.env.BENCH_ROUNDS ?? 10);
const OUT = process.env.BENCH_OUT ?? join(tmpdir(), 'glossly-bench-protected.md');

interface Case {
  name: string;
  selection: string;
  terms: string[];
  context: SuggestionContext;
}

const ctx = (title: string, before: string, after: string): SuggestionContext => ({ title, headingPath: [], before, after });

const CASES: Case[] = [
  { name: 'name + invented place (de)', selection: 'Anna ging langsam zum Quellwerk', terms: ['Anna', 'Quellwerk'], context: ctx('Die Quelle', 'Der Nebel lag noch über dem Tal. ', ' hinunter, wo die Pumpen seit Wochen schwiegen.') },
  { name: 'invented title (de)', selection: 'der Funkenwächter hob die Lampe', terms: ['Funkenwächter'], context: ctx('Nachtwache', 'Als es dunkel wurde, ', ' und leuchtete in den Schacht.') },
  { name: 'name + invented place (en)', selection: 'Mara crossed the Glimmerfen at dawn', terms: ['Mara', 'Glimmerfen'], context: ctx('The Fen', 'Nobody had slept. ', ', her boots sinking with every step.') },
  { name: 'surname that is a word (de)', selection: 'Herr Brenneisen sah auf die Uhr', terms: ['Brenneisen'], context: ctx('Büro', 'Es war kurz nach fünf. ', ' und seufzte.') },
  { name: 'product name (de)', selection: 'das Tiptap-Plugin lädt den Editor', terms: ['Tiptap'], context: ctx('Doku', 'Beim Start ', ' erst, wenn die Seite steht.') },
  { name: 'deliberate repetition (de)', selection: 'Sie wartete und wartete', terms: ['wartete'], context: ctx('Bahnhof', 'Der Zug kam nicht. ', ', bis die Lichter ausgingen.') }
];
const MODIFIERS = [undefined, 'vivid', 'plain'] as const;

async function ask(c: Case, modifier: string | undefined, withLine: boolean): Promise<string[]> {
  const res = await fetch(`${URL}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      messages: buildMessages(c.selection, c.context, modifier, undefined, undefined, 'phrase', undefined, withLine ? c.terms : undefined),
      response_format: { type: 'json_schema', json_schema: SUGGESTIONS_JSON_SCHEMA },
      temperature: DEFAULT_TEMPERATURE,
      max_tokens: MAX_TOKENS_SUGGESTIONS,
      ...NO_THINKING
    })
  });
  const body = await res.json();
  try {
    return (JSON.parse(body.choices[0].message.content) as { suggestions: string[] }).suggestions.slice(0, 3);
  } catch {
    return [];
  }
}

it('protected words', async () => {
  const rows: string[] = [];
  const examples: string[] = [];
  const totals = { without: [0, 0], with: [0, 0] };
  for (const c of CASES) {
    for (const modifier of MODIFIERS) {
      const cell: Record<'without' | 'with', [number, number]> = { without: [0, 0], with: [0, 0] };
      for (const config of ['without', 'with'] as const) {
        for (let r = 0; r < ROUNDS; r++) {
          for (const s of await ask(c, modifier, config === 'with')) {
            const lost = droppedTerms(c.terms, c.selection, s);
            cell[config][1]++;
            totals[config][1]++;
            if (lost.length) {
              cell[config][0]++;
              totals[config][0]++;
              if (examples.length < 40) examples.push(`- ${config} · ${c.name} · ${modifier ?? 'default'}: "${s}" (lost ${lost.join(', ')})`);
            }
          }
        }
      }
      rows.push(`| ${c.name} | ${modifier ?? 'default'} | ${cell.without[0]}/${cell.without[1]} | ${cell.with[0]}/${cell.with[1]} |`);
    }
  }
  const pct = ([a, b]: number[]) => `${a}/${b} (${((100 * a) / Math.max(b, 1)).toFixed(1)} %)`;
  const report = [
    `# Protected words — ${MODEL}, ${ROUNDS} rounds`,
    '',
    `Without the prompt line: **${pct(totals.without)}** suggestions lost a protected word.`,
    `With it: **${pct(totals.with)}**.`,
    '',
    '| case | chip | without line | with line |',
    '| --- | --- | --- | --- |',
    ...rows,
    '',
    '## Misses (first 40)',
    '',
    ...examples
  ].join('\n');
  writeFileSync(OUT, report);
  console.log(report.split('\n').slice(0, 4).join('\n'));
});
