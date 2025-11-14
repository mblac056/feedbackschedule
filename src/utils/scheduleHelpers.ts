import { TIME_CONFIG, getSessionDurationMinutes } from '../config/timeConfig';
import type { SessionSettings } from '../config/timeConfig';
import type { SessionBlock, DraggedSessionData, Judge, Entrant } from '../types';

export const getSessionDurationInSlots = (
  sessionType: SessionBlock['type'],
  settings: SessionSettings
): number => {
  const durationMinutes = getSessionDurationMinutes(sessionType, settings);
  return Math.ceil(durationMinutes / TIME_CONFIG.MINUTES_PER_SLOT);
};

export const doTimeRangesOverlap = (
  start1: number,
  end1: number,
  start2: number,
  end2: number,
  requireTimePadding?: boolean
): boolean => {
  if (requireTimePadding) {
    return !(start1 > end2 + 2 || end1 + 2 < start2);
  }
  return !(start1 > end2 || end1 < start2);
};

export const hasTimeConflict = (
  scheduledSessions: SessionBlock[],
  judgeId: string,
  startRowIndex: number,
  sessionType: SessionBlock['type'],
  settings: SessionSettings,
  excludeSession?: DraggedSessionData
): boolean => {
  const sessionDuration = getSessionDurationInSlots(sessionType, settings);
  const proposedEndRow = startRowIndex + sessionDuration - 1;

  return scheduledSessions.some(session => {
    if (session.judgeId !== judgeId) return false;

    if (
      excludeSession &&
      session.entrantId === excludeSession.entrantId &&
      session.type === excludeSession.type &&
      session.sessionIndex === excludeSession.sessionIndex
    ) {
      return false;
    }

    const existingStartRow = session.startRowIndex ?? 0;
    const existingDuration = getSessionDurationInSlots(session.type, settings);
    const existingEndRow = existingStartRow + existingDuration - 1;

    return doTimeRangesOverlap(startRowIndex, proposedEndRow, existingStartRow, existingEndRow);
  });
};

export const getJudgeAssignedTime = (
  judgeId: string,
  scheduledSessions: SessionBlock[],
  settings: SessionSettings
): number => {
  const judgeSessions = scheduledSessions.filter(session => session.judgeId === judgeId);
  return judgeSessions.reduce((total, session) => {
    const duration = getSessionDurationMinutes(session.type, settings);
    return total + duration;
  }, 0);
};

const getSessionEndTime = (session: SessionBlock, settings: SessionSettings): string => {
  const [startHour, startMinute] = settings.startTime.split(':').map(Number);
  const durationMinutes = getSessionDurationMinutes(session.type, settings);
  const startRowIndex = session.startRowIndex ?? 0;
  const totalMinutes = startMinute + startRowIndex * TIME_CONFIG.MINUTES_PER_SLOT + durationMinutes;
  const hour = startHour + Math.floor(totalMinutes / 60);
  const minute = totalMinutes % 60;
  return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
};

export const isSessionEndingAfter1AM = (
  session: SessionBlock,
  settings: SessionSettings
): boolean => {
  const endTime = getSessionEndTime(session, settings);
  const [endHour, endMinute] = endTime.split(':').map(Number);
  return endHour > 25 || (endHour === 25 && endMinute > 0);
};

