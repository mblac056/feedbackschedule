import { describe, expect, it } from 'vitest';
import type { SessionSettings } from '../config/timeConfig';
import type { Entrant, Judge, SessionBlock } from '../types';
import { buildPublishedPayload } from './buildPublishedPayload';

const settings: SessionSettings = {
  oneXLongLength: 40,
  threeX20Length: 20,
  threeX10Length: 10,
  startTime: '09:00',
  moving: 'groups',
};

const judges = [{ id: 'j1', name: 'Judge One', category: 'SNG' }] as Judge[];
const entrants = [
  { id: 'e1', name: 'Group A' },
  { id: 'e2', name: 'Group B' },
] as Entrant[];

describe('buildPublishedPayload', () => {
  it('includes scheduled sessions that have no stored endRowIndex', () => {
    // Single-session grid drops used to save startRowIndex without endRowIndex.
    const blocks = [
      { id: 's1', entrantId: 'e1', entrantName: 'Group A', type: '1xLong', isScheduled: true, judgeId: 'j1', startRowIndex: 0, endRowIndex: 7 },
      { id: 's2', entrantId: 'e2', entrantName: 'Group B', type: '1xLong', isScheduled: true, judgeId: 'j1', startRowIndex: 8 },
    ] as SessionBlock[];

    const payload = buildPublishedPayload({ judges, entrants, sessionBlocks: blocks, settings });

    expect(payload.entrants.map((e) => e.id)).toEqual(['e1', 'e2']);
    expect(payload.sessions.find((s) => s.id === 's2')?.startRowIndex).toBe(8);
  });

  it('does not publish endRowIndex (derived from settings by readers)', () => {
    const blocks = [
      { id: 's1', entrantId: 'e1', entrantName: 'Group A', type: '3x20', isScheduled: true, judgeId: 'j1', startRowIndex: 10, endRowIndex: 3 },
    ] as SessionBlock[];

    const payload = buildPublishedPayload({ judges, entrants, sessionBlocks: blocks, settings });

    expect(payload.sessions[0]).not.toHaveProperty('endRowIndex');
    expect(payload.sessions[0].startRowIndex).toBe(10);
  });

  it('skips unscheduled sessions', () => {
    const blocks = [
      { id: 's1', entrantId: 'e1', entrantName: 'Group A', type: '1xLong', isScheduled: false },
    ] as SessionBlock[];

    const payload = buildPublishedPayload({ judges, entrants, sessionBlocks: blocks, settings });

    expect(payload.sessions).toEqual([]);
    expect(payload.entrants).toEqual([]);
  });
});
