// Context-budget bench (Phase 3 WP1). Sends each sample at several context
// budgets to a real local model and writes timings plus every answer to a
// Markdown file, for a person to judge. There is no automatic quality score:
// reading the answers side by side is the measurement.
//
//   BENCH_URL    default http://127.0.0.1:8080/v1
//   BENCH_MODEL  default gemma4-e2b-qat
//   BENCH_ROUNDS default 5 (timings are medians; every round's answers are listed)
//   BENCH_OUT    default <tmpdir>/glossly-bench-context.md

import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getSchema } from '@tiptap/core';
import type { Node as PMNode } from 'prosemirror-model';
import { it } from 'vitest';
import { buildMessages, SUGGESTIONS_JSON_SCHEMA } from '../../server/src/providers/prompt';
import { MAX_TOKENS_SUGGESTIONS, NO_THINKING } from '../../server/src/providers/openaiCompatible';
import { fromMarkdown } from '../src/editor/markdown';
import { schemaExtensions } from '../src/editor/schemaExtensions';
import { extractContext, type SuggestionContext } from '../src/note/contextExtraction';
import { BENCH_CASES } from './bench-samples';

const URL = process.env.BENCH_URL ?? 'http://127.0.0.1:8080/v1';
const MODEL = process.env.BENCH_MODEL ?? 'gemma4-e2b-qat';
const ROUNDS = Number(process.env.BENCH_ROUNDS ?? 5);
const OUT = process.env.BENCH_OUT ?? join(tmpdir(), 'glossly-bench-context.md');
const CONFIGS = ['legacy', 2000, 4000, 8000] as const;
type Config = (typeof CONFIGS)[number];

const schema = getSchema(schemaExtensions);

/** The pre-Phase-3 extraction: the selection's block ±1, as one string cut at 2000 chars. */
function legacyContext(doc: PMNode, from: number): string {
  const blocks: PMNode[] = [];
  let current = -1;
  doc.forEach((node, offset) => {
    if (from >= offset && from <= offset + node.nodeSize) current = blocks.length;
    blocks.push(node);
  });
  const parts: string[] = [];
  for (let i = Math.max(0, current - 1); i <= Math.min(blocks.length - 1, current + 1); i++) {
    const text = blocks[i]?.textContent?.trim();
    if (text) parts.push(text);
  }
  return parts.join('\n\n').slice(0, 2000);
}

function locate(doc: PMNode, text: string): { from: number; to: number } {
  let hit: number | null = null;
  doc.descendants((node, pos) => {
    if (hit === null && node.isText && node.text!.includes(text)) hit = pos + node.text!.indexOf(text);
  });
  if (hit === null) throw new Error(`selection not found: ${text}`);
  return { from: hit, to: hit + text.length };
}

function firstHeading(doc: PMNode): string {
  let title = '';
  doc.forEach((node) => {
    if (!title && node.type.name === 'heading') title = node.textContent.trim();
  });
  return title;
}

interface Result {
  wallMs: number;
  promptTokens: number;
  promptMs: number;
  genMs: number;
  suggestions: string[];
  error?: string;
}

