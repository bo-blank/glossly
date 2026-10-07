// Structure bench (Phase 6 WP3). Can a local model (a) split a text into
// blocks and (b) judge its red thread and each block against its purpose?
// Measurement only: the prompts live here until WP4 moves the winner's to
// the server. Pass rules are fixed in docs/plans/phase-6-v1.6.md (WP3) and
// were set before the first run.
//
//   BENCH_URL    default http://127.0.0.1:8080/v1
//   BENCH_MODEL  default gemma4-e2b-qat
//   BENCH_ROUNDS default 1
//   BENCH_SPLIT  tuning | held-out | all (default all)
//   BENCH_TASKS  segment,check,latency (default all three)
//   BENCH_OUT    default <tmpdir>/glossly-bench-structure-<model>.md

import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { it } from 'vitest';
import { detectLanguage } from '@glossly/shared';
import { NO_THINKING } from '../../server/src/providers/openaiCompatible';
import {
  boundaryF1,
  CHECK_CASES,
  DOCS,
  SEGMENT_CASES,
  wordCount,
  type Block,
  type CheckCase,
  type Perturbation,
  type SegmentCase,
  type Unit
} from './structure-bench/cases';

const URL = process.env.BENCH_URL ?? 'http://127.0.0.1:8080/v1';
const MODEL = process.env.BENCH_MODEL ?? 'gemma4-e2b-qat';
const ROUNDS = Number(process.env.BENCH_ROUNDS ?? 1);
const SPLIT = process.env.BENCH_SPLIT ?? 'all';
const TASKS = (process.env.BENCH_TASKS ?? 'segment,check,latency').split(',');
// Segmentation strategy (angles for small models):
//   whole       one call, the model returns the blocks
//   whole+lang  the same with the language named explicitly
//   label       one call labels every unit from a fixed list; code merges runs of one label
//   pairs       one yes/no call per gap between two units
const STRATEGY = process.env.BENCH_STRATEGY ?? 'whole';
const OUT = process.env.BENCH_OUT ?? join(tmpdir(), `glossly-bench-structure-${MODEL}-${STRATEGY}.md`);

const inSplit = (c: { doc: { split: string } }) => SPLIT === 'all' || c.doc.split === SPLIT;

// --- Prompts ---------------------------------------------------------------

const SEGMENT_SYSTEM = `You are a precise structural editor. You receive a text split into numbered units
(paragraphs, headings, lists, quotes). Group the units into blocks. A block is a run of consecutive units that
together do one job for the reader, for example: opening, context, evidence, objection, conclusion, call to action.
Rules: every unit belongs to exactly one block; blocks are consecutive and in order; the first block starts at unit 1
and the last block ends at the last unit; a heading never ends a block. Give each block a short name (1 to 3 words)
and a one-sentence purpose: what this part must achieve for the reader. Write names and purposes in the language of
the text.`;

const SEGMENT_SCHEMA = {
  name: 'blocks',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      blocks: {
        type: 'array',
        items: {
          type: 'object',
          properties: { start: { type: 'integer' }, end: { type: 'integer' }, name: { type: 'string' }, purpose: { type: 'string' } },
          required: ['start', 'end', 'name', 'purpose'],
          additionalProperties: false
        }
      }
    },
    required: ['blocks'],
    additionalProperties: false
  }
};

const CHECK_SYSTEM = `You are a precise structural editor. You receive a text as numbered blocks. Each block has a
name and the purpose the writer set for it (either may be empty), followed by its text. Judge the structure only,
not style, spelling or grammar.
1. thread: for every block, one short line with what it actually says (its gist), in the language of the text.
2. blocks: for every block, a verdict. "ok": it does what its purpose says and belongs in this text. "weak": it does
   so only partly. "off": it does not do its purpose, or it does not belong in this text at all. One-sentence reason.
3. order: only when a block clearly sits in the wrong place, propose a move: "block" is its number, "before" the
   number of the block it should come before (number of blocks + 1 for the end). Empty when the order works.
4. missing: when the writer's planned parts are given, the names of planned parts no block delivers. Otherwise empty.
Report only real problems. A well-built text needs no findings at all.`;

