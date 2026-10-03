import {
  classifyHost,
  MAX_CONTEXT_CHARS,
  MAX_HEADING_PATH,
  MAX_INSTRUCTION_CHARS,
  MAX_PROTECTED_TERM_CHARS,
  MAX_PROTECTED_TERMS,
  MAX_TEMPERATURE,
  type SuggestionContext
} from '@glossly/shared';

/**
 * The baseUrl if it points at a loopback or private-network host, else null.
 * The proxy fetches whatever baseUrl the client hands it, so without this check
 * it doubles as an open relay for anything that can reach localhost:3000.
 */
export function validateLocalBaseUrl(baseUrl: unknown): string | null {
  return typeof baseUrl === 'string' && classifyHost(baseUrl) ? baseUrl : null;
}

/**
 * Accepts a plain-string context (older clients) or a SuggestionContext.
 * Returns null when the shape is wrong or the total exceeds MAX_CONTEXT_CHARS —
 * express.json's 100 kB body limit is no meaningful cap on prompt size.
 */
export function parseContext(raw: unknown): string | SuggestionContext | null {
  if (raw === undefined || raw === null) return '';
  if (typeof raw === 'string') return raw.length <= MAX_CONTEXT_CHARS ? raw : null;
  if (typeof raw !== 'object' || Array.isArray(raw)) return null;
  const { title, headingPath, before, after, address } = raw as Record<string, unknown>;
  if (typeof title !== 'string' || typeof before !== 'string' || typeof after !== 'string') return null;
  if (!Array.isArray(headingPath) || headingPath.length > MAX_HEADING_PATH) return null;
  if (!headingPath.every((h): h is string => typeof h === 'string')) return null;
  const total = title.length + before.length + after.length + headingPath.reduce((n, h) => n + h.length, 0);
  if (total > MAX_CONTEXT_CHARS) return null;
  if (address !== undefined && address !== 'du' && address !== 'Sie') return null;
  return { title, headingPath, before, after, ...(address && { address }) };
}

/** undefined when absent, null when present but not a number in 0–MAX_TEMPERATURE. */
export function parseTemperature(raw: unknown): number | undefined | null {
  if (raw === undefined) return undefined;
  if (typeof raw !== 'number' || !Number.isFinite(raw) || raw < 0 || raw > MAX_TEMPERATURE) return null;
  return raw;
}

/** undefined when absent, null when present but not a non-blank string of at most MAX_INSTRUCTION_CHARS. */
export function parseInstruction(raw: unknown): string | undefined | null {
  if (raw === undefined) return undefined;
  if (typeof raw !== 'string' || !raw.trim() || raw.length > MAX_INSTRUCTION_CHARS) return null;
  return raw;
}

/** undefined when absent, null unless an array of at most MAX_PROTECTED_TERMS non-blank strings of at most MAX_PROTECTED_TERM_CHARS. */
export function parseProtectedTerms(raw: unknown): string[] | undefined | null {
  if (raw === undefined) return undefined;
  if (!Array.isArray(raw) || raw.length > MAX_PROTECTED_TERMS) return null;
  const ok = raw.every((t): t is string => typeof t === 'string' && t.trim() !== '' && t.length <= MAX_PROTECTED_TERM_CHARS);
  return ok ? raw : null;
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
