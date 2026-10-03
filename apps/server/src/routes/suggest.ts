import { Router, type Response } from 'express';
import { DEFAULT_TEMPERATURE } from '../providers/openaiCompatible';
import { resolveProvider } from '../providers/registry';
import { styleDefaults } from '../providers/prompt';
import { SuggestError } from '../providers/types';
import {
  MAX_CONTEXT_CHARS,
  MAX_INSTRUCTION_CHARS,
  MAX_PHRASE_CHARS,
  MAX_PREVIOUS_SUGGESTIONS,
  MAX_SENTENCE_CHARS,
  MAX_TEMPERATURE,
  MIN_SELECTION_CHARS,
  type ModifierDefaults,
  type SuggestionMode,
  type SuggestRequestBody,
  type SuggestStreamEvents
} from '@glossly/shared';
import { parseContext, parseInstruction, parseTemperature, resolveTimeout, validateLocalBaseUrl } from '../util/validate';

function sendEvent<E extends keyof SuggestStreamEvents>(res: Response, event: E, data: SuggestStreamEvents[E]) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

function isMode(mode: unknown): mode is SuggestionMode {
  return mode === 'phrase' || mode === 'sentence';
}

// Built-in names or a custom chip's UUID.
const MAX_MODIFIER_ID_CHARS = 64;

export const suggestRouter = Router();

// The tuning UI prefills from these; they live only in prompt.ts so they cannot drift.
suggestRouter.get('/api/modifiers', (_req, res) => {
  const body: ModifierDefaults = { defaults: styleDefaults(), temperature: DEFAULT_TEMPERATURE };
  res.json(body);
});

suggestRouter.post('/api/suggest', async (req, res) => {
  const {
    provider,
    model,
    baseUrl: rawBaseUrl,
    apiKey,
    selectedText,
    context,
    modifier,
    modifierInstruction,
    instructionOverride: rawInstructionOverride,
    temperature: rawTemperature,
    mode,
    previousSuggestions,
    timeout,
    stream
  }: Partial<Record<keyof SuggestRequestBody, unknown>> = req.body ?? {};

  if (mode !== undefined && !isMode(mode)) {
    res.status(400).json({ error: 'bad_response', message: 'mode must be "phrase" or "sentence".' });
    return;
  }
  const maxLength = mode === 'sentence' ? MAX_SENTENCE_CHARS : MAX_PHRASE_CHARS;

  if (typeof selectedText !== 'string' || selectedText.length < MIN_SELECTION_CHARS || selectedText.length > maxLength) {
    res.status(400).json({ error: 'bad_response', message: `selectedText must be ${MIN_SELECTION_CHARS}-${maxLength} characters.` });
    return;
  }

  if (modifierInstruction !== undefined && (typeof modifierInstruction !== 'string' || modifierInstruction.length > MAX_INSTRUCTION_CHARS)) {
    res.status(400).json({ error: 'bad_response', message: `modifierInstruction must be a string of at most ${MAX_INSTRUCTION_CHARS} characters.` });
    return;
  }

  const instructionOverride = parseInstruction(rawInstructionOverride);
  if (instructionOverride === null) {
    res.status(400).json({ error: 'bad_response', message: `instructionOverride must be a non-blank string of at most ${MAX_INSTRUCTION_CHARS} characters.` });
    return;
  }

  const temperature = parseTemperature(rawTemperature);
  if (temperature === null) {
    res.status(400).json({ error: 'bad_response', message: `temperature must be a number from 0 to ${MAX_TEMPERATURE}.` });
    return;
  }

  const parsedContext = parseContext(context);
  if (parsedContext === null) {
    res.status(400).json({
      error: 'bad_response',
      message: `context must be a string or { title, headingPath, before, after } of at most ${MAX_CONTEXT_CHARS} characters.`
    });
    return;
  }

  if (modifier !== undefined && (typeof modifier !== 'string' || !modifier || modifier.length > MAX_MODIFIER_ID_CHARS)) {
    res.status(400).json({ error: 'bad_response', message: `modifier must be a chip id of at most ${MAX_MODIFIER_ID_CHARS} characters.` });
    return;
  }

  const impl = resolveProvider(provider);
  if (!impl) {
    res.status(400).json({ error: 'bad_response', message: `Unknown provider "${String(provider)}".` });
    return;
  }

  if (apiKey !== undefined && typeof apiKey !== 'string') {
    res.status(400).json({ error: 'bad_response', message: 'apiKey must be a string.' });
    return;
  }

  const baseUrl = validateLocalBaseUrl(rawBaseUrl);
  if (!baseUrl) {
    res.status(400).json({ error: 'bad_response', message: 'baseUrl must be a valid http(s) URL on a local or private-network host.' });
    return;
  }

  if (typeof model !== 'string' || !model) {
    res.status(400).json({ error: 'bad_response', message: 'model is required.' });
    return;
  }

  const previous = Array.isArray(previousSuggestions)
    ? previousSuggestions.filter((s: unknown): s is string => typeof s === 'string').slice(0, MAX_PREVIOUS_SUGGESTIONS)
    : undefined;

  const controller = new AbortController();
  // res (not req) 'close' only fires on an actual premature disconnect — req 'close' fires
  // as soon as the request body is fully read, which aborted every request instantly.
  res.on('close', () => {
    if (!res.writableEnded) controller.abort();
  });

  const requestInput = {
    selectedText,
    context: parsedContext,
    modifier,
    modifierInstruction,
    instructionOverride,
    temperature,
    mode,
    previousSuggestions: previous,
    model,
    baseUrl,
    apiKey,
    timeout: resolveTimeout(timeout),
    signal: controller.signal
  };

  if (stream === true) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive'
    });
    res.flushHeaders();

    try {
      const suggestions = await impl.streamSuggestions(requestInput, (event) => {
        if (event.type === 'status') sendEvent(res, 'status', event.status);
        else sendEvent(res, 'suggestion', { index: event.index, text: event.text });
      });
      sendEvent(res, 'done', { suggestions });
      res.end();
    } catch (err) {
      if (controller.signal.aborted) {
        res.end();
        return; // client disconnected/superseded the request — nothing more to send
      }
      const { kind, message } =
        err instanceof SuggestError ? { kind: err.kind, message: err.message } : { kind: 'bad_response' as const, message: (err as Error).message };
      sendEvent(res, 'error', { error: kind, message });
      res.end();
    }
    return;
  }

  try {
    const suggestions = await impl.getSuggestions(requestInput);
    res.json({ suggestions });
  } catch (err) {
    if (controller.signal.aborted) {
      return; // client disconnected/superseded the request — nothing to respond with
    }
    if (err instanceof SuggestError) {
      res.status(502).json({ error: err.kind, message: err.message });
      return;
    }
    res.status(500).json({ error: 'bad_response', message: (err as Error).message });
  }
});
