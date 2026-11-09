import { describe, expect, it } from 'vitest';
import type { SessionSettings } from '../config/timeConfig';
import type { Entrant, Judge, SessionBlock } from '../types';
import {
  getConflictDetails,
  getSessionConflictSeverity,
  normalizeRoomKey,
  roomsMatch,
  stripLegacyEndRowIndex
} from './scheduleHelpers';

const settings: SessionSettings = {
  oneXLongLength: 45,
  threeX20Length: 20,
  threeX10Length: 10,
  startTime: '09:00',
  moving: 'judges'
};

const judges: Judge[] = [
  { id: 'j1', name: 'Judge One', category: 'MUS' },
  { id: 'j2', name: 'Judge Two', category: 'SNG' }
];

function entrant(id: string, roomNumber: string): Entrant {
  return {
    id,
    name: id,
    groupsToAvoid: [],
    preference: '3x20',
    judgePreference1: '',
    judgePreference2: '',
    judgePreference3: '',
    includeInSchedule: true,
    roomNumber
  };
}

function session(
  id: string,
  entrantId: string,
  judgeId: string,
  startRowIndex: number,
  type: SessionBlock['type'] = '3x20'
): SessionBlock {
  return {
    id,
    entrantId,
    entrantName: entrantId,
    type,
    sessionIndex: 0,
    judgeId,
    startRowIndex,
    isScheduled: true
  };
}

describe('roomsMatch', () => {
  it('matches rooms case-insensitively', () => {
    expect(roomsMatch('VAlencia Ballroom', 'Valencia Ballroom')).toBe(true);
    expect(normalizeRoomKey('VAlencia Ballroom')).toBe('valencia ballroom');
  });

  it('does not match different rooms', () => {
    expect(roomsMatch('Valencia Ballroom', 'Orlando Ballroom')).toBe(false);
  });

  it('returns false when either room is missing', () => {
    expect(roomsMatch(undefined, 'Valencia')).toBe(false);
    expect(roomsMatch('Valencia', undefined)).toBe(false);
    expect(roomsMatch('', 'Valencia')).toBe(false);
  });
});

describe('room conflict casing', () => {
  it('flags overlapping sessions with case-variant room names', () => {
    const entrants = [
      entrant('e1', 'VAlencia Ballroom'),
      entrant('e2', 'Valencia Ballroom')
    ];
    const scheduled = [
      session('s1', 'e1', 'j1', 0),
      session('s2', 'e2', 'j2', 0)
    ];

    expect(
      getSessionConflictSeverity(scheduled[0], scheduled, judges, entrants, settings)
    ).toBe('red');

    const conflicts = getConflictDetails(scheduled, judges, entrants, settings);
    const roomConflicts = conflicts.filter(c => c.type === 'room');
    expect(roomConflicts).toHaveLength(1);
    expect(roomConflicts[0]).toMatchObject({
      type: 'room',
      severity: 'red'
    });
  });

  it('does not flag different rooms', () => {
    const entrants = [
      entrant('e1', 'Valencia Ballroom'),
      entrant('e2', 'Orlando Ballroom')
    ];
    const scheduled = [
      session('s1', 'e1', 'j1', 0),
      session('s2', 'e2', 'j2', 0)
    ];

    expect(
      getSessionConflictSeverity(scheduled[0], scheduled, judges, entrants, settings)
    ).toBeNull();
  });
});

describe('stripLegacyEndRowIndex', () => {
  it('removes endRowIndex and keeps other fields', () => {
    const legacy = { id: 's1', startRowIndex: 4, endRowIndex: 7, judgeId: 'j1' };
    expect(stripLegacyEndRowIndex(legacy)).toEqual({ id: 's1', startRowIndex: 4, judgeId: 'j1' });
  });

  it('returns the same object when there is nothing to strip', () => {
    const block = { id: 's1', startRowIndex: 4 };
    expect(stripLegacyEndRowIndex(block)).toBe(block);
  });
});
