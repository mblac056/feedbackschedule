import { describe, expect, it } from 'vitest';
import type { SessionSettings } from '../config/timeConfig';
import type { SessionBlock } from '../types';
import {
  anySessionLengthIncreased,
  refreshScheduledEndRowIndexes,
} from './sessionLengthSettings';

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

describe('refreshScheduledEndRowIndexes', () => {
  it('updates endRowIndex for scheduled blocks from new settings', () => {
    const blocks: SessionBlock[] = [
      {
        id: 'a',
        entrantId: 'e1',
        entrantName: 'E1',
        type: '3x20',
        isScheduled: true,
        startRowIndex: 0,
        endRowIndex: 3,
        judgeId: 'j1',
      },
      {
        id: 'b',
        entrantId: 'e2',
        entrantName: 'E2',
        type: '1xLong',
        isScheduled: true,
        startRowIndex: 2,
        endRowIndex: 9,
        judgeId: 'j1',
      },
      {
        id: 'c',
        entrantId: 'e3',
        entrantName: 'E3',
        type: '3x10',
        isScheduled: false,
      },
    ];

    const shorter: SessionSettings = {
      ...base,
      threeX20Length: 15,
      oneXLongLength: 30,
    };

    const result = refreshScheduledEndRowIndexes(blocks, shorter);

    expect(result[0]).toMatchObject({
      id: 'a',
      startRowIndex: 0,
      judgeId: 'j1',
      endRowIndex: 2, // 15 min / 5 = 3 slots → end 0+3-1
    });
    expect(result[1]).toMatchObject({
      id: 'b',
      startRowIndex: 2,
      judgeId: 'j1',
      endRowIndex: 7, // 30 min / 5 = 6 slots → end 2+6-1
    });
    expect(result[2]).toEqual(blocks[2]);
  });
});
