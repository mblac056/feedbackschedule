import { describe, expect, it } from 'vitest';
import type { SessionSettings } from '../config/timeConfig';
import { anySessionLengthIncreased } from './sessionLengthSettings';

const base: SessionSettings = {
  oneXLongLength: 40,
  threeX20Length: 20,
  threeX10Length: 10,
  startTime: '09:00',
  moving: 'groups',
};

describe('anySessionLengthIncreased', () => {
  it('returns false when all lengths are unchanged', () => {
    expect(anySessionLengthIncreased(base, base)).toBe(false);
  });

  it('returns false when lengths only decrease', () => {
    expect(
      anySessionLengthIncreased(
        { ...base, oneXLongLength: 35, threeX20Length: 15 },
        base
      )
    ).toBe(false);
  });

  it('returns true when any length increases', () => {
    expect(
      anySessionLengthIncreased({ ...base, threeX10Length: 15 }, base)
    ).toBe(true);
  });

  it('returns true when one length increases even if others decrease', () => {
    expect(
      anySessionLengthIncreased(
        { ...base, oneXLongLength: 50, threeX20Length: 15 },
        base
      )
    ).toBe(true);
  });
});