const CHECK_SCHEMA = {
  name: 'check',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      thread: { type: 'array', items: { type: 'string' } },
      blocks: {
        type: 'array',
        items: {
          type: 'object',
          properties: { block: { type: 'integer' }, verdict: { type: 'string', enum: ['ok', 'weak', 'off'] }, reason: { type: 'string' } },
          required: ['block', 'verdict', 'reason'],
          additionalProperties: false
        }
      },
      order: {
        type: 'array',
        items: {
          type: 'object',
          properties: { block: { type: 'integer' }, before: { type: 'integer' }, reason: { type: 'string' } },
          required: ['block', 'before', 'reason'],
          additionalProperties: false
        }
      },
      missing: { type: 'array', items: { type: 'string' } }
    },
    required: ['thread', 'blocks', 'order', 'missing'],
    additionalProperties: false
  }
};

const unitLines = (units: Unit[]) => units.map((u, i) => `[${i + 1}]${u.kind === 'heading' ? ' (heading)' : ''} ${u.text}`).join('\n');

function checkPrompt(blocks: Block[], plan: { name: string; purpose: string }[]): string {
  const parts = blocks.map(
    (b, i) =>
      `## Block ${i + 1}\nName: ${b.name || '(none)'}\nPurpose: ${b.purpose || '(none)'}\nText:\n${b.units.map((u) => u.text).join('\n\n')}`
  );
  const planText = plan.length ? `Planned parts (from the writer's template, in planned order):\n${plan.map((p) => `- ${p.name}: ${p.purpose}`).join('\n')}\n\n` : '';
  return `${planText}${parts.join('\n\n')}`;
}

// --- Calls -----------------------------------------------------------------

interface Answer<T> {
  value: T | null;
  ms: number;
  raw: string;
}

