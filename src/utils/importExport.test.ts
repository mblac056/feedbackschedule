import { describe, expect, it } from 'vitest';
import { importData, parseJSON } from './importExport';

describe('importExport.parseJSON', () => {
  it('returns null for invalid JSON', () => {
    expect(parseJSON('not-json')).toBeNull();
  });

  it('returns null for non-object JSON', () => {
    expect(parseJSON('[]')).toBeNull();
    expect(parseJSON('"x"')).toBeNull();
  });

  it('parses an object without logging contents', () => {
    const parsed = parseJSON('{"judges":[],"entrants":[]}');
    expect(parsed).toEqual({ judges: [], entrants: [] });
  });
});

function exportJson(sessionBlocks: unknown[]) {
  return JSON.stringify({
    judges: [{ id: 'j1', name: 'Judge One', category: 'MUS', active: true }],
    entrants: [{ id: 'e1', name: 'Group One' }],
    sessionBlocks,
    settings: {
      startTime: '22:00',
      oneXLongLength: 40,
      threeX20Length: 20,
      threeX10Length: 10,
      moving: 'groups',
    },
  });
}

describe('importExport.importData legacy endRowIndex', () => {
  it('strips endRowIndex from older exports and keeps start positions', () => {
    const result = importData(exportJson([
      {
        id: 'e1-3x20-0',
        entrantId: 'e1',
        entrantName: 'Group One',
        type: '3x20',
        sessionIndex: 0,
        isScheduled: true,
        startRowIndex: 8,
        endRowIndex: 3,
        judgeId: 'j1',
      },
      {
        id: 'e1-1xlong',
        entrantId: 'e1',
        entrantName: 'Group One',
        type: '1xLong',
        isScheduled: true,
        startRowIndex: 0,
        judgeId: 'j1',
      },
    ]));

    expect(result.success).toBe(true);
    const blocks = result.data?.sessionBlocks ?? [];
    expect(blocks.map((block) => block.startRowIndex)).toEqual([8, 0]);
    for (const block of blocks) {
      expect(block).not.toHaveProperty('endRowIndex');
    }
  });
});
