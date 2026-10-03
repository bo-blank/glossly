import { countWord } from '@glossly/shared';
import type { Modifier, SuggestionContext, SuggestionMode } from './types';

const MODIFIER_INSTRUCTIONS: Record<string, string> = {
  tighter: 'Make each alternative more concise than the original — cut words without losing meaning.',
  vivid: 'Make each alternative more vivid and sensory than the original, without becoming purple prose.',
  plain: 'Make each alternative plainer and more direct than the original — simpler words, less ornamentation.',
  more: 'Give 3 different alternative phrasings than before — avoid repeating the same wording or ideas.'
};

/** The built-in style chips' default instructions, for the client's tuning UI. "more" is an action, not a style. */
export function styleDefaults(): Record<string, string> {
  const { more: _more, ...styles } = MODIFIER_INSTRUCTIONS;
  return styles;
}

// The system prompt is English, which small local models otherwise take as a hint
// to answer in English even for a German selection. State the rule explicitly.
const LANGUAGE_RULE = `Write every alternative in the same language as the selected text, and keep the form of
address and register the context uses (for example formal "Sie" vs. informal "du" in German).`;

// Tells the model which occurrence is meant when the selected words appear twice.
const MARKER_RULE = 'In the context, the selection is marked ⟦like this⟧.';

const SYSTEM_PROMPT = `You are a quiet, precise writing editor. Given a passage of surrounding context and a
phrase selected within it, propose exactly 3 alternative phrasings for the selected phrase that fit the
surrounding tone, register, and rhythm. Alternatives must be able to replace the selection in place —
same rough length and grammatical role, not a summary or expansion. Return only the phrasing itself, no
quotation marks, no explanation, no preamble. ${MARKER_RULE}
${LANGUAGE_RULE}`;

const SENTENCE_SYSTEM_PROMPT = `You are a quiet, precise writing editor. Given a passage of surrounding context and
one or more complete sentences selected within it, propose exactly 3 alternative ways to write those sentence(s).
Preserve the original meaning, tense, and grammatical person, and keep to roughly the same length — restructuring
the sentence (reordering clauses, changing sentence boundaries within the selection) is allowed as long as the
meaning and length stay close to the original. Return only the rewritten sentence(s), no quotation marks, no
explanation, no preamble. ${MARKER_RULE}
${LANGUAGE_RULE}`;

/**
 * Most stable first — title, then section, then the passage. llama-server reuses
 * the KV cache for the longest unchanged prompt prefix, so what changes least
 * between two selections belongs nearest the (fixed) system prompt.
 */
// Stated, not left to inference: a small model does not reliably pick the form
// of address up from the context. Conditional on purpose — it must not tempt
// the model into addressing anyone the original did not.
const ADDRESS_RULES = {
  du: 'Form of address: the text uses informal "du". If an alternative addresses someone, use "du" (dich, dir, dein), never "Sie".',
  Sie: 'Form of address: the text uses formal "Sie". If an alternative addresses someone, use "Sie" (Ihnen, Ihr), never "du".'
} as const;

// Stopwords that are common in one language and (near) absent in the other.
const STOPWORDS = {
  German: new Set(['der', 'die', 'das', 'und', 'ist', 'nicht', 'ich', 'du', 'sie', 'wir', 'mit', 'auf', 'für', 'ein', 'eine', 'den', 'dem', 'zu', 'von', 'sich', 'auch', 'bei', 'dass', 'sind', 'wie', 'noch', 'aber', 'mich', 'dich', 'haben', 'wird']),
  English: new Set(['the', 'and', 'is', 'not', 'we', 'you', 'with', 'for', 'to', 'of', 'that', 'are', 'be', 'this', 'it', 'on', 'should', 'have', 'will', 'our', 'your', 'at', 'but', 'was', 'can', 'would', 'they', 'my', 'from', 'next'])
} as const;

/**
 * German or English, only when clear (≥2 hits and 2:1). A style instruction in
 * one language pulled e2b's output into that language — a German "förmlicher"
 * chip turned 12/15 English alternatives German. Naming the language fixed it.
 */
