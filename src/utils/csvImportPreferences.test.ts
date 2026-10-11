import { describe, expect, it } from 'vitest';
import { importEvalPreferencesCSV } from './csvImportPreferences';
import type { Entrant } from '../types';

function entrant(name: string, preference: Entrant['preference'] = null): Entrant {
  return {
    id: name.toLowerCase().replace(/\s+/g, '-'),
    name,
    groupsToAvoid: [],
    preference,
    judgePreference1: '',
    judgePreference2: '',
    judgePreference3: '',
    includeInSchedule: true,
  };
}

const csv = [
  'Group Name,Eval Type Semifinals,Eval Type Finals',
  'Both Differ,3x20,1xLong',
  'Both Same,3x10,3x10',
  'Semis Only,3x20,',
  'Finals Only,,1xLong',
].join('\n');

describe('importEvalPreferencesCSV eval type priority', () => {
  it('uses the semifinals preference when both columns differ', () => {
    const groups = [
      entrant('Both Differ'),
      entrant('Both Same'),
      entrant('Semis Only'),
      entrant('Finals Only'),
    ];

    const result = importEvalPreferencesCSV(csv, groups, []);

    expect(result.success).toBe(true);
    expect(groups.map((group) => group.preference)).toEqual(['3x20', '3x10', '3x20', '1xLong']);
    expect(result.warnings?.some((warning) => warning.includes('using semifinals'))).toBe(true);
  });

  it('uses the finals preference for mismatched rows when requested', () => {
    const groups = [
      entrant('Both Differ'),
      entrant('Both Same'),
      entrant('Semis Only'),
      entrant('Finals Only'),
    ];

    const result = importEvalPreferencesCSV(csv, groups, [], [], {
      preferFinalsWhenDifferent: true,
    });

    expect(result.success).toBe(true);
    expect(groups.map((group) => group.preference)).toEqual(['1xLong', '3x10', '3x20', '1xLong']);
    expect(result.warnings?.some((warning) => warning.includes('using finals'))).toBe(true);
  });
});
