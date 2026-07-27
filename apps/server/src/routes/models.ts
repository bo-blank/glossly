import { Router } from 'express';
import { validateLocalBaseUrl } from '../util/validate';

export const modelsRouter = Router();

// POST (not GET) so the API key travels in the body, never in a query string
// where it would land in server logs and browser history.
modelsRouter.post('/api/models', async (req, res) => {
  const { baseUrl: rawBaseUrl, apiKey } = req.body ?? {};

  const baseUrl = validateLocalBaseUrl(rawBaseUrl);
  if (!baseUrl) {
    res.status(400).json({ error: 'bad_response', message: 'baseUrl must be a valid http(s) URL on a local or private-network host.' });
    return;
  }

  let response: Response;
  try {
    response = await fetch(`${baseUrl.replace(/\/$/, '')}/models`, {
      headers: typeof apiKey === 'string' && apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined
    });
  } catch {
    res.status(502).json({ error: 'connection_refused', message: `Could not reach ${baseUrl}. Is the local server running?` });
    return;
  }

  if (!response.ok) {
    res.status(502).json({ error: 'bad_response', message: `Model server responded with ${response.status}.` });
    return;
  }

  const body = await response.json().catch(() => null);
  const models = Array.isArray(body?.data)
    ? body.data.map((m: { id?: unknown }) => m.id).filter((id: unknown): id is string => typeof id === 'string')
    : [];

  res.json({ models });
});
