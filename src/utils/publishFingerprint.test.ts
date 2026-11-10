import { describe, expect, it } from 'vitest';
import { buildPublishedPayload } from './buildPublishedPayload';
import { fingerprintPayload } from './publishFingerprint';
import type { Entrant, Judge, SessionBlock } from '../types';
import type { SessionSettings } from '../config/timeConfig';

const settings = {
  startTime: '09:00',
  oneXLongLength: 6,
  threeX20Length: 2,
  threeX10Length: 1,
  moving: 'judges',
  exportName: 'Fall Contest',
} as SessionSettings;
const judges = [{ id: 'j1', name: 'Pat Judge', category: 'SNG' }] as Judge[];
const entrants = [{ id: 'e1', name: 'The Four', groupType: 'Quartet' }] as Entrant[];
const blocks = [
  { id: 's1', entrantId: 'e1', entrantName: 'The Four', type: '1xLong', isScheduled: true, judgeId: 'j1', startRowIndex: 0 },
  { id: 's2', entrantId: 'e1', entrantName: 'The Four', type: '1xLong', isScheduled: false },
] as SessionBlock[];

const build = (over: { sessionBlocks?: SessionBlock[]; settings?: SessionSettings } = {}) =>
  buildPublishedPayload({ judges, entrants, sessionBlocks: blocks, settings, ...over });

describe('fingerprintPayload', () => {
  it('is stable for the same schedule', async () => {
    expect(await fingerprintPayload(build())).toBe(await fingerprintPayload(build()));
  });

  it('ignores key order', async () => {
    const payload = build();
    const reordered = { slugIndex: payload.slugIndex, ...payload };
    expect(await fingerprintPayload(reordered)).toBe(await fingerprintPayload(payload));
  });

  it('ignores unscheduled blocks', async () => {
    expect(await fingerprintPayload(build({ sessionBlocks: blocks.slice(0, 1) }))).toBe(
      await fingerprintPayload(build())
    );
  });

  it('changes when a session moves', async () => {
    const moved = [{ ...blocks[0], startRowIndex: 6 }, blocks[1]];
    expect(await fingerprintPayload(build({ sessionBlocks: moved }))).not.toBe(await fingerprintPayload(build()));
  });

  it('changes when the round name changes', async () => {
    expect(await fingerprintPayload(build({ settings: { ...settings, exportName: 'Spring' } }))).not.toBe(
      await fingerprintPayload(build())
    );
  });
});
