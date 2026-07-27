// Glossly is local-only by contract ("zero network calls outside localhost").
// The proxy fetches whatever baseUrl the client hands it, so without this check
// it doubles as an open relay for anything that can reach localhost:3000.
const PRIVATE_HOSTNAME =
  /^(localhost|127(\.\d{1,3}){3}|\[::1\]|::1|10(\.\d{1,3}){3}|192\.168(\.\d{1,3}){2}|172\.(1[6-9]|2\d|3[01])(\.\d{1,3}){2})$/i;

/** Returns the normalized baseUrl if it points at a local/private-network host, else null. */
export function validateLocalBaseUrl(baseUrl: unknown): string | null {
  if (typeof baseUrl !== 'string' || !baseUrl) return null;
  let url: URL;
  try {
    url = new URL(baseUrl);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  if (!PRIVATE_HOSTNAME.test(url.hostname)) return null;
  return baseUrl;
}

const MIN_TIMEOUT_MS = 1000;
const MAX_TIMEOUT_MS = 120000;

/** Clamps a client-supplied timeout to a sane range, falling back to the env default. */
export function resolveTimeout(value: unknown): number {
  const fallback = Number(process.env.REQUEST_TIMEOUT) || 10000;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(Math.max(n, MIN_TIMEOUT_MS), MAX_TIMEOUT_MS);
}
