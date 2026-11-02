import type { Entrant } from '../types';

export type JudgePreferenceIndicator = {
  number: '1' | '2' | '3';
  color: string;
};

export function getEntrantPreferenceForJudge(
  entrant: Entrant,
  judgeId: string
): JudgePreferenceIndicator | null {
  if (entrant.judgePreference1 === judgeId) return { number: '1', color: '#d97706' };
  if (entrant.judgePreference2 === judgeId) return { number: '2', color: '#4b5563' };
  if (entrant.judgePreference3 === judgeId) return { number: '3', color: '#92400e' };
  return null;
}

export function getJudgePreferenceIndicator(
  judgeId: string,
  selectedEntrant: string | null,
  entrants: Entrant[]
): JudgePreferenceIndicator | null {
  if (!selectedEntrant) return null;
  const entrant = entrants.find((item) => item.id === selectedEntrant);
  if (!entrant) return null;
  return getEntrantPreferenceForJudge(entrant, judgeId);
}

export function shouldShowReversePreferenceIndicator({
  selectedJudge,
  blockJudgeId,
  entrantAssignedToSelectedJudge,
}: {
  selectedJudge: string | null;
  blockJudgeId: string | undefined;
  entrantAssignedToSelectedJudge: boolean;
}): boolean {
  if (!selectedJudge) return false;
  if (entrantAssignedToSelectedJudge) {
    return blockJudgeId === selectedJudge;
  }
  return true;
}

export function getReversePreferenceIndicator({
  entrant,
  selectedJudge,
  blockJudgeId,
  entrantAssignedToSelectedJudge,
}: {
  entrant: Entrant;
  selectedJudge: string | null;
  blockJudgeId: string | undefined;
  entrantAssignedToSelectedJudge: boolean;
}): JudgePreferenceIndicator | null {
  if (
    !shouldShowReversePreferenceIndicator({
      selectedJudge,
      blockJudgeId,
      entrantAssignedToSelectedJudge,
    })
  ) {
    return null;
  }
  return getEntrantPreferenceForJudge(entrant, selectedJudge!);
}

/** Entrant ids that have at least one scheduled session on the given judge. */
export function getEntrantIdsAssignedToJudge(
  sessions: Array<{ entrantId: string; judgeId?: string; isScheduled?: boolean }>,
  judgeId: string | null
): Set<string> {
  const assigned = new Set<string>();
  if (!judgeId) return assigned;
  for (const session of sessions) {
    if (session.judgeId === judgeId && session.isScheduled !== false) {
      assigned.add(session.entrantId);
    }
  }
  return assigned;
}