export function detectLanguage(text: string): 'German' | 'English' | null {
  const words = text.toLowerCase().match(/[a-zäöüß']+/g) ?? [];
  const de = words.filter((w) => STOPWORDS.German.has(w)).length;
  const en = words.filter((w) => STOPWORDS.English.has(w)).length;
  if (de >= 2 && de >= 2 * en) return 'German';
  if (en >= 2 && en >= 2 * de) return 'English';
  return null;
}

function renderContext(context: string | SuggestionContext, selectedText: string): string[] {
  if (typeof context === 'string') return [`Context:\n${context}`];
  return [
    context.title ? `Document: ${context.title}` : null,
    context.headingPath.length ? `Section: ${context.headingPath.join(' › ')}` : null,
    context.address ? ADDRESS_RULES[context.address] : null,
    `Context:\n${context.before}⟦${selectedText}⟧${context.after}`
  ].filter((part): part is string => part !== null);
}

/**
 * "Exactly as written" alone did not stop e2b from collapsing a deliberate
 * repetition ("wartete und wartete" lost it in 86/90 suggestions), so a
 * repeated word gets its count stated.
 */
function protectedLine(terms: string[], selectedText: string): string {
  const listed = terms.map((t) => {
    const n = countWord(t, selectedText);
    return n > 1 ? `"${t}" (${n} times — the repetition is deliberate)` : `"${t}"`;
  });
  return `Keep these words exactly as written, in every alternative: ${listed.join(', ')}.`;
}

export function buildMessages(
  selectedText: string,
  context: string | SuggestionContext,
  modifier?: Modifier | string,
  previousSuggestions?: string[],
  modifierInstruction?: string,
  mode: SuggestionMode = 'phrase',
  instructionOverride?: string,
  protectedTerms?: string[]
) {
  // Built-ins are never overridable by a custom instruction under the same id —
  // MODIFIER_INSTRUCTIONS wins whenever the modifier key matches a known built-in,
  // so a custom chip named "tighter" cannot change it. Only an explicit
  // instructionOverride (the writer's tuning) can, and never for "more", an action.
  const override = modifier && modifier !== 'more' ? instructionOverride : undefined;
  const instruction = modifier ? (override ?? MODIFIER_INSTRUCTIONS[modifier] ?? modifierInstruction) : undefined;
  // Every modifier except "more" asks for a style change, which the system prompt's
  // "fit the surrounding tone and register" would otherwise cancel out — e2b kept
  // "more formal" results as casual as the context. Language, form of address and
  // in-place fit still hold; a German selection must not turn English because the
  // instruction is.
  const isStyle = instruction !== undefined && modifier !== 'more';
  const isSentence = mode === 'sentence';
  const target = isSentence ? 'selected sentence(s)' : 'selected phrase';
  const language = isStyle
    ? detectLanguage(typeof context === 'string' ? context : `${context.before} ${selectedText} ${context.after}`)
    : null;
  const userPrompt = [
    ...renderContext(context, selectedText),
    isSentence ? `Selected sentence(s): "${selectedText}"` : `Selected phrase: "${selectedText}"`,
    language ? `Language: the text is ${language}. Every alternative must be in ${language}.` : null,
    // Names, invented terms, deliberate repetitions — the writer marked them. Only
    // those inside the selection arrive here; the client also flags a miss.
    protectedTerms?.length ? protectedLine(protectedTerms, selectedText) : null,
    isStyle
      ? `Style instruction: ${instruction}\nThis instruction takes priority over matching the tone and register of the context. Still write in the language of the ${target}, keep its form of address, and make each alternative fit in place of the selection.`
      : instruction
        ? `Additional instruction: ${instruction}`
        : null,
    previousSuggestions?.length
      ? `Already suggested earlier (do not repeat these or close variants):\n${previousSuggestions.map((s) => `- ${s}`).join('\n')}`
      : null,
    `Give exactly 3 alternative ${isSentence ? 'rewrites of' : 'phrasings for'} the ${target}${isStyle ? ', each clearly following the style instruction' : ''}.`
  ]
    .filter(Boolean)
    .join('\n\n');

  return [
    { role: 'system' as const, content: isSentence ? SENTENCE_SYSTEM_PROMPT : SYSTEM_PROMPT },
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