export const getSessionConflictSeverity = (
  session: SessionBlock,
  scheduledSessions: SessionBlock[],
  judges: Judge[],
  entrants: Entrant[],
  settings: SessionSettings
): 'red' | 'yellow' | null => {
  let severity: 'red' | 'yellow' | null = null;
  const currentJudge = judges.find(j => j.id === session.judgeId);
  const currentJudgeCategory = currentJudge?.category;

  if (currentJudgeCategory) {
    const sameCategorySameEntrant = scheduledSessions.some(otherSession => {
      if (otherSession.id === session.id || otherSession.entrantId !== session.entrantId) {
        return false;
      }
      const otherJudge = judges.find(j => j.id === otherSession.judgeId);
      return otherJudge?.category === currentJudgeCategory;
    });

    if (sameCategorySameEntrant && severity !== 'red') {
      severity = 'yellow';
    }
  }

  const sessionStartRow = session.startRowIndex ?? 0;
  const sessionDuration = getSessionDurationInSlots(session.type, settings);
  const sessionEndRow = sessionStartRow + sessionDuration - 1;

  const hasEntrantOverlap = scheduledSessions.some(otherSession => {
    if (otherSession.id === session.id || otherSession.entrantId !== session.entrantId) return false;

    const otherStartRow = otherSession.startRowIndex ?? 0;
    const otherDuration = getSessionDurationInSlots(otherSession.type, settings);
    const otherEndRow = otherStartRow + otherDuration - 1;

    return doTimeRangesOverlap(sessionStartRow, sessionEndRow, otherStartRow, otherEndRow);
  });

  if (hasEntrantOverlap) return 'red';

  if (settings.moving === 'judges') {
    const currentEntrant = entrants.find(e => e.id === session.entrantId);
    const currentEntrantRoom = currentEntrant?.roomNumber;

    if (currentEntrantRoom) {
      let roomOverlapSeverity: 'red' | 'yellow' | null = null;

      for (const otherSession of scheduledSessions) {
        if (otherSession.id === session.id) continue;

        const otherEntrant = entrants.find(e => e.id === otherSession.entrantId);
        if (otherEntrant?.roomNumber !== currentEntrantRoom) continue;

        const otherStartRow = otherSession.startRowIndex ?? 0;
        const otherDuration = getSessionDurationInSlots(otherSession.type, settings);
        const otherEndRow = otherStartRow + otherDuration - 1;
        const requirePadding = otherSession.entrantId !== session.entrantId;

        const overlaps = doTimeRangesOverlap(
          sessionStartRow,
          sessionEndRow,
          otherStartRow,
          otherEndRow,
          requirePadding
        );

        if (!overlaps) {
          continue;
        }

        const bothThreeByTen = session.type === '3x10' && otherSession.type === '3x10';
        if (bothThreeByTen) {
          if (roomOverlapSeverity === null) {
            roomOverlapSeverity = 'yellow';
          }
        } else {
          roomOverlapSeverity = 'red';
          break;
        }
      }

      if (roomOverlapSeverity) {
        if (roomOverlapSeverity === 'red') {
          return 'red';
        }
        severity = severity ?? 'yellow';
      }
    }
  }

  return severity;
};

export type ConflictSeverity = 'red' | 'yellow';

export type ConflictDetail =
  | {
      type: 'category';
      entrantName: string;
      category: string;
      severity: ConflictSeverity;
    }
  | {
      type: 'entrant';
      entrantName: string;
      severity: ConflictSeverity;
    }
  | {
      type: 'room';
      roomNumber: string;
      severity: ConflictSeverity;
    }
  | {
    type: 'late';
    entrantName: string;
    severity: ConflictSeverity;
  }
  | {
      type: 'judgeOvertime';
      judgeName: string;
      totalMinutes: number;
      severity: ConflictSeverity;
    }
  | {
    type: 'unpaddedChorusChange';
    roomNumber: string;
    entrantName: string;
    severity: ConflictSeverity;
  };

