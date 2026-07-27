import { Router } from 'express';
import { openAICompatibleProvider } from '../providers/openaiCompatible';
import { LLMProvider, SuggestError } from '../providers/types';
import { resolveTimeout, validateLocalBaseUrl } from '../util/validate';

const providers: Record<string, LLMProvider> = {
  'openai-compatible': openAICompatibleProvider,
  ollama: openAICompatibleProvider,
  lmstudio: openAICompatibleProvider
};

export const suggestRouter = Router();

suggestRouter.post('/api/suggest', async (req, res) => {
  const { provider, model, baseUrl: rawBaseUrl, apiKey, selectedText, context, modifier, previousSuggestions, timeout } = req.body ?? {};

  if (typeof selectedText !== 'string' || selectedText.length < 3 || selectedText.length > 220) {
    res.status(400).json({ error: 'bad_response', message: 'selectedText must be 3-220 characters.' });
    return;
  }

  const impl = providers[provider];
  if (!impl) {
    res.status(400).json({ error: 'bad_response', message: `Unknown provider "${provider}".` });
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
    ? previousSuggestions.filter((s: unknown): s is string => typeof s === 'string').slice(0, 12)
    : undefined;

  const controller = new AbortController();
  // res (not req) 'close' only fires on an actual premature disconnect — req 'close' fires
  // as soon as the request body is fully read, which aborted every request instantly.
  res.on('close', () => {
    if (!res.writableEnded) controller.abort();
  });

  try {
    const suggestions = await impl.getSuggestions({
      selectedText,
      context: typeof context === 'string' ? context : '',
      modifier,
      previousSuggestions: previous,
      model,
      baseUrl,
      apiKey,
      timeout: resolveTimeout(timeout),
      signal: controller.signal
    });
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