async function ask(selection: string, context: string | SuggestionContext, modifier?: string): Promise<Result> {
  const start = performance.now();
  try {
    const response = await fetch(`${URL}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        messages: buildMessages(selection, context, modifier),
        response_format: { type: 'json_schema', json_schema: SUGGESTIONS_JSON_SCHEMA },
        temperature: 0.8,
        max_tokens: MAX_TOKENS_SUGGESTIONS,
        ...NO_THINKING
      })
    });
    const body = await response.json();
    const wallMs = performance.now() - start;
    const content: string = body.choices?.[0]?.message?.content ?? '';
    let suggestions: string[] = [];
    try {
      suggestions = JSON.parse(content).suggestions ?? [];
    } catch {
      return { wallMs, promptTokens: 0, promptMs: 0, genMs: 0, suggestions: [], error: `unparseable: ${content.slice(0, 120)}` };
    }
    return {
      wallMs,
      promptTokens: body.usage?.prompt_tokens ?? 0,
      promptMs: body.timings?.prompt_ms ?? 0,
      genMs: body.timings?.predicted_ms ?? 0,
      suggestions
    };
  } catch (err) {
    return { wallMs: performance.now() - start, promptTokens: 0, promptMs: 0, genMs: 0, suggestions: [], error: String(err) };
  }
}

const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] ?? 0;
const pct = (xs: number[], p: number) => [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.ceil((p / 100) * xs.length) - 1)] ?? 0;
const ms = (n: number) => `${Math.round(n)}`;

it('context budget bench', async () => {
  const cases = BENCH_CASES.map((c) => {
    const doc = fromMarkdown(c.doc, schema);
    const { from, to } = locate(doc, c.selection);
    const title = firstHeading(doc);
    const contexts = new Map<Config, string | SuggestionContext>(
      CONFIGS.map((cfg) => [cfg, cfg === 'legacy' ? legacyContext(doc, from) : extractContext(doc, from, to, title, cfg)])
    );
    return { ...c, contexts };
  });

  // Warm-up: the first call may load the model.
  await ask('a quick test', 'This is a quick test.');

  const results = new Map<string, Result[]>();
  for (let round = 0; round < ROUNDS; round++) {
    // Interleave configs so no config always follows itself in the prompt cache.
    for (const cfg of CONFIGS) {
      for (const [i, c] of cases.entries()) {
        const r = await ask(c.selection, c.contexts.get(cfg)!, c.modifier);
        const key = `${i}:${cfg}`;
        results.set(key, [...(results.get(key) ?? []), r]);
      }
    }
  }

  const lines: string[] = [
    `# Context budget bench — ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`,
    '',
    `Model \`${MODEL}\` at ${URL}, ${ROUNDS} rounds, times are medians in ms. "legacy" is the pre-Phase-3 extraction (±1 block, flat string).`,
    '',
    '## Summary',
    '',
    '| config | median wall | p95 wall | median prompt tokens | wrong address form | errors |',
    '| --- | --- | --- | --- | --- | --- |'
  ];
  // Answers that break a case's objective rule, over every round.
  const violations = (cfg: Config) =>
    cases.reduce((n, c, i) => {
      if (!c.forbid) return n;
      return n + results.get(`${i}:${cfg}`)!.flatMap((r) => r.suggestions).filter((s) => c.forbid!.test(s)).length;
    }, 0);
  const checked = cases.filter((c) => c.forbid).length * ROUNDS * 3;
  for (const cfg of CONFIGS) {
    const all = cases.flatMap((_, i) => results.get(`${i}:${cfg}`)!);
    const ok = all.filter((r) => !r.error);
    lines.push(
      `| ${cfg} | ${ms(median(ok.map((r) => r.wallMs)))} | ${ms(pct(ok.map((r) => r.wallMs), 95))} | ${median(ok.map((r) => r.promptTokens))} | ${violations(cfg)} / ${checked} | ${all.length - ok.length} |`
    );
  }

  for (const [i, c] of cases.entries()) {
    lines.push('', `## ${i + 1}. “${c.selection}”${c.modifier ? ` — ${c.modifier}` : ''}`, '', `Watch for: ${c.watch}`, '');
    lines.push('| config | context chars | prompt tokens | prompt ms | gen ms | wall ms |', '| --- | --- | --- | --- | --- | --- |');
    for (const cfg of CONFIGS) {
      const rs = results.get(`${i}:${cfg}`)!.filter((r) => !r.error);
      const ctx = c.contexts.get(cfg)!;
      const chars = typeof ctx === 'string' ? ctx.length : ctx.title.length + ctx.headingPath.join('').length + ctx.before.length + ctx.after.length;
      lines.push(
        `| ${cfg} | ${chars} | ${median(rs.map((r) => r.promptTokens))} | ${ms(median(rs.map((r) => r.promptMs)))} | ${ms(median(rs.map((r) => r.genMs)))} | ${ms(median(rs.map((r) => r.wallMs)))} |`
      );
    }
    lines.push('');
    for (const cfg of CONFIGS) {
      const rounds = results.get(`${i}:${cfg}`)!;
      const errors = rounds.filter((r) => r.error).length;
      lines.push(`**${cfg}**${errors ? ` — ⚠ ${errors} failed` : ''}`, '');
      rounds.forEach((r, round) => {
        for (const s of r.suggestions) lines.push(`- ${c.forbid?.test(s) ? '❌ ' : ''}${s} *(r${round + 1})*`);
      });
      lines.push('');
    }
  }

  writeFileSync(OUT, lines.join('\n'));
  console.log(`bench written to ${OUT}`);
});
