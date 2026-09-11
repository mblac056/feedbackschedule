import { describe, expect, it } from 'vitest';
import { buildBlocksAfterEntrantEdits } from './entrantSessionBlocks';
import type { Entrant, SessionBlock } from '../types';

function quartet(id: string, extra: Partial<Entrant> = {}): Entrant {
  return {
    id,
    name: `Quartet ${id}`,
    includeInSchedule: true,
    groupType: 'Quartet',
    groupsToAvoid: [],
    preference: '3x20',
    judgePreference1: '',
    judgePreference2: '',
    judgePreference3: '',
    ...extra,
  };
}

describe('buildBlocksAfterEntrantEdits', () => {
  it('creates unscheduled 3x20 blocks when an entrant is newly included', () => {
    const blocks = buildBlocksAfterEntrantEdits([], [quartet('e1')]);
    expect(blocks).toHaveLength(3);
    expect(blocks.every((block) => block.entrantId === 'e1' && block.type === '3x20' && !block.isScheduled)).toBe(true);
  });

  it('drops blocks for excluded or removed entrants', () => {
    const existing: SessionBlock[] = [
      { id: 'e1-3x20-0', entrantId: 'e1', entrantName: 'A', type: '3x20', sessionIndex: 0, isScheduled: false },
      { id: 'e2-3x20-0', entrantId: 'e2', entrantName: 'B', type: '3x20', sessionIndex: 0, isScheduled: true, startRowIndex: 0, judgeId: 'j1' },
    ];

    expect(buildBlocksAfterEntrantEdits(existing, [quartet('e1', { includeInSchedule: false })])).toEqual([]);
    expect(buildBlocksAfterEntrantEdits(existing, [quartet('e1')]).every((block) => block.entrantId === 'e1')).toBe(true);
  });

  it('keeps a scheduled block when the regenerated type still matches', () => {
    const existing: SessionBlock[] = [
      {
        id: 'e1-3x20-0',
        entrantId: 'e1',
        entrantName: 'A',
        type: '3x20',
        sessionIndex: 0,
        isScheduled: true,
        startRowIndex: 4,
        judgeId: 'j1',
      },
    ];

    const next = buildBlocksAfterEntrantEdits(existing, [quartet('e1')]);
    const kept = next.find((block) => block.sessionIndex === 0);
    expect(kept).toMatchObject({ isScheduled: true, startRowIndex: 4, judgeId: 'j1' });
  });
});
