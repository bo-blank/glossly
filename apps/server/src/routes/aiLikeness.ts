import { Router } from 'express';
import type { AiLikenessRequestBody } from '@glossly/shared';
import { resolveProvider } from '../providers/registry';
import { SuggestError } from '../providers/types';
import { resolveTimeout, validateLocalBaseUrl } from '../util/validate';

export const aiLikenessRouter = Router();

const MIN_LENGTH = 100;
const MAX_LENGTH = 24000;

aiLikenessRouter.post('/api/ai-likeness', async (req, res) => {
  const { provider, model, baseUrl: rawBaseUrl, apiKey, text, timeout }: Partial<Record<keyof AiLikenessRequestBody, unknown>> = req.body ?? {};

  if (typeof text !== 'string' || text.length < MIN_LENGTH) {
    res.status(400).json({ error: 'bad_response', message: `text must be at least ${MIN_LENGTH} characters.` });
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
      timeout: resolveTimeout(timeout),
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
