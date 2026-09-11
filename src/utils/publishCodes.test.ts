import { describe, expect, it } from 'vitest';
import { generateCode, isValidNormalizedCode, normalizeCode, RANDOM_CODE_ALPHABET } from './publishCodes';

describe('publishCodes', () => {
  it('generates 6-character codes from the unambiguous alphabet', () => {
    const codes = new Set(Array.from({ length: 40 }, () => generateCode()));
    expect(codes.size).toBeGreaterThan(1);
    for (const code of codes) {
      expect(code).toHaveLength(6);
      expect(isValidNormalizedCode(code)).toBe(true);
      expect([...code].every((ch) => RANDOM_CODE_ALPHABET.includes(ch))).toBe(true);
    }
  });

  it('preserves a sanitized prefix and fills the rest randomly', () => {
    const code = generateCode('ab-');
    expect(code.startsWith('AB')).toBe(true);
    expect(code).toHaveLength(6);
    expect(isValidNormalizedCode(code)).toBe(true);
  });

  it('rejects short or invalid codes', () => {
    expect(isValidNormalizedCode('ABC')).toBe(false);
    expect(isValidNormalizedCode('ABC123')).toBe(true);
    expect(normalizeCode('ab-c12')).toBe('ABC12');
  });
});
