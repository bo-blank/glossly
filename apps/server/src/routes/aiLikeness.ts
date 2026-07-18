import { Router } from 'express';
import { openAICompatibleProvider } from '../providers/openaiCompatible';
import { LLMProvider, SuggestError } from '../providers/types';

const providers: Record<string, LLMProvider> = {
  'openai-compatible': openAICompatibleProvider,
  ollama: openAICompatibleProvider,
  lmstudio: openAICompatibleProvider
};

export const aiLikenessRouter = Router();

const MIN_LENGTH = 100;
const MAX_LENGTH = 24000;

aiLikenessRouter.post('/api/ai-likeness', async (req, res) => {
  const { provider, model, baseUrl, apiKey, text } = req.body ?? {};

  if (typeof text !== 'string' || text.length < MIN_LENGTH) {
    res.status(400).json({ error: 'bad_response', message: `text must be at least ${MIN_LENGTH} characters.` });
    return;
  }

  const impl = providers[provider];
  if (!impl) {
    res.status(400).json({ error: 'bad_response', message: `Unknown provider "${provider}".` });
    return;
  }

  const truncated = text.length > MAX_LENGTH ? text.slice(0, MAX_LENGTH) : text;

  const controller = new AbortController();
  // res (not req) 'close' only fires on an actual premature disconnect — req 'close' fires
  // as soon as the request body is fully read, which aborted every request instantly.
  res.on('close', () => {
    if (!res.writableEnded) controller.abort();
  });

  try {
    const result = await impl.getAiLikeness({
      text: truncated,
      model,
      baseUrl,
      apiKey,
      timeout: Number(process.env.REQUEST_TIMEOUT) || 10000,
      signal: controller.signal
    });
    res.json(result);
  } catch (err) {
    if (controller.signal.aborted) {
      return; // client disconnected/superseded the request — nothing to respond with
    }
    if (err instanceof SuggestError) {
      res.status(err.kind === 'not_implemented' ? 501 : 502).json({ error: err.kind, message: err.message });
      return;
    }
    res.status(500).json({ error: 'bad_response', message: (err as Error).message });
  }
});
