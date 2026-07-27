import type { Judge, Entrant, SessionBlock } from '../types';
import type { PublishedSchedulePayload } from '../types/publishedSchedule';
import type { SessionSettings } from '../config/timeConfig';
import { generateMatrixPage } from './printTemplate-matrix';

function toSessionBlocks(payload: PublishedSchedulePayload): SessionBlock[] {
  return payload.sessions.map((s) => ({
    id: s.id,
    entrantId: s.entrantId,
    entrantName: s.entrantName,
    type: s.type,
    sessionIndex: s.sessionIndex,
    startRowIndex: s.startRowIndex,
    endRowIndex: s.endRowIndex,
    judgeId: s.judgeId,
    isScheduled: true,
  }));
}

function toJudges(payload: PublishedSchedulePayload): Judge[] {
  return payload.judges.map((j) => ({
    id: j.id,
    name: j.name,
    category: j.category,
    roomNumber: j.roomNumber,
    active: true,
  }));
}

function toEntrants(payload: PublishedSchedulePayload): Entrant[] {
  return payload.entrants.map((e) => ({
    id: e.id,
    name: e.name,
    groupsToAvoid: [],
    preference: null,
    judgePreference1: '',
    judgePreference2: '',
    judgePreference3: '',
    includeInSchedule: true,
    roomNumber: e.roomNumber,
    groupType: e.groupType,
  }));
}

function toSettings(payload: PublishedSchedulePayload): SessionSettings {
  return {
    startTime: payload.settings.startTime,
    oneXLongLength: payload.settings.oneXLongLength,
    threeX20Length: payload.settings.threeX20Length,
    threeX10Length: payload.settings.threeX10Length,
    moving: payload.settings.moving,
    exportName: payload.exportName,
  };
}

/** Download the full schedule matrix PDF from a published (or preview) payload. */
export async function downloadPublishedMatrixPdf(payload: PublishedSchedulePayload): Promise<void> {
  const blob = await generateMatrixPage(
    toSessionBlocks(payload),
    toJudges(payload),
    toEntrants(payload),
    toSettings(payload)
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const base = payload.exportName?.trim() || 'schedule-matrix';
  a.download = `${base}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}
