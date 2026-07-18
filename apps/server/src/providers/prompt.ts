import type { Modifier } from './types';

const MODIFIER_INSTRUCTIONS: Record<string, string> = {
  tighter: 'Make each alternative more concise than the original — cut words without losing meaning.',
  vivid: 'Make each alternative more vivid and sensory than the original, without becoming purple prose.',
  plain: 'Make each alternative plainer and more direct than the original — simpler words, less ornamentation.',
  more: 'Give 3 different alternative phrasings than before — avoid repeating the same wording or ideas.'
};

const SYSTEM_PROMPT = `You are a quiet, precise writing editor. Given a passage of surrounding context and a
phrase selected within it, propose exactly 3 alternative phrasings for the selected phrase that fit the
surrounding tone, register, and rhythm. Alternatives must be able to replace the selection in place —
same rough length and grammatical role, not a summary or expansion. Return only the phrasing itself, no
quotation marks, no explanation, no preamble.`;

export function buildMessages(selectedText: string, context: string, modifier?: Modifier) {
  const instruction = modifier ? MODIFIER_INSTRUCTIONS[modifier] : undefined;
  const userPrompt = [
    `Context:\n${context}`,
    `Selected phrase: "${selectedText}"`,
    instruction ? `Additional instruction: ${instruction}` : null,
    'Give exactly 3 alternative phrasings for the selected phrase.'
  ]
    .filter(Boolean)
    .join('\n\n');

  return [
    { role: 'system' as const, content: SYSTEM_PROMPT },
    { role: 'user' as const, content: userPrompt }
  ];
}

export const SUGGESTIONS_JSON_SCHEMA = {
  name: 'suggestions',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      suggestions: {
        type: 'array',
        items: { type: 'string' },
        minItems: 3,
        maxItems: 3
      }
    },
    required: ['suggestions'],
    additionalProperties: false
  }
};

export const AI_LIKENESS_LABELS = [
  'Likely human',
  'Mixed / uncertain',
  'Likely AI-assisted',
  'Likely AI-generated'
] as const;

const AI_LIKENESS_SYSTEM_PROMPT = `You are a quiet, precise writing analyst. Given a passage of text, estimate how
likely it is that the passage was generated or heavily assisted by an AI language model, as opposed to written
unassisted by a human. Judge from stylistic tells: uniform sentence rhythm, generic phrasing, hedging, overused
transition words, lack of specific or idiosyncratic detail. Return a score from 0 (certainly human) to 100
(certainly AI), a label chosen from exactly one of: "${AI_LIKENESS_LABELS.join('", "')}", and a 1-2 sentence
rationale citing the specific tells you noticed.`;

export function buildAiLikenessMessages(text: string) {
  return [
    { role: 'system' as const, content: AI_LIKENESS_SYSTEM_PROMPT },
    { role: 'user' as const, content: `Passage:\n${text}` }
  ];
}

export const AI_LIKENESS_JSON_SCHEMA = {
  name: 'ai_likeness',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      score: { type: 'number' },
      label: { type: 'string' },
      rationale: { type: 'string' }
    },
    required: ['score', 'label', 'rationale'],
    additionalProperties: false
  }
};
