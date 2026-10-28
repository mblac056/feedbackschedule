import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('html2pdf.js', () => ({ default: () => ({}) }));
vi.mock('jspdf', () => ({ default: class JsPDF {} }));
vi.mock('jspdf-autotable', () => ({ default: () => undefined }));

import type { Entrant, Judge, SessionBlock } from '../types';
import { saveEntrants, saveSettings } from './localStorage';
import { generatePrintData } from './printFiles';

const judge: Judge = {
  id: 'j1',
  name: 'Ada Judge',
  category: 'MUS',
  roomNumber: '101',
};

const entrant = (id: string, name: string): Entrant => ({
  id,
  name,
  groupsToAvoid: [],
  preference: null,
  judgePreference1: '',
  judgePreference2: '',
  judgePreference3: '',
  includeInSchedule: true,
});

function session(
  id: string,
  entrantId: string,
  type: SessionBlock['type'],
  startRowIndex: number,
): SessionBlock {
  return {
    id,
    entrantId,
    entrantName: entrantId,
    type,
    startRowIndex,
    judgeId: judge.id,
    isScheduled: true,
  };
}

describe('flow document end warnings', () => {
  afterEach(() => {
    localStorage.clear();
  });

  it('warns 2 minutes before a 3x10 ends and 5 minutes before other sessions', () => {
    saveSettings({
      startTime: '09:00',
      oneXLongLength: 40,
      threeX20Length: 20,
      threeX10Length: 10,
      moving: 'groups',
    });
    saveEntrants([entrant('e10', 'Short Group'), entrant('e20', 'Long Group')]);

    const { flowDocument } = generatePrintData(
      [
        session('s10', 'e10', '3x10', 0),
        session('s20', 'e20', '3x20', 4),
      ],
      [judge],
    );

    const eventsAt = (time: string) =>
      flowDocument.find((entry) => entry.time === time)?.events ?? [];

    expect(eventsAt('09:08')).toContain('Two-minute notice to Ada Judge with Short Group (101)');
    expect(eventsAt('09:05').some((event) => event.includes('notice'))).toBe(false);
    expect(eventsAt('09:35')).toContain('Five-minute notice to Ada Judge with Long Group (101)');
  });
});
