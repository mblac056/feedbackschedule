import { beforeEach, describe, expect, it } from 'vitest';
import { getPublishImportConflict, importData, parseJSON } from './importExport';
import { clearPublishCredentials, getPublishCredentials, setPublishCredentials } from './publishStorage';

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

describe('importExport publish code on import', () => {
  const withPublish = (publish?: unknown) =>
    JSON.stringify({ ...JSON.parse(exportJson([])), ...(publish ? { publish } : {}) });

  beforeEach(() => {
    clearPublishCredentials();
    setPublishCredentials('ABC234', 'mine', { publishedSessionCount: 3 });
  });

  it('asks when the file has no code and this browser has one', () => {
    expect(getPublishImportConflict(withPublish())).toEqual({ currentCode: 'ABC234', incomingCode: null });
  });

  it('asks when the file carries a different code', () => {
    expect(getPublishImportConflict(withPublish({ code: 'XYZ789', editToken: 'theirs' }))).toEqual({
      currentCode: 'ABC234',
      incomingCode: 'XYZ789',
    });
  });

  it('does not ask when the codes match or this browser has none', () => {
    expect(getPublishImportConflict(withPublish({ code: 'ABC234', editToken: 'mine' }))).toBeNull();
    clearPublishCredentials();
    expect(getPublishImportConflict(withPublish({ code: 'XYZ789', editToken: 'theirs' }))).toBeNull();
  });

  it('keeps this browser’s code when asked to', () => {
    expect(importData(withPublish({ code: 'XYZ789', editToken: 'theirs' }), 'keep').success).toBe(true);
    expect(getPublishCredentials()).toMatchObject({ code: 'ABC234', editToken: 'mine' });
    expect(importData(withPublish(), 'keep').success).toBe(true);
    expect(getPublishCredentials()?.code).toBe('ABC234');
  });

  it('takes the file’s code, or clears, by default', () => {
    importData(withPublish({ code: 'XYZ789', editToken: 'theirs', expiresAt: '2027-01-01T00:00:00.000Z' }));
    expect(getPublishCredentials()).toEqual({ code: 'XYZ789', editToken: 'theirs', expiresAt: '2027-01-01T00:00:00.000Z' });
    importData(withPublish());
    expect(getPublishCredentials()).toBeNull();
  });
});
