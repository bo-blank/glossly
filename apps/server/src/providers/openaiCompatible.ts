import { AI_LIKENESS_JSON_SCHEMA, AI_LIKENESS_LABELS, buildAiLikenessMessages, buildMessages, SUGGESTIONS_JSON_SCHEMA } from './prompt';
import { extractSuggestions } from './streamParse';
import {
  AiLikenessRequest,
  AiLikenessResult,
  LLMProvider,
  SuggestError,
  SuggestionRequest,
  SuggestionStreamEvent
} from './types';

/**
 * Reasoning models (gemma4, qwen3.x, ...) emit a thinking pass before the answer.
 * None of it reaches the user — Glossly strips it — but we pay for it in latency.
 * Measured 2026-09-20 on gemma4-e2b-qat with this exact request shape (3 German
 * suggestions, JSON schema): 4.61s avg with thinking, 0.67s avg without. Same output
 * quality. See docs/local-model-notes.md.
 *
 * llama.cpp honours this; providers that do not recognise it ignore the extra key.
 *
 * Only the reasoning *budget* is sent — deliberately NOT `enable_thinking: false`.
 * Measured 2026-09-24 on gemma4-e2b-qat (Google's official Gemma-4 template):
 *   - `enable_thinking: false`: the template no longer suppresses the thought
 *     channel, so the model thinks anyway, and llama.cpp — believing thinking is
 *     off — tracks no thinking tags and enforces no budget. 14/20 requests
 *     thought; 7/20 hit max_tokens with EMPTY content.
 *   - `thinking_budget_tokens: 0` alone: llama.cpp closes the thought block
 *     itself, whatever the template does. 0/20 thought, 20/20 valid, ~0.55s.
 * Sending both combines the failure of the first with nothing of the second.
 */
const NO_THINKING = { thinking_budget_tokens: 0 } as const;

/**
 * Hard ceiling on generation. Without it a degenerate run has nothing to stop it: on
 * 2026-09-20 a streamed suggestion request reached 35,757 tokens and was still going,
 * heading for the model's full 65,536-token context. Because llama-server runs with
 * --parallel 1, that one request blocked every other call for minutes — aborting the
 * browser request does NOT stop the upstream generation.
 *
 * Normal completions here are 50-90 tokens, so these caps are ~4x headroom, not a
 * constraint on real answers.
 */
const MAX_TOKENS_SUGGESTIONS = 400;
const MAX_TOKENS_AI_LIKENESS = 600;

function stripReasoning(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
}

/**
 * Why a completion carried no usable answer, in words that point at the fix.
 * "Empty response" alone sent us hunting on 2026-09-24: the real cause was a
 * reasoning model spending all of max_tokens on its thought channel.
 */
export function noAnswerMessage(finishReason: string | null | undefined, sawReasoning: boolean): string {
  if (finishReason === 'length' && sawReasoning) {
    return 'The model used up its token limit while thinking and never answered. Turn reasoning off for this model (e.g. `-rea off` in llama-swap) or pick a non-reasoning model.';
  }
  if (finishReason === 'length') {
    return 'The model hit its token limit before finishing its answer.';
  }
  return 'Local model server returned an empty response.';
}

function extractJsonPayload(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return (fenced ? fenced[1] : text).trim();
}

function parseSuggestions(raw: string): string[] {
  const cleaned = extractJsonPayload(stripReasoning(raw));
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new SuggestError('bad_response', 'Model did not return valid JSON.');
  }

  const suggestions = Array.isArray(parsed)
    ? parsed
    : Array.isArray((parsed as { suggestions?: unknown })?.suggestions)
      ? (parsed as { suggestions: unknown[] }).suggestions
      : null;

  if (!suggestions || !suggestions.every((s) => typeof s === 'string')) {
    throw new SuggestError('bad_response', 'Model response was not an array of 3 strings.');
  }

  // Small local models don't always respect minItems/maxItems — trim overshoot,
  // but treat an empty list as a failure rather than rendering an empty note.
  const nonEmpty = cleanSuggestions(suggestions as string[]);
  if (nonEmpty.length === 0) {
    throw new SuggestError('bad_response', 'Model returned no usable suggestions.');
  }

  return nonEmpty.slice(0, 3);
}

