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
    judgeId: 'j1',
  },
];

describe('publishedScheduleSchema', () => {
  it('accepts a payload produced by the builder', () => {
    const payload = buildPublishedPayload({ judges, entrants, sessionBlocks, settings });
    expect(parsePublishedSchedulePayload(payload).version).toBe(1);
    expect(parsePublishedSchedulePayload(payload).sessions).toHaveLength(1);
  });

  it('accepts older blobs that still carry endRowIndex and drops it', () => {
    const payload = buildPublishedPayload({ judges, entrants, sessionBlocks, settings });
    const legacy = {
      ...payload,
      sessions: payload.sessions.map((s) => ({ ...s, endRowIndex: s.startRowIndex + 3 })),
    };
    const parsed = parsePublishedSchedulePayload(legacy);
    expect(parsed.sessions).toHaveLength(1);
    expect(parsed.sessions[0]).not.toHaveProperty('endRowIndex');
  });

  it('carries a 12-hour time format and omits the 24-hour default', () => {
    const twelve = buildPublishedPayload({ judges, entrants, sessionBlocks, settings: { ...settings, timeFormat: '12h' } });
    expect(parsePublishedSchedulePayload(twelve).settings.timeFormat).toBe('12h');

    const twentyFour = buildPublishedPayload({ judges, entrants, sessionBlocks, settings: { ...settings, timeFormat: '24h' } });
    expect(twentyFour.settings).not.toHaveProperty('timeFormat');
    expect(parsePublishedSchedulePayload(twentyFour).settings).not.toHaveProperty('timeFormat');
  });

  it('ignores an unknown time format value', () => {
    const payload = buildPublishedPayload({ judges, entrants, sessionBlocks, settings });
    const odd = { ...payload, settings: { ...payload.settings, timeFormat: 'bogus' } };
    expect(parsePublishedSchedulePayload(odd).settings).not.toHaveProperty('timeFormat');
  });

  it('rejects an unknown major version', () => {
    const payload = { ...buildPublishedPayload({ judges, entrants, sessionBlocks, settings }), version: 2 };
    expect(() => parsePublishedSchedulePayload(payload)).toThrow(/Unsupported schedule version/);
  });

  it('rejects missing collections', () => {
    expect(() => parsePublishedSchedulePayload({ version: 1 })).toThrow();
  });
});
