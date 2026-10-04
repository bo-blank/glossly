// Block-name bench (Phase 5 WP7). Does telling the model which block the
// selection sits in ("Fazit", "Einstieg", …) change its suggestions? The same
// sentence, with the same neighbours, is sent without a name (twice, the second
// run is the noise floor), with the fitting name and with a contrasting one.
// The name goes into the prompt in two wordings: a bare line like `Section:`,
// and one that says what the block is for.
//
// Measured per config: how many suggestions carry a marker of the fitting role
// (e.g. "insgesamt" for a conclusion) and of the contrasting role, how far the
// wording drifts from the no-name run, whether the name leaks into the text,
// and the length against the original. Every answer is listed for reading.
//
//   BENCH_URL    default http://127.0.0.1:8080/v1
//   BENCH_MODEL  default gemma4-e2b-qat
//   BENCH_ROUNDS default 10
//   BENCH_OUT    default <tmpdir>/glossly-bench-blockname.md

import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { it } from 'vitest';
import type { SuggestionContext } from '@glossly/shared';
import { buildMessages, SUGGESTIONS_JSON_SCHEMA } from '../../server/src/providers/prompt';
import { DEFAULT_TEMPERATURE, MAX_TOKENS_SUGGESTIONS, NO_THINKING } from '../../server/src/providers/openaiCompatible';

const URL = process.env.BENCH_URL ?? 'http://127.0.0.1:8080/v1';
const MODEL = process.env.BENCH_MODEL ?? 'gemma4-e2b-qat';
const ROUNDS = Number(process.env.BENCH_ROUNDS ?? 10);
const OUT = process.env.BENCH_OUT ?? join(tmpdir(), 'glossly-bench-blockname.md');

interface Role {
  name: string;
  markers: RegExp;
}

interface Case {
  name: string;
  selection: string;
  context: SuggestionContext;
  fit: Role;
  other: Role;
}

const ctx = (title: string, before: string, after: string): SuggestionContext => ({ title, headingPath: [], before, after });

const CONCLUSION_DE = /\b(insgesamt|zusammenfassend|kurz gesagt|am ende|letztlich|schließlich|unterm strich|im rückblick|rückblickend|alles in allem|fazit)\b/i;
const HOOK = /\?|\b(stell dir vor|stellen sie sich vor|kennst du|kennen sie|wussten sie|hätten sie gedacht|imagine|ever wondered|guess what)\b/i;
const CTA_DE = /!|\b(jetzt|kommen sie|komm|besuchen sie|besuch|schauen sie|schau|vorbei|melden sie sich|planen sie)\b/i;
const NEWS_DE = /\b(ab sofort|neu|seit|ab dem|ab montag|künftig|ab jetzt)\b/i;
const CONCESSION_DE = /\b(zwar|allerdings|jedoch|dennoch|doch|aber|trotzdem|nicht immer|nicht unbedingt|stimmt das)\b/i;
const THESIS_DE = /\b(ich bin überzeugt|meiner meinung|ich behaupte|eindeutig|klar ist|zweifellos|ist sicher)\b/i;
const CONCLUSION_EN = /\b(overall|in the end|ultimately|in short|all in all|looking back|in hindsight|in sum|to sum up)\b/i;
const CTA_EN = /!|\b(come|visit|drop by|stop by|now|plan your|check)\b/i;
const NEWS_EN = /\b(starting|from now on|new|as of|beginning|now open)\b/i;

const CASES: Case[] = [
  {
    name: 'project lesson (de)',
    selection: 'Das Projekt hat uns viel gelehrt.',
    context: ctx('Drei Monate Umbau', 'Drei Monate, zwei Prototypen, ein Umzug. ', ' Vieles würden wir wieder genauso machen.'),
    fit: { name: 'Fazit', markers: CONCLUSION_DE },
    other: { name: 'Einstieg', markers: HOOK }
  },
  {
    name: 'opening hours (de)',
    selection: 'Wir haben unsere Öffnungszeiten geändert.',
    context: ctx('Newsletter Oktober', 'Liebe Kundinnen und Kunden, ', ' Samstags sind wir jetzt bis 18 Uhr für Sie da.'),
    fit: { name: 'Handlungsaufforderung', markers: CTA_DE },
    other: { name: 'Neuigkeit', markers: NEWS_DE }
  },
  {
    name: 'home office (de)',
    selection: 'Viele halten Homeoffice für produktiver.',
    context: ctx('Zurück ins Büro?', 'Die Diskussion ist alt. ', ' Die Zahlen aus unserem Team erzählen etwas anderes.'),
    fit: { name: 'Gegenargument', markers: CONCESSION_DE },
    other: { name: 'These', markers: THESIS_DE }
  },
  {
    name: 'resignation post (de)',
    selection: 'Ich habe letzte Woche gekündigt.',
    context: ctx('LinkedIn-Post', '', ' Ohne neuen Job, ohne Plan B.'),
    fit: { name: 'Hook', markers: HOOK },
    other: { name: 'Fazit', markers: CONCLUSION_DE }
  },
  {
    name: 'team lesson (en)',
    selection: 'The team learned a lot from this project.',
    context: ctx('Three months of rebuilding', 'Three months, two prototypes, one move. ', ' Most of it we would do the same way again.'),
    fit: { name: 'Conclusion', markers: CONCLUSION_EN },
    other: { name: 'Hook', markers: HOOK }
  },
  {
    name: 'opening hours (en)',
    selection: 'We have changed our opening hours.',
    context: ctx('October newsletter', 'Dear customers, ', ' On Saturdays we are now open until 6 pm.'),
    fit: { name: 'Call to action', markers: CTA_EN },
    other: { name: 'News', markers: NEWS_EN }
  }
];