async function ask<T>(system: string, user: string, schema: object, maxTokens: number): Promise<Answer<T>> {
  const t0 = performance.now();
  const res = await fetch(`${URL}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ],
      response_format: { type: 'json_schema', json_schema: schema },
      temperature: 0.3,
      max_tokens: maxTokens,
      ...NO_THINKING
    })
  });
  const body = await res.json();
  const ms = performance.now() - t0;
  const raw: string = body.choices?.[0]?.message?.content ?? JSON.stringify(body).slice(0, 300);
  try {
    return { value: JSON.parse(raw) as T, ms, raw };
  } catch {
    return { value: null, ms, raw };
  }
}

interface SegmentAnswer {
  blocks: { start: number; end: number; name: string; purpose: string }[];
}

interface CheckAnswer {
  thread: string[];
  blocks: { block: number; verdict: 'ok' | 'weak' | 'off'; reason: string }[];
  order: { block: number; before: number; reason: string }[];
  missing: string[];
}

/** Ground rule 2: covers every unit, contiguous, in order. Returns 0-based starts after the first, or null. */
function validStarts(a: SegmentAnswer | null, n: number): number[] | null {
  if (!a?.blocks?.length) return null;
  let next = 1;
  for (const b of a.blocks) {
    if (b.start !== next || b.end < b.start) return null;
    next = b.end + 1;
  }
  return next === n + 1 ? a.blocks.slice(1).map((b) => b.start - 1) : null;
}

const pct = (a: number, b: number) => `${a}/${b} (${b ? Math.round((100 * a) / b) : 0} %)`;
const avg = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : NaN);
const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] ?? NaN;
const sec = (ms: number) => `${(ms / 1000).toFixed(1)} s`;


// --- Segmentation strategies -------------------------------------------------

const LABELS: Record<string, [de: string, en: string]> = {
  title: ['Titel', 'Title'],
  subject: ['Betreff', 'Subject'],
  greeting: ['Anrede', 'Greeting'],
  hook: ['Einstieg', 'Opening'],
  request: ['Anliegen', 'Request'],
  context: ['Kontext', 'Context'],
  problem: ['Problem', 'Problem'],
  story: ['Geschichte', 'Story'],
  argument: ['Argument', 'Argument'],
  evidence: ['Beleg', 'Evidence'],
  objection: ['Einwand', 'Objection'],
  setting: ['Ort', 'Setting'],
  dialogue: ['Dialog', 'Dialogue'],
  turn: ['Wendung', 'Turn'],
  decisions: ['Beschlüsse', 'Decisions'],
  tasks: ['Aufgaben', 'Action items'],
  takeaway: ['Erkenntnis', 'Takeaway'],
  conclusion: ['Schluss', 'Conclusion'],
  question: ['Frage', 'Question'],
  call_to_action: ['Aufruf', 'Call to action'],
  next_step: ['Nächster Schritt', 'Next step'],
  sign_off: ['Gruß', 'Sign-off'],
  note: ['Hinweis', 'Note']
};

const LABEL_SYSTEM = `You are a precise structural editor. You receive a text split into numbered units. For every
unit, choose the one label that best says what the unit does for the reader. Labels: ${Object.keys(LABELS).join(', ')}.
Return exactly one label per unit, in order.`;

const labelSchema = (n: number) => ({
  name: 'labels',
  strict: true,
  schema: {
    type: 'object',
    properties: { labels: { type: 'array', items: { type: 'string', enum: Object.keys(LABELS) }, minItems: n, maxItems: n } },
    required: ['labels'],
    additionalProperties: false
  }
});

const PAIR_SYSTEM = `You are a precise structural editor. You see the end of one part of a text and the unit that
follows it. Decide whether the next unit continues the same part (it does the same job for the reader) or starts a
new part (it does a different job: for example the opening ends and the context begins, or the argument ends and the
objection begins). Answer "continue" or "new".`;

const PAIR_SCHEMA = {
  name: 'boundary',
  strict: true,
  schema: {
    type: 'object',
    properties: { answer: { type: 'string', enum: ['continue', 'new'] } },
    required: ['answer'],
    additionalProperties: false
  }
};

/** Average block length of the tuning templates: the only number taken from the gold data. */
const WORDS_PER_BLOCK = (() => {
  const docs = DOCS.filter((d) => d.split === 'tuning');
  return docs.reduce((s, d) => s + wordCount(d.blocks.flatMap((b) => b.units)), 0) / docs.reduce((s, d) => s + d.blocks.length, 0);
})();

/** p(new) / (p(new) + p(continue)) at the token where the answer starts. */
async function askBoundary(user: string): Promise<{ pNew: number; ms: number }> {
  const t0 = performance.now();
  const res = await fetch(`${URL}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: PAIR_SYSTEM },
        { role: 'user', content: user }
      ],
      response_format: { type: 'json_schema', json_schema: PAIR_SCHEMA },
      temperature: 0.3,
      max_tokens: 20,
      logprobs: true,
      top_logprobs: 20,
      ...NO_THINKING
    })
  });
  const body = await res.json();
  const ms = performance.now() - t0;
  const tokens: { token: string; top_logprobs: { token: string; logprob: number }[] }[] = body.choices?.[0]?.logprobs?.content ?? [];
  const at = tokens.find((t) => /^(new|cont|contin|continue)$/.test(t.token.replace(/["\s]/g, '')));
  if (!at) return { pNew: 0.5, ms };
  let pNew = 0;
  let pCont = 0;
  for (const t of at.top_logprobs) {
    const w = t.token.replace(/["\s]/g, '');
    if (!w) continue;
    if ('new'.startsWith(w)) pNew += Math.exp(t.logprob);
    else if ('continue'.startsWith(w)) pCont += Math.exp(t.logprob);
  }
  return { pNew: pNew + pCont ? pNew / (pNew + pCont) : 0.5, ms };
}

/** Starts (0-based) → blocks over 1-based units. */
function blocksFrom(starts: number[], n: number, name: (start: number) => string): SegmentAnswer {
  const all = [0, ...starts];
  return { blocks: all.map((s, i) => ({ start: s + 1, end: (all[i + 1] ?? n) , name: name(s), purpose: '' })) };
}

const segment = (units: Unit[]) => segmentWith(STRATEGY, units);

async function segmentWith(STRATEGY: string, units: Unit[]): Promise<Answer<SegmentAnswer>> {
  const lang = detectLanguage(units.map((u) => u.text).join(' ')) ?? 'English';
  if (STRATEGY === 'whole' || STRATEGY === 'whole+lang') {
    const langLine = STRATEGY === 'whole+lang' ? `\n\nLanguage: the text is ${lang}. Write every name and purpose in ${lang}.` : '';
    return ask<SegmentAnswer>(SEGMENT_SYSTEM, `Units:\n${unitLines(units)}${langLine}`, SEGMENT_SCHEMA, 1500);
  }
  const n = units.length;
  if (STRATEGY === 'label') {
    const a = await ask<{ labels: string[] }>(LABEL_SYSTEM, `Units:\n${unitLines(units)}`, labelSchema(n), 800);
    const labels = a.value?.labels;
    if (!labels || labels.length !== n) return { value: null, ms: a.ms, raw: a.raw };
    // A heading or a greeting belongs to what follows it.
    const eff = [...labels];
    for (let i = n - 2; i >= 0; i--) if (units[i].kind === 'heading' || eff[i] === 'greeting') eff[i] = eff[i + 1];
    const starts = eff.flatMap((l, i) => (i > 0 && l !== eff[i - 1] ? [i] : []));
    const k = lang === 'German' ? 0 : 1;
    return { value: blocksFrom(starts, n, (s) => LABELS[eff[s]]?.[k] ?? eff[s]), ms: a.ms, raw: a.raw };
  }
  if (STRATEGY === 'pairs') {
    const starts: number[] = [];
    let ms = 0;
    for (let i = 1; i < n; i++) {
      // A heading never ends a part and always opens one.
      if (units[i - 1].kind === 'heading') continue;
      if (units[i].kind === 'heading') {
        starts.push(i);
        continue;
      }
      const before = units.slice(Math.max(0, i - 2), i).map((u) => u.text).join('\n\n');
      const a = await ask<{ answer: string }>(PAIR_SYSTEM, `End of the current part:\n${before}\n\nNext unit:\n${units[i].text}`, PAIR_SCHEMA, 20);
      ms += a.ms;
      if (a.value?.answer === 'new') starts.push(i);
    }
    return { value: blocksFrom(starts, n, () => ''), ms, raw: '' };
  }
  if (STRATEGY === 'label+pairs') {
    // Labelling finds the real boundaries but splits too often; keep a label change
    // only where the gap question agrees.
    const labelled = await segmentWith('label', units);
    const paired = await segmentWith('pairs', units);
    if (!labelled.value || !paired.value) return labelled;
    const pairStarts = new Set(paired.value.blocks.slice(1).map((b) => b.start));
    const keep = labelled.value.blocks.filter((b, i) => i === 0 || pairStarts.has(b.start) || units[b.start - 1].kind === 'heading');
    const starts = keep.slice(1).map((b) => b.start - 1);
    return { value: blocksFrom(starts, n, (st) => keep.find((b) => b.start === st + 1)?.name ?? ''), ms: labelled.ms + paired.ms, raw: '' };
  }
  if (STRATEGY === 'pairs-rank') {
    // Same question per gap, but read e2b's confidence instead of its answer, and keep only
    // the strongest gaps: as many blocks as the text's length suggests.
    const forced: number[] = [];
    const scored: { i: number; p: number }[] = [];
    let ms = 0;
    for (let i = 1; i < n; i++) {
      if (units[i - 1].kind === 'heading') continue;
      if (units[i].kind === 'heading') {
        forced.push(i);
        continue;
      }
      const before = units.slice(Math.max(0, i - 2), i).map((u) => u.text).join('\n\n');
      const a = await askBoundary(`End of the current part:\n${before}\n\nNext unit:\n${units[i].text}`);
      ms += a.ms;
      scored.push({ i, p: a.pNew });
    }
    const target = Math.max(1, Math.round(wordCount(units) / WORDS_PER_BLOCK)) - 1;
    const extra = scored.sort((x, y) => y.p - x.p).slice(0, Math.max(0, target - forced.length)).map((x) => x.i);
    const starts = [...forced, ...extra].sort((x, y) => x - y);
    return { value: blocksFrom(starts, n, () => ''), ms, raw: '' };
  }
  throw new Error(`Unknown BENCH_STRATEGY ${STRATEGY}`);
}

// --- Segmentation ----------------------------------------------------------

async function runSegment(report: string[]) {
  const cases = SEGMENT_CASES.filter(inSplit);
  const rows: string[] = [];
  const reading: string[] = [];
  const f1: Record<string, number[]> = {};
  const invalid: Record<string, number> = {};
  const times: number[] = [];
  for (const c of cases) {
    for (let r = 0; r < ROUNDS; r++) {
      const a = await segment(c.units);
      times.push(a.ms);
      const starts = validStarts(a.value, c.units.length);
      const score = starts ? boundaryF1(c.gold, starts) : 0;
      const key = `${c.doc.language} · ${c.variant} · ${c.doc.split}`;
      (f1[key] ??= []).push(score);
      if (!starts) invalid[key] = (invalid[key] ?? 0) + 1;
      rows.push(`| ${c.doc.language} ${c.doc.id} | ${c.variant} | ${c.doc.split} | ${starts ? score.toFixed(2) : 'invalid'} | ${c.gold.map((g) => g + 1).join(' ')} | ${starts?.map((s) => s + 1).join(' ') ?? '—'} | ${sec(a.ms)} |`);
      if (r === 0)
        reading.push(
          `**${c.doc.language} ${c.doc.id} · ${c.variant}** — gold: ${c.goldNames.join(' / ')}`,
          '',
          ...(a.value?.blocks ?? []).map((b) => `- ${b.start}–${b.end} **${b.name}**: ${b.purpose}`),
          ...(starts ? [] : [`- invalid: \`${a.raw.slice(0, 200).replace(/\n/g, ' ')}\``]),
          ''
        );
    }
  }
  report.push(
    '## Segmentation',
    '',
    'Pass: boundary F1 ≥ 0.70 on held-out, both languages (one unit off = ½). An invalid answer scores 0.',
    '',
    '| language · variant · split | mean F1 | invalid |',
    '| --- | --- | --- |',
    ...Object.entries(f1)
      .sort()
      .map(([k, v]) => `| ${k} | ${avg(v).toFixed(2)} | ${invalid[k] ?? 0}/${v.length} |`),
    '',
    `Median ${sec(median(times))} per text.`,
    '',
    '| text | variant | split | F1 | gold starts | predicted starts | time |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    ...rows,
    '',
    '### Names and purposes (first round, for reading)',
    '',
    ...reading
  );
}

// --- Red thread ------------------------------------------------------------

interface Score {
  strict: boolean;
  loose: boolean;
  /** Findings at blocks where none was expected. */
  collateral: number;
}

function score(c: CheckCase, a: CheckAnswer): Score {
  const verdict = (i: number) => a.blocks.find((b) => b.block === i + 1)?.verdict ?? 'ok';
  const wrongAt = (i: number) => verdict(i) !== 'ok';
  const orderAt = (i: number) => a.order.some((o) => o.block === i + 1);
  const expected = new Set(c.expectAt);
  const collateral =
    c.blocks.filter((_, i) => !expected.has(i) && wrongAt(i)).length + a.order.filter((o) => !expected.has(o.block - 1)).length;
  switch (c.kind) {
    case 'clean': {
      const any = a.blocks.some((b) => b.verdict !== 'ok') || a.order.length > 0 || a.missing.length > 0;
      // strict/loose = "no false alarm"; loose ignores "weak" verdicts.
      const offOrMove = a.blocks.some((b) => b.verdict === 'off') || a.order.length > 0 || a.missing.length > 0;
      return { strict: !any, loose: !offOrMove, collateral };
    }
    case 'swap':
      return { strict: c.expectAt.some(orderAt), loose: c.expectAt.some((i) => orderAt(i) || wrongAt(i)), collateral };
    case 'intruder':
      return { strict: verdict(c.expectAt[0]) === 'off', loose: wrongAt(c.expectAt[0]) || orderAt(c.expectAt[0]), collateral };
    case 'hollow':
      return { strict: verdict(c.expectAt[0]) === 'off', loose: wrongAt(c.expectAt[0]), collateral };
    case 'missing': {
      const name = c.expectMissing!.toLowerCase();
      const named = a.missing.some((m) => m.toLowerCase().includes(name) || name.includes(m.toLowerCase().trim()));
      return { strict: named, loose: named || a.missing.length > 0, collateral };
    }
  }
}

async function runCheck(report: string[]) {
  const cases = CHECK_CASES.filter(inSplit);
  const agg: Record<string, { strict: number; loose: number; collateral: number; invalid: number; n: number }> = {};
  const rows: string[] = [];
  const reading: string[] = [];
  const times: number[] = [];
  for (const c of cases) {
    for (let r = 0; r < ROUNDS; r++) {
      const a = await ask<CheckAnswer>(CHECK_SYSTEM, checkPrompt(c.blocks, c.plan), CHECK_SCHEMA, 3000);
      times.push(a.ms);
      const key = `${c.kind} · ${c.withPlan ? 'plan' : 'no plan'} · ${c.doc.split}`;
      const t = (agg[key] ??= { strict: 0, loose: 0, collateral: 0, invalid: 0, n: 0 });
      t.n++;
      if (!a.value?.blocks) {
        t.invalid++;
        rows.push(`| ${c.doc.language} ${c.doc.id} | ${c.kind} | ${c.withPlan ? 'plan' : '—'} | invalid | | | ${sec(a.ms)} |`);
        continue;
      }
      const s = score(c, a.value);
      t.strict += +s.strict;
      t.loose += +s.loose;
      t.collateral += s.collateral;
      const findings = [
        ...a.value.blocks.filter((b) => b.verdict !== 'ok').map((b) => `${b.block}:${b.verdict}`),
        ...a.value.order.map((o) => `move ${o.block}→before ${o.before}`),
        ...a.value.missing.map((m) => `missing "${m}"`)
      ];
      rows.push(
        `| ${c.doc.language} ${c.doc.id} | ${c.kind} | ${c.withPlan ? 'plan' : '—'} | ${s.strict ? '✓' : '✗'}${s.loose ? '' : ' (loose ✗)'} | ${c.expectAt.map((i) => i + 1).join(',') || c.expectMissing || '—'} | ${findings.join('; ') || 'none'} | ${sec(a.ms)} |`
      );
      if (r === 0 && c.withPlan && c.kind !== 'clean' && reading.length < 400)
        reading.push(
          `**${c.doc.language} ${c.doc.id} · ${c.kind}** (expected at ${c.expectAt.map((i) => i + 1).join(',') || c.expectMissing})`,
          '',
          ...a.value.thread.map((g, i) => `${i + 1}. ${g}`),
          ...a.value.blocks.filter((b) => b.verdict !== 'ok').map((b) => `- block ${b.block} ${b.verdict}: ${b.reason}`),
          ...a.value.order.map((o) => `- move ${o.block} before ${o.before}: ${o.reason}`),
          ...a.value.missing.map((m) => `- missing: ${m}`),
          ''
        );
    }
  }
  const kinds: Perturbation[] = ['clean', 'swap', 'intruder', 'missing', 'hollow'];
  report.push(
    '## Red thread',
    '',
    'Pass: each perturbation except hollow found at the right block ≥ 70 % (strict); clean texts with any finding ≤ 20 %.',
    'For **clean** the columns count texts *without* a false alarm (strict: no finding at all; loose: "weak" verdicts ignored).',
    'swap strict = a move proposed for a swapped block, loose = or a non-ok verdict there. intruder/hollow strict = "off" there, loose = "weak" too.',
    'missing strict = the removed part named, loose = anything listed as missing.',
    '',
    '| kind · plan · split | strict | loose | collateral findings | invalid |',
    '| --- | --- | --- | --- | --- |',
    ...Object.entries(agg)
      .sort(([a], [b]) => kinds.indexOf(a.split(' ')[0] as Perturbation) - kinds.indexOf(b.split(' ')[0] as Perturbation) || a.localeCompare(b))
      .map(([k, t]) => `| ${k} | ${pct(t.strict, t.n)} | ${pct(t.loose, t.n)} | ${t.collateral} | ${t.invalid} |`),
    '',
    `Median ${sec(median(times))} per text.`,
    '',
    '| text | kind | plan | found | expected at | findings | time |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    ...rows,
    '',
    '### Red thread and reasons (first round, with plan, for reading)',
    '',
    ...reading
  );
}

// --- Latency ---------------------------------------------------------------

async function runLatency(report: string[]) {
  // ~1 500 words: seven German templates back to back.
  const ids = ['blog-article', 'newsletter', 'essay', 'video-script', 'cover-letter', 'meeting-notes', 'linkedin-post'];
  const blocks = ids.flatMap((id) => DOCS.find((d) => d.language === 'de' && d.id === id)!.blocks);
  const units = blocks.flatMap((b) => b.units);
  await ask(SEGMENT_SYSTEM, 'Units:\n[1] Warm-up.', SEGMENT_SCHEMA, 50);
  const seg = await segment(units);
  const check = await ask<CheckAnswer>(CHECK_SYSTEM, checkPrompt(blocks, []), CHECK_SCHEMA, 6000);
  report.push(
    '## Latency (warm model)',
    '',
    `${wordCount(units)} words, ${units.length} units, ${blocks.length} blocks.`,
    '',
    `- segmentation: ${sec(seg.ms)} (${seg.value ? `${seg.value.blocks.length} blocks${validStarts(seg.value, units.length) ? '' : ', invalid'}` : 'no JSON'})`,
    `- red-thread check: ${sec(check.ms)} (${check.value ? `${check.value.thread.length} gist lines` : 'no JSON'})`,
    ''
  );
}

it('structure', async () => {
  const report = [`# Structure bench — ${MODEL}, ${ROUNDS} round(s), split: ${SPLIT}, segmentation: ${STRATEGY}`, ''];
  if (TASKS.includes('latency')) await runLatency(report);
  if (TASKS.includes('segment')) await runSegment(report);
  writeFileSync(OUT, report.join('\n'));
  if (TASKS.includes('check')) await runCheck(report);
  writeFileSync(OUT, report.join('\n'));
  console.log(`report: ${OUT}`);
}, 6 * 3600_000);
