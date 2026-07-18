import { Router } from 'express';

export const modelsRouter = Router();

modelsRouter.get('/api/models', async (req, res) => {
  const baseUrl = typeof req.query.baseUrl === 'string' ? req.query.baseUrl : '';
  const apiKey = typeof req.query.apiKey === 'string' ? req.query.apiKey : '';

  if (!baseUrl) {
    res.status(400).json({ error: 'bad_response', message: 'baseUrl is required.' });
    return;
  }

  let response: Response;
  try {
    response = await fetch(`${baseUrl.replace(/\/$/, '')}/models`, {
      headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined
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