const CONFIGS = ['none', 'none (again)', 'fit', 'fit, explained', 'other, explained'] as const;
type Config = (typeof CONFIGS)[number];

function blockLine(config: Config, c: Case): string | null {
  if (config.startsWith('none')) return null;
  const name = config.startsWith('fit') ? c.fit.name : c.other.name;
  return config.endsWith('explained')
    ? `Block: "${name}". The selection is part of this block of the text; the alternatives should do what a "${name}" does.`
    : `Block: ${name}`;
}

async function ask(c: Case, config: Config): Promise<string[]> {
  const messages = buildMessages(c.selection, c.context, undefined, undefined, undefined, 'sentence');
  const line = blockLine(config, c);
  // Next to `Section:`, as the field would sit in renderContext.
  if (line) messages[1].content = messages[1].content.replace('Context:\n', `${line}\n\nContext:\n`);
  const res = await fetch(`${URL}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      messages,
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

const words = (s: string) => new Set(s.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []);

/** Mean word-set distance from each suggestion to its nearest neighbour in `ref`: 0 = same wording. */
function drift(set: string[], ref: string[]): number {
  if (!set.length || !ref.length) return NaN;
  const refWords = ref.map(words);
  let total = 0;
  for (const s of set) {
    const w = words(s);
    let best = 1;
    for (const r of refWords) {
      const inter = [...w].filter((x) => r.has(x)).length;
      best = Math.min(best, 1 - inter / (w.size + r.size - inter || 1));
    }
    total += best;
  }
  return total / set.length;
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : NaN;
};

it('block name in the prompt', async () => {
  const rows: string[] = [];
  const answers: string[] = [];
  const totals = Object.fromEntries(CONFIGS.map((k) => [k, { fit: 0, other: 0, leak: 0, n: 0 }])) as Record<
    Config,
    { fit: number; other: number; leak: number; n: number }
  >;
  for (const c of CASES) {
    const out = {} as Record<Config, string[]>;
    for (const config of CONFIGS) {
      out[config] = [];
      for (let r = 0; r < ROUNDS; r++) out[config].push(...(await ask(c, config)));
    }
    answers.push(`### ${c.name} — "${c.selection}" (fit: ${c.fit.name}, other: ${c.other.name})`, '');
    for (const config of CONFIGS) {
      const set = out[config];
      const fit = set.filter((s) => c.fit.markers.test(s)).length;
      const other = set.filter((s) => c.other.markers.test(s)).length;
      // The name the config sent, written into the text itself ("Fazit: …").
      const sent = config.startsWith('fit') ? c.fit.name : config.startsWith('other') ? c.other.name : null;
      const leak = sent ? set.filter((s) => s.toLowerCase().includes(sent.toLowerCase())).length : 0;
      const t = totals[config];
      t.fit += fit;
      t.other += other;
      t.leak += leak;
      t.n += set.length;
      const len = median(set.map((s) => s.length / c.selection.length));
      const d = config === 'none' ? '—' : drift(set, out.none).toFixed(2);
      rows.push(`| ${c.name} | ${config} | ${fit}/${set.length} | ${other}/${set.length} | ${d} | ${leak} | ${len.toFixed(2)} |`);
      answers.push(`**${config}**`, '', ...set.map((s) => `- ${s}`), '');
    }
  }
  const pct = (a: number, b: number) => `${a}/${b} (${((100 * a) / Math.max(b, 1)).toFixed(0)} %)`;
  const report = [
    `# Block name in the prompt — ${MODEL}, ${ROUNDS} rounds`,
    '',
    '| config | fitting-role marker | contrasting-role marker | name leaked |',
    '| --- | --- | --- | --- |',
    ...CONFIGS.map((k) => `| ${k} | ${pct(totals[k].fit, totals[k].n)} | ${pct(totals[k].other, totals[k].n)} | ${totals[k].leak} |`),
    '',
    'Drift = mean word-set distance to the nearest "none" suggestion; "none (again)" is the noise floor.',
    '',
    '| case | config | fit marker | other marker | drift | leak | length × |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    ...rows,
    '',
    '## Answers',
    '',
    ...answers
  ].join('\n');
  writeFileSync(OUT, report);
  console.log(report.split('\n').slice(0, 9).join('\n'));
});