export const getConflictDetails = (
  scheduledSessions: SessionBlock[],
  judges: Judge[],
  entrants: Entrant[],
  settings: SessionSettings
): ConflictDetail[] => {
  const conflicts = new Set<string>();
  const conflictList: ConflictDetail[] = [];

  const lateSessions = scheduledSessions.filter(session =>
    isSessionEndingAfter1AM(session, settings)
  );

  if (lateSessions.length > 0) {
    conflictList.push({
      type: 'late',
      entrantName: lateSessions.map(s => s.entrantName).join(', '),
      severity: 'yellow'
    });
  }

  scheduledSessions.forEach(session => {
    const sessionConflictSeverity = getSessionConflictSeverity(
      session,
      scheduledSessions,
      judges,
      entrants,
      settings
    );
    if (!sessionConflictSeverity) {
      return;
    }

    const currentJudge = judges.find(j => j.id === session.judgeId);
    const currentJudgeCategory = currentJudge?.category;
    const currentEntrant = entrants.find(e => e.id === session.entrantId);
    const currentEntrantRoom = currentEntrant?.roomNumber;

    if (currentJudgeCategory) {
      const sameCategorySameEntrant = scheduledSessions.some(otherSession => {
        if (otherSession.id === session.id || otherSession.entrantId !== session.entrantId) {
          return false;
        }
        const otherJudge = judges.find(j => j.id === otherSession.judgeId);
        return otherJudge?.category === currentJudgeCategory;
      });

      if (sameCategorySameEntrant) {
        const conflictKey = `category-${session.entrantId}-${currentJudgeCategory}`;
        if (!conflicts.has(conflictKey)) {
          conflicts.add(conflictKey);
          conflictList.push({
            type: 'category',
            entrantName: session.entrantName,
            category: currentJudgeCategory,
            severity: 'yellow'
          });
        }
      }
    }

    const sessionStartRow = session.startRowIndex ?? 0;
    const sessionDuration = getSessionDurationInSlots(session.type, settings);
    const sessionEndRow = sessionStartRow + sessionDuration - 1;

    const hasEntrantOverlap = scheduledSessions.some(otherSession => {
      if (otherSession.id === session.id || otherSession.entrantId !== session.entrantId) return false;

      const otherStartRow = otherSession.startRowIndex ?? 0;
      const otherDuration = getSessionDurationInSlots(otherSession.type, settings);
      const otherEndRow = otherStartRow + otherDuration - 1;

      return doTimeRangesOverlap(sessionStartRow, sessionEndRow, otherStartRow, otherEndRow);
    });

    if (hasEntrantOverlap) {
      const conflictKey = `entrant-${session.entrantId}`;
      if (!conflicts.has(conflictKey)) {
        conflicts.add(conflictKey);
        conflictList.push({
          type: 'entrant',
          entrantName: session.entrantName,
          severity: 'red'
        });
      }
    }

    if (settings.moving === 'judges' && currentEntrantRoom) {
      let hasRoomOverlap = false;
      let roomOverlapSeverity: ConflictSeverity | null = null;

      for (const otherSession of scheduledSessions) {
        if (otherSession.id === session.id) continue;

        const otherEntrant = entrants.find(e => e.id === otherSession.entrantId);
        if (otherEntrant?.roomNumber !== currentEntrantRoom) continue;

        const otherStartRow = otherSession.startRowIndex ?? 0;
        const otherDuration = getSessionDurationInSlots(otherSession.type, settings);
        const otherEndRow = otherStartRow + otherDuration - 1;

        if (!doTimeRangesOverlap(sessionStartRow, sessionEndRow, otherStartRow, otherEndRow)) {
          continue;
        }

        hasRoomOverlap = true;
        const bothThreeByTen = session.type === '3x10' && otherSession.type === '3x10';
        if (bothThreeByTen) {
          if (roomOverlapSeverity === null) {
            roomOverlapSeverity = 'yellow';
          }
        } else {
          roomOverlapSeverity = 'red';
          break;
        }
      }

      if (hasRoomOverlap) {
        const conflictKey = `room-${currentEntrantRoom}`;
        if (!conflicts.has(conflictKey)) {
          conflicts.add(conflictKey);
          conflictList.push({
            type: 'room',
            roomNumber: currentEntrantRoom,
            severity: roomOverlapSeverity ?? 'red'
          });
        }
      }

      if (!hasRoomOverlap) {
        const hasUnpaddedChorusChange = scheduledSessions.some(otherSession => {
          if (otherSession.id === session.id) return false;

          const otherEntrant = entrants.find(e => e.id === otherSession.entrantId);
          if (otherEntrant?.roomNumber !== currentEntrantRoom) return false;

          const otherStartRow = otherSession.startRowIndex ?? 0;
          const otherDuration = getSessionDurationInSlots(otherSession.type, settings);
          const otherEndRow = otherStartRow + otherDuration - 1;

          return doTimeRangesOverlap(
            sessionStartRow,
            sessionEndRow,
            otherStartRow,
            otherEndRow,
            true
          );
        });

        if (hasUnpaddedChorusChange) {
          const conflictKey = `unpaddedChorusChange-${currentEntrantRoom}`;
          if (!conflicts.has(conflictKey)) {
            conflicts.add(conflictKey);
            conflictList.push({
              type: 'unpaddedChorusChange',
              roomNumber: currentEntrantRoom,
              entrantName: session.entrantName,
              severity: 'yellow'
            });
          }
        }
      }
    }
  });

  const OVERTIME_THRESHOLD_MINUTES = 120;
  judges.forEach(judge => {
    const totalMinutes = getJudgeAssignedTime(judge.id, scheduledSessions, settings);
    if (totalMinutes > OVERTIME_THRESHOLD_MINUTES) {
      const conflictKey = `judgeOvertime-${judge.id}`;
      if (!conflicts.has(conflictKey)) {
        conflicts.add(conflictKey);
        conflictList.push({
          type: 'judgeOvertime',
          judgeName: judge.name,
          totalMinutes,
          severity: 'yellow'
        });
      }
    }
  });

  return conflictList;
};

