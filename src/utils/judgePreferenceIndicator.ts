import type { Entrant } from '../types';

export type JudgePreferenceIndicator = {
  number: '1' | '2' | '3';
  color: string;
};

export function getJudgePreferenceIndicator(
  judgeId: string,
  selectedEntrant: string | null,
  entrants: Entrant[]
): JudgePreferenceIndicator | null {
  if (!selectedEntrant) return null;
  const entrant = entrants.find((item) => item.id === selectedEntrant);
  if (!entrant) return null;
  if (entrant.judgePreference1 === judgeId) return { number: '1', color: '#d97706' };
  if (entrant.judgePreference2 === judgeId) return { number: '2', color: '#4b5563' };
  if (entrant.judgePreference3 === judgeId) return { number: '3', color: '#92400e' };
  return null;
}
