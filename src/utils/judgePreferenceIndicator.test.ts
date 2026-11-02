import { describe, expect, it } from 'vitest';
import type { Entrant } from '../types';
import {
  getEntrantPreferenceForJudge,
  shouldShowReversePreferenceIndicator,
} from './judgePreferenceIndicator';

const entrant = (overrides: Partial<Entrant> = {}): Entrant => ({
  id: 'e1',
  name: 'Chorus One',
  groupsToAvoid: [],
  preference: null,
  judgePreference1: 'j1',
  judgePreference2: 'j2',
  judgePreference3: 'j3',
  includeInSchedule: true,
  ...overrides,
});

describe('getEntrantPreferenceForJudge', () => {
  it('returns 1/2/3 with colors for matching preferences', () => {
    const e = entrant();
    expect(getEntrantPreferenceForJudge(e, 'j1')).toEqual({ number: '1', color: '#d97706' });
    expect(getEntrantPreferenceForJudge(e, 'j2')).toEqual({ number: '2', color: '#4b5563' });
    expect(getEntrantPreferenceForJudge(e, 'j3')).toEqual({ number: '3', color: '#92400e' });
  });

  it('returns null when judge is not in preferences', () => {
    expect(getEntrantPreferenceForJudge(entrant(), 'other')).toBeNull();
  });
});

describe('shouldShowReversePreferenceIndicator', () => {
  it('returns false when no judge is selected', () => {
    expect(
      shouldShowReversePreferenceIndicator({
        selectedJudge: null,
        blockJudgeId: 'j1',
        entrantAssignedToSelectedJudge: true,
      })
    ).toBe(false);
  });

  it('for assigned entrants, only shows on the selected judge column', () => {
    expect(
      shouldShowReversePreferenceIndicator({
        selectedJudge: 'j1',
        blockJudgeId: 'j1',
        entrantAssignedToSelectedJudge: true,
      })
    ).toBe(true);
    expect(
      shouldShowReversePreferenceIndicator({
        selectedJudge: 'j1',
        blockJudgeId: 'j2',
        entrantAssignedToSelectedJudge: true,
      })
    ).toBe(false);
    expect(
      shouldShowReversePreferenceIndicator({
        selectedJudge: 'j1',
        blockJudgeId: undefined,
        entrantAssignedToSelectedJudge: true,
      })
    ).toBe(false);
  });

  it('for not-assigned entrants, shows on every block including unassigned', () => {
    expect(
      shouldShowReversePreferenceIndicator({
        selectedJudge: 'j1',
        blockJudgeId: 'j2',
        entrantAssignedToSelectedJudge: false,
      })
    ).toBe(true);
    expect(
      shouldShowReversePreferenceIndicator({
        selectedJudge: 'j1',
        blockJudgeId: undefined,
        entrantAssignedToSelectedJudge: false,
      })
    ).toBe(true);
  });
});
