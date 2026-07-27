/** Unambiguous alphabet for randomly generated code characters (no 0/O/1/I/L). */
export const RANDOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Full alphabet allowed in codes and prefixes (includes 0/O/1/I/L). */
export const CODE_CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

/** @deprecated Prefer RANDOM_CODE_ALPHABET or CODE_CHARSET; kept for existing imports. */
export const CODE_ALPHABET = RANDOM_CODE_ALPHABET;

export function normalizeCode(input: string): string {
  return input.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
}

export function formatCode(normalized: string): string {
  const c = normalizeCode(normalized).slice(0, 6);
  if (c.length <= 3) return c;
  return `${c.slice(0, 3)}-${c.slice(3)}`;
}

export function isValidNormalizedCode(code: string): boolean {
  const c = normalizeCode(code);
  if (c.length !== 6) return false;
  return [...c].every((ch) => CODE_CHARSET.includes(ch));
}

/** Keep only alphanumeric characters, max 3, for settings prefix. */
export function filterCodePrefix(value: string): string {
  return normalizeCode(value)
    .split('')
    .filter((ch) => CODE_CHARSET.includes(ch))
    .join('')
    .slice(0, 3);
}

export function generateCode(prefix?: string): string {
  const rawPrefix = prefix ? normalizeCode(prefix).slice(0, 3) : '';
  const prefixChars = [...rawPrefix].filter((ch) => CODE_CHARSET.includes(ch)).join('');
  let out = prefixChars;
  while (out.length < 6) {
    out += RANDOM_CODE_ALPHABET[Math.floor(Math.random() * RANDOM_CODE_ALPHABET.length)];
  }
  return out;
}

export function generateEditToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}