export const buildSessionSwapUpdates = (
  sourceSession: SessionBlock,
  targetSession: SessionBlock,
  settings: SessionSettings
): [SessionBlock, SessionBlock] => {
  const sessionDurationSlots = getSessionDurationInSlots(sourceSession.type, settings);

  const updatedSource: SessionBlock = {
    ...sourceSession,
    startRowIndex: targetSession.startRowIndex,
    endRowIndex:
      targetSession.startRowIndex !== undefined
        ? targetSession.startRowIndex + sessionDurationSlots - 1
        : undefined,
    judgeId: targetSession.judgeId,
    isScheduled: true
  };

  const updatedTarget: SessionBlock = {
    ...targetSession,
    startRowIndex: sourceSession.startRowIndex,
    endRowIndex:
      sourceSession.startRowIndex !== undefined
        ? sourceSession.startRowIndex + sessionDurationSlots - 1
        : undefined,
    judgeId: sourceSession.judgeId,
    isScheduled: true
  };

  return [updatedSource, updatedTarget];
};

interface SessionSchedulingState {
  isScheduled: boolean;
  judgeId?: string;
  startRowIndex?: number;
}

const captureSchedulingState = (session: SessionBlock): SessionSchedulingState => ({
  isScheduled: session.isScheduled === true,
  judgeId: session.judgeId,
  startRowIndex: session.startRowIndex
});

const applySchedulingState = (
  session: SessionBlock,
  state: SessionSchedulingState,
  settings: SessionSettings
): SessionBlock => {
  if (state.isScheduled && state.startRowIndex !== undefined && state.judgeId) {
    const durationSlots = getSessionDurationInSlots(session.type, settings);
    const startRow = state.startRowIndex;
    return {
      ...session,
      isScheduled: true,
      judgeId: state.judgeId,
      startRowIndex: startRow,
      endRowIndex: startRow + durationSlots - 1
    };
  }

  return {
    ...session,
    isScheduled: false,
    judgeId: undefined,
    startRowIndex: undefined,
    endRowIndex: undefined
  };
};

export const buildEntrantSwapUpdates = (
  sourceSessions: SessionBlock[],
  targetSessions: SessionBlock[],
  settings: SessionSettings
): SessionBlock[] => {
  if (sourceSessions.length === 0 || targetSessions.length === 0) {
    return [];
  }

  const targetByIndex = new Map<number, SessionBlock>();
  targetSessions.forEach(session => {
    const key = session.sessionIndex ?? 0;
    targetByIndex.set(key, session);
  });

  const updates: SessionBlock[] = [];
  const processed = new Set<number>();

  sourceSessions.forEach(sourceSession => {
    const key = sourceSession.sessionIndex ?? 0;
    if (processed.has(key)) return;
    const matchingTarget = targetByIndex.get(key);
    if (!matchingTarget) return;

    const sourceState = captureSchedulingState(sourceSession);
    const targetState = captureSchedulingState(matchingTarget);

    const updatedSource = applySchedulingState(sourceSession, targetState, settings);
    const updatedTarget = applySchedulingState(matchingTarget, sourceState, settings);

    updates.push(updatedSource, updatedTarget);
    processed.add(key);
  });

  return updates;
};

