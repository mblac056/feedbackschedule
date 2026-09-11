import { describe, expect, it } from 'vitest';
import type { SessionBlock } from '../types';
import { applyBlockUpdates } from './sessionBlockUpdates';

function block(id: string, extra: Partial<SessionBlock> = {}): SessionBlock {
  return {
    id,
    entrantId: `e-${id}`,
    entrantName: id,
    type: '3x20',
    sessionIndex: 0,
    isScheduled: false,
    ...extra,
  };
}

describe('applyBlockUpdates', () => {
  it('replaces matching blocks by id and leaves others unchanged', () => {
    const current = [block('a'), block('b'), block('c')];
    const next = applyBlockUpdates(current, [
      block('b', { isScheduled: true, judgeId: 'j1', startRowIndex: 4 }),
    ]);

    expect(next[0]).toBe(current[0]);
    expect(next[2]).toBe(current[2]);
    expect(next[1]).toEqual({
      ...current[1],
      isScheduled: true,
      judgeId: 'j1',
      startRowIndex: 4,
    });
  });
});
