import type { LoadStatus } from '@glossly/shared';

// llama-swap reports its model processes at GET /running. Measured on v262
// (2026-10-03): a request for a model that is not loaded gets no response
// headers until the model is ready. While another model is still answering,
// ours stays absent — llama-swap swaps only after that request finishes (a
// 27B answer held an e2b request for 29 s). Then ours turns `starting`
// (~2.4 s for e2b) and `ready`.

export interface RunningProcess {
  model: string;
  state: string;
}

const PROBE_TIMEOUT_MS = 1000;

/** What /running says about our model's wait. Pure, for tests. */
export function classifyRunning(running: RunningProcess[], model: string): LoadStatus {
  const ours = running.find((r) => r.model === model);
  if (ours?.state === 'starting') return { state: 'loading', model };
  // Loaded, so the wait is a queue on our own model — nothing more specific to say.
  if (ours?.state === 'ready') return { state: 'waiting' };
  const other = running.find((r) => r.model !== model);
  if (!other || other.state === 'stopping' || other.state === 'stopped') return { state: 'loading', model };
  return { state: 'busy', model: other.model };
}

/**
 * Asks the endpoint's origin for llama-swap's /running. null when it is not
 * llama-swap (or does not answer quickly) — the caller then knows nothing
 * more than "waiting". Only ever asks the endpoint the proxy already
 * validated as local.
 */
export async function probeLoadState(baseUrl: string, model: string, signal: AbortSignal): Promise<LoadStatus | null> {
  const timeout = AbortSignal.timeout(PROBE_TIMEOUT_MS);
  try {
    const response = await fetch(new URL('/running', baseUrl), { signal: AbortSignal.any([signal, timeout]) });
    if (!response.ok) return null;
    const body = (await response.json()) as { running?: unknown };
    if (!Array.isArray(body.running)) return null;
    const running = body.running.filter(
      (r: unknown): r is RunningProcess =>
        typeof (r as RunningProcess)?.model === 'string' && typeof (r as RunningProcess)?.state === 'string'
    );
    return classifyRunning(running, model);
  } catch {
    return null;
  }
}
