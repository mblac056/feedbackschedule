const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I/L

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
  return [...c].every((ch) => CODE_ALPHABET.includes(ch));
}

export function generateCode(prefix?: string): string {
  const rawPrefix = prefix ? normalizeCode(prefix).slice(0, 3) : '';
  const prefixChars = [...rawPrefix].filter((ch) => CODE_ALPHABET.includes(ch)).join('');
  let out = prefixChars;
  while (out.length < 6) {
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return out;
}

export function generateEditToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export { CODE_ALPHABET };
