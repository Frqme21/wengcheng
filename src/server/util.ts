import crypto from 'node:crypto';

/** Fast, stable 32-bit hash used for session fingerprinting and deterministic decoys. */
export function hash32(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function shortId(prefix = 'id'): string {
  return `${prefix}-${crypto.randomBytes(5).toString('hex')}`;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Collapse a concrete probe into a reusable deception key.
 * `/api/users/4821?token=abc` -> `/api/users/:id`
 */
export function normalizePath(rawPath: string): string {
  let p = rawPath.split('?')[0]?.toLowerCase() ?? '/';
  p = p.replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, '/:uuid');
  p = p.replace(/\/[0-9a-f]{16,}/g, '/:hash');
  p = p.replace(/\/\d+(?=\/|$)/g, '/:id');
  p = p.replace(/\/{2,}/g, '/');
  return p.length > 1 ? p.replace(/\/$/, '') : p;
}

/** Deterministic pseudo-random generator so offline decoys look different per probe. */
export function seededRandom(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 4294967296;
  };
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}
