// Grammar-check measurement (Phase 4 WP7, story 6.7). Sends every sentence of
// scripts/grammar-bench/cases.ts to each model and writes a Markdown report.
// Measures, builds nothing: the decision rule is in docs/plans/phase-4-v1.4.md.
//
//   BENCH_URL     default http://127.0.0.1:8080/v1
//   BENCH_MODELS  default gemma4-e2b-qat,lfm2-exp-2.6b,gemma4-12b
//   BENCH_OUT     default <tmpdir>/glossly-bench-grammar.md

import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { it } from 'vitest';
import { NO_THINKING } from '../../server/src/providers/openaiCompatible';
import { CORRECT_CASES, ERROR_CASES, type Lang } from './grammar-bench/cases';

const URL = process.env.BENCH_URL ?? 'http://127.0.0.1:8080/v1';
const MODELS = (process.env.BENCH_MODELS ?? 'gemma4-e2b-qat,lfm2-exp-2.6b,gemma4-12b').split(',');
const OUT = process.env.BENCH_OUT ?? join(tmpdir(), 'glossly-bench-grammar.md');

const SYSTEM = `You are a careful proofreader. Correct spelling, grammar, punctuation and capitalisation errors in the sentence you are given.
Change nothing else: keep the wording, the style, dialect and colloquial speech, regional spelling (Swiss German "ss", British English) and commas that are optional.
If the sentence is already correct, return it exactly as it is.
Answer only with JSON: {"corrected": "<the sentence>"}.`;

const SCHEMA = {
  name: 'correction',
  strict: true,
  schema: { type: 'object', properties: { corrected: { type: 'string' } }, required: ['corrected'], additionalProperties: false }
};

/** Typographic quotes and apostrophes are not grammar; neither is surrounding whitespace. */
function normalise(s: string): string {
  return s.normalize('NFC').replace(/[’‘]/g, "'").replace(/[“”„]/g, '"').replace(/\s+/g, ' ').trim();
}

async function correct(model: string, text: string): Promise<{ out: string; ms: number }> {
  const t0 = performance.now();
  const res = await fetch(`${URL}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: text }
      ],
      response_format: { type: 'json_schema', json_schema: SCHEMA },
      temperature: 0,
      max_tokens: 300,
      ...NO_THINKING
    })
  });
  const body = await res.json();
  const ms = performance.now() - t0;
  try {
    return { out: (JSON.parse(body.choices[0].message.content) as { corrected: string }).corrected, ms };
  } catch {
    return { out: `⚠ no answer (${res.status})`, ms };
  }
}

const pct = (a: number, b: number) => `${((100 * a) / Math.max(b, 1)).toFixed(1)} %`;
const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] ?? 0;

it('grammar check', async () => {
  const summary: string[] = [];
  const details: string[] = [];
  for (const model of MODELS) {
    await correct(model, 'Warm-up.'); // a model swap must not count as latency
    for (const lang of ['de', 'en'] as Lang[]) {
      const errors = ERROR_CASES.filter((c) => c.lang === lang);
      const correctOnes = CORRECT_CASES.filter((c) => c.lang === lang);
      const times: number[] = [];
      let exact = 0;
      let missed = 0;
      const other: string[] = [];
      const byCategory = new Map<string, [number, number]>();
      for (const c of errors) {
        const { out, ms } = await correct(model, c.text);
        times.push(ms);
        const cat = byCategory.get(c.category) ?? [0, 0];
        cat[1]++;
        if ([c.expected, ...(c.alternatives ?? [])].some((fix) => normalise(out) === normalise(fix))) {
          exact++;
          cat[0]++;
        } else if (normalise(out) === normalise(c.text)) missed++;
        else other.push(`- ${c.category}: "${c.text}" → "${out}" (expected "${c.expected}")`);
        byCategory.set(c.category, cat);
      }
      const alarms: string[] = [];
      for (const c of correctOnes) {
        const { out, ms } = await correct(model, c.text);
        times.push(ms);
        if (normalise(out) !== normalise(c.text)) alarms.push(`- ${c.trap}: "${c.text}" → "${out}"`);
      }
      const recall = exact / errors.length;
      const fp = alarms.length / correctOnes.length;
      const pass = fp <= 0.05 && recall >= 0.8;
      summary.push(
        `| ${model} | ${lang} | ${exact}/${errors.length} (${pct(exact, errors.length)}) | ${missed} | ${other.length} | ${alarms.length}/${correctOnes.length} (${pct(alarms.length, correctOnes.length)}) | ${Math.round(median(times))} ms | ${pass ? 'yes' : 'no'} |`
      );
      details.push(
        `### ${model} · ${lang}`,
        '',
        `By category: ${[...byCategory].map(([k, [a, b]]) => `${k} ${a}/${b}`).join(' · ')}`,
        '',
        `**False alarms on correct sentences (${alarms.length})**`,
        '',
        ...(alarms.length ? alarms : ['- none']),
        '',
        `**Changed, but not to the expected fix (${other.length})**`,
        '',
        ...(other.length ? other : ['- none']),
        ''
      );
    }
  }
  const report = [
    '# Grammar check — measurement',
    '',
    'Decision rule (fixed in advance): the feature becomes a story only if gemma4-e2b-qat reaches, in both languages, ≤ 5 % false alarms and ≥ 80 % exact fixes.',
    '',
    '| model | lang | exact fix | missed | other change | false alarms | median latency | passes rule |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
    ...summary,
    '',
    '## Details',
    '',
    ...details
  ].join('\n');
  writeFileSync(OUT, report);
});