function cleanSuggestions(raw: string[]): string[] {
  return raw.map((s) => s.trim()).filter(Boolean);
}

function parseAiLikeness(raw: string): AiLikenessResult {
  const cleaned = extractJsonPayload(stripReasoning(raw));
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new SuggestError('bad_response', 'Model did not return valid JSON.');
  }

  const obj = parsed as { score?: unknown; label?: unknown; rationale?: unknown };
  if (typeof obj?.score !== 'number' || typeof obj?.rationale !== 'string') {
    throw new SuggestError('bad_response', 'Model response was missing a score or rationale.');
  }

  const score = Math.max(0, Math.min(100, obj.score));
  const label = AI_LIKENESS_LABELS.includes(obj.label as (typeof AI_LIKENESS_LABELS)[number])
    ? (obj.label as string)
    : 'Mixed / uncertain';

  return { score, label, rationale: obj.rationale };
}

export const openAICompatibleProvider: LLMProvider = {
  id: 'openai-compatible',
  label: 'OpenAI-compatible (local)',

  async getSuggestions(input: SuggestionRequest): Promise<string[]> {
    const { selectedText, context, modifier, modifierInstruction, mode, previousSuggestions, model, baseUrl, apiKey, timeout, signal } = input;

    const timeoutController = new AbortController();
    const timer = setTimeout(() => timeoutController.abort(), timeout);
    signal.addEventListener('abort', () => timeoutController.abort());

    let response: Response;
    try {
      response = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {})
        },
        body: JSON.stringify({
          model,
          messages: buildMessages(selectedText, context, modifier, previousSuggestions, modifierInstruction, mode),
          response_format: { type: 'json_schema', json_schema: SUGGESTIONS_JSON_SCHEMA },
          temperature: 0.8,
          max_tokens: MAX_TOKENS_SUGGESTIONS,
          ...NO_THINKING
        }),
        signal: timeoutController.signal
      });
    } catch (err) {
      if (timeoutController.signal.aborted && !signal.aborted) {
        throw new SuggestError('timeout', 'The local model took too long to respond.');
      }
      if (signal.aborted) {
        throw err; // superseded request — let the caller treat this as an abort, not a failure
      }
      throw new SuggestError('connection_refused', `Could not reach ${baseUrl}. Is the local server running?`);
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      throw new SuggestError('bad_response', `Local model server responded with ${response.status}.`);
    }

    const body = await response.json();
    const choice = body?.choices?.[0];
    const content: string | undefined = choice?.message?.content;
    if (!content) {
      throw new SuggestError('bad_response', noAnswerMessage(choice?.finish_reason, Boolean(choice?.message?.reasoning_content)));
    }

    return parseSuggestions(content);
  },

  async streamSuggestions(input: SuggestionRequest, emit: (event: SuggestionStreamEvent) => void): Promise<string[]> {
    const { selectedText, context, modifier, modifierInstruction, mode, previousSuggestions, model, baseUrl, apiKey, timeout, signal } = input;

    const timeoutController = new AbortController();
    // Idle timeout: every chunk received off the wire proves the upstream is still
    // alive and pushes the deadline back out, so a slow-but-steady stream isn't killed —
    // only a stall (no bytes for `timeout` ms) trips it.
    let timer = setTimeout(() => timeoutController.abort(), timeout);
    const resetIdleTimer = () => {
      clearTimeout(timer);
      timer = setTimeout(() => timeoutController.abort(), timeout);
    };
    signal.addEventListener('abort', () => timeoutController.abort());

    let response: Response;
    try {
      response = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {})
        },
        body: JSON.stringify({
          model,
          messages: buildMessages(selectedText, context, modifier, previousSuggestions, modifierInstruction, mode),
          response_format: { type: 'json_schema', json_schema: SUGGESTIONS_JSON_SCHEMA },
          temperature: 0.8,
          stream: true,
          max_tokens: MAX_TOKENS_SUGGESTIONS,
          ...NO_THINKING
        }),
        signal: timeoutController.signal
      });
    } catch (err) {
      clearTimeout(timer);
      if (timeoutController.signal.aborted && !signal.aborted) {
        throw new SuggestError('timeout', 'The local model took too long to respond.');
      }
      if (signal.aborted) {
        throw err; // superseded request — let the caller treat this as an abort, not a failure
      }
      throw new SuggestError('connection_refused', `Could not reach ${baseUrl}. Is the local server running?`);
    }

    if (!response.ok) {
      clearTimeout(timer);
      throw new SuggestError('bad_response', `Local model server responded with ${response.status}.`);
    }
    if (!response.body) {
      clearTimeout(timer);
      throw new SuggestError('bad_response', 'Local model server returned an empty stream.');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let lineRemainder = '';
    let contentBuffer = '';
    let emittedCount = 0;
    let sawReasoning = false;
    let finishReason: string | null = null;

    try {
      // eslint-disable-next-line no-constant-condition
      while (true) {
        let next: ReadableStreamReadResult<Uint8Array>;
        try {
          next = await reader.read();
        } catch (err) {
          if (timeoutController.signal.aborted && !signal.aborted) {
            throw new SuggestError('timeout', 'The local model took too long to respond.');
          }
          if (signal.aborted) throw err;
          throw new SuggestError('connection_refused', `Could not reach ${baseUrl}. Is the local server running?`);
        }
        if (next.done) break;
        resetIdleTimer();

        lineRemainder += decoder.decode(next.value, { stream: true });
        const lines = lineRemainder.split('\n');
        lineRemainder = lines.pop() ?? '';

        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine.startsWith('data:')) continue;
          const data = trimmedLine.slice('data:'.length).trim();
          if (data === '[DONE]') continue;

          let parsed: unknown;
          try {
            parsed = JSON.parse(data);
          } catch {
            continue; // stray keepalive or partial frame — ignore
          }

          const choice = (parsed as { choices?: { delta?: { content?: unknown; reasoning_content?: unknown }; finish_reason?: string | null }[] })
            ?.choices?.[0];
          if (choice?.finish_reason) finishReason = choice.finish_reason;
          const delta = choice?.delta;
          if (typeof delta?.reasoning_content === 'string' && delta.reasoning_content) sawReasoning = true;
          if (typeof delta?.content !== 'string') continue;

          contentBuffer += delta.content;
          const cleaned = cleanSuggestions(extractSuggestions(contentBuffer).suggestions);
          while (emittedCount < cleaned.length && emittedCount < 3) {
            emit({ type: 'suggestion', index: emittedCount, text: cleaned[emittedCount] });
            emittedCount++;
          }
        }
      }
    } finally {
      clearTimeout(timer);
    }

    const finalSuggestions = cleanSuggestions(extractSuggestions(contentBuffer).suggestions);
    if (finalSuggestions.length === 0) {
      throw new SuggestError(
        'bad_response',
        finishReason === 'length' ? noAnswerMessage(finishReason, sawReasoning) : 'Model returned no usable suggestions.'
      );
    }
    return finalSuggestions.slice(0, 3);
  },

  async getAiLikeness(input: AiLikenessRequest): Promise<AiLikenessResult> {
    const { text, model, baseUrl, apiKey, timeout, signal } = input;

    const timeoutController = new AbortController();
    const timer = setTimeout(() => timeoutController.abort(), timeout);
    signal.addEventListener('abort', () => timeoutController.abort());

    let response: Response;
    try {
      response = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {})
        },
        body: JSON.stringify({
          model,
          messages: buildAiLikenessMessages(text),
          response_format: { type: 'json_schema', json_schema: AI_LIKENESS_JSON_SCHEMA },
          temperature: 0.3,
          max_tokens: MAX_TOKENS_AI_LIKENESS,
          ...NO_THINKING
        }),
        signal: timeoutController.signal
      });
    } catch (err) {
      if (timeoutController.signal.aborted && !signal.aborted) {
        throw new SuggestError('timeout', 'The local model took too long to respond.');
      }
      if (signal.aborted) {
        throw err; // superseded request — let the caller treat this as an abort, not a failure
      }
      throw new SuggestError('connection_refused', `Could not reach ${baseUrl}. Is the local server running?`);
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      throw new SuggestError('bad_response', `Local model server responded with ${response.status}.`);
    }

    const body = await response.json();
    const choice = body?.choices?.[0];
    const content: string | undefined = choice?.message?.content;
    if (!content) {
      throw new SuggestError('bad_response', noAnswerMessage(choice?.finish_reason, Boolean(choice?.message?.reasoning_content)));
    }

    return parseAiLikeness(content);
  }
};
