import { describe, expect, it } from 'vitest';
import { buildPublishedPayload } from './buildPublishedPayload';
import { parsePublishedSchedulePayload } from './publishedScheduleSchema';
import type { Entrant, Judge, SessionBlock } from '../types';

const settings = {
  startTime: '09:00',
  oneXLongLength: 40,
  threeX20Length: 20,
  threeX10Length: 10,
  moving: 'groups' as const,
};

const judges: Judge[] = [
  { id: 'j1', name: 'Judge One', category: 'SNG', active: true },
];

const entrants: Entrant[] = [
  {
    id: 'e1',
    name: 'Chorus One',
    includeInSchedule: true,
    groupType: 'Chorus',
    groupsToAvoid: [],
    preference: '3x20',
    judgePreference1: '',
    judgePreference2: '',
    judgePreference3: '',
  },
];

const sessionBlocks: SessionBlock[] = [
  {
    id: 's1',
    entrantId: 'e1',
    entrantName: 'Chorus One',
    type: '3x20',
    isScheduled: true,
    startRowIndex: 0,
    endRowIndex: 3,
    judgeId: 'j1',
  },
];

describe('publishedScheduleSchema', () => {
  it('accepts a payload produced by the builder', () => {
    const payload = buildPublishedPayload({ judges, entrants, sessionBlocks, settings });
    expect(parsePublishedSchedulePayload(payload).version).toBe(1);
    expect(parsePublishedSchedulePayload(payload).sessions).toHaveLength(1);
  });

  it('rejects an unknown major version', () => {
    const payload = { ...buildPublishedPayload({ judges, entrants, sessionBlocks, settings }), version: 2 };
    expect(() => parsePublishedSchedulePayload(payload)).toThrow(/Unsupported schedule version/);
  });

  it('rejects missing collections', () => {
    expect(() => parsePublishedSchedulePayload({ version: 1 })).toThrow();
  });
});
