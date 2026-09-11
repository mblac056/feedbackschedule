import type { Entrant, EntrantJudgeAssignments, Judge } from '../types';

export type PreferencePillStatus = 'good' | 'conflict' | 'unmatched';

export interface PreferenceConflict {
  entrantId: string;
  conflictingEntrantId: string;
}

export interface PreferencePillCounts {
  greenCount: number;
  redCount: number;
  grayCount: number;
}

export function getAvoidGroupPillStatus(hasConflict: boolean): 'good' | 'conflict' {
  return hasConflict ? 'conflict' : 'good';
}

export function getSessionPreferencePillStatus(
  preference: Entrant['preference'],
  blocks: Array<{ type: string }>
): 'good' | 'conflict' | null {
  if (!preference) return null;
  return blocks.some((block) => block.type === preference) ? 'good' : 'conflict';
}

export function getJudgePreferencePillStatus(assigned: boolean): 'good' | 'unmatched' {
  return assigned ? 'good' : 'unmatched';
}

export function hasGroupConflict(
  conflicts: PreferenceConflict[] | undefined,
  entrantId: string,
  groupId: string
): boolean {
  if (!conflicts) return false;
  return conflicts.some(
    (conflict) => conflict.entrantId === entrantId && conflict.conflictingEntrantId === groupId
  );
}

export function countPreferencePills({
  entrants,
  judges,
  sessionBlocks,
  assignments,
  conflicts,
}: {
  entrants: Entrant[];
  judges: Array<Pick<Judge, 'id'>>;
  sessionBlocks?: Array<{ entrantId: string; type: string }>;
  assignments?: EntrantJudgeAssignments;
  conflicts?: PreferenceConflict[];
}): PreferencePillCounts {
  let greenCount = 0;
  let redCount = 0;
  let grayCount = 0;

  entrants
    .filter((entrant) => entrant.includeInSchedule)
    .forEach((entrant) => {
      if (Array.isArray(entrant.groupsToAvoid)) {
        entrant.groupsToAvoid.forEach((groupId) => {
          if (hasGroupConflict(conflicts, entrant.id, groupId)) {
            redCount++;
          } else {
            greenCount++;
          }
        });
      }

      const sessionStatus = getSessionPreferencePillStatus(
        entrant.preference,
        sessionBlocks?.filter((block) => block.entrantId === entrant.id) ?? []
      );
      if (sessionStatus === 'good') greenCount++;
      if (sessionStatus === 'conflict') redCount++;

      [entrant.judgePreference1, entrant.judgePreference2, entrant.judgePreference3].forEach(
        (judgeId) => {
          if (judgeId && judges.find((judge) => judge.id === judgeId)) {
            if (assignments?.[entrant.id]?.includes(judgeId)) {
              greenCount++;
            } else {
              grayCount++;
            }
          }
        }
      );
    });

  return { greenCount, redCount, grayCount };
}
