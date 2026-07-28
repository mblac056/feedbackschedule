import type { PublishedSchedulePayload } from '../types/publishedSchedule';
import { getSessionDurationMinutes, TIME_CONFIG, type SessionSettings } from '../config/timeConfig';
import { formatTimeForDisplay } from './printHelpers';

export interface PersonScheduleRow {
  startTime: string;
  endTime: string;
  timeLabel: string;
  counterpart: string;
  sessionType: string;
  roomNumber?: string;
  orderOfAppearance?: string;
  isBye?: boolean;
}

export interface PersonScheduleView {
  kind: 'entrant' | 'judge';
  name: string;
  moving: 'judges' | 'groups';
  /** Person's fixed room, shown above the table when they are not moving. */
  ownRoom?: string;
  /** Entrant's single session type, shown above the table (groups only have one). */
  ownSessionType?: string;
  showRoomColumn: boolean;
  /** Judge schedules only: show Order of Appearance when any row has SF/F data. */
  showOrderColumn: boolean;
  rows: PersonScheduleRow[];
}

/** Match print judge schedules: one number, or `SF: x, F: y` when both exist. */
function formatOrderOfAppearance(overallSF?: number, overallF?: number): string | undefined {
  const hasSF = overallSF !== undefined;
  const hasF = overallF !== undefined;
  if (hasSF && hasF) return `SF: ${overallSF}, F: ${overallF}`;
  if (hasSF) return String(overallSF);
  if (hasF) return String(overallF);
  return undefined;
}

function rowIndexToTime(rowIndex: number, startTime: string): string {
  const [startHour, startMinute] = startTime.split(':').map(Number);
  const totalMinutes = startMinute + rowIndex * TIME_CONFIG.MINUTES_PER_SLOT;
  const hour = startHour + Math.floor(totalMinutes / 60);
  const minute = totalMinutes % 60;
  return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
}

function addMinutesToTime(timeStr: string, minutes: number): string {
  const [hours, mins] = timeStr.split(':').map(Number);
  const totalMinutes = hours * 60 + mins + minutes;
  const newHours = Math.floor(totalMinutes / 60);
  const newMins = totalMinutes % 60;
  return `${newHours.toString().padStart(2, '0')}:${newMins.toString().padStart(2, '0')}`;
}

function minutesBetween(start: string, end: string): number {
  const [startHours, startMins] = start.split(':').map(Number);
  const [endHours, endMins] = end.split(':').map(Number);
  let duration = endHours * 60 + endMins - (startHours * 60 + startMins);
  if (duration < 0) {
    duration += 24 * 60;
  }
  return duration;
}

/** Gaps between consecutive sessions become BYE rows (same idea as print schedules). */
function insertByeRows(sessionRows: PersonScheduleRow[]): PersonScheduleRow[] {
  const sorted = [...sessionRows].sort((a, b) => a.startTime.localeCompare(b.startTime));
  const combined: PersonScheduleRow[] = [];

  for (let i = 0; i < sorted.length; i++) {
    combined.push(sorted[i]);
    if (i < sorted.length - 1) {
      const currentEnd = sorted[i].endTime;
      const nextStart = sorted[i + 1].startTime;
      if (currentEnd !== nextStart) {
        const duration = minutesBetween(currentEnd, nextStart);
        if (duration > 0) {
          combined.push({
            startTime: currentEnd,
            endTime: nextStart,
            timeLabel: `${formatTimeForDisplay(currentEnd)}-${formatTimeForDisplay(nextStart)}`,
            counterpart: `BYE (${duration} min)`,
            sessionType: '',
            isBye: true,
          });
        }
      }
    }
  }

  return combined;
}

/**
 * Build display rows for one entrant or judge from a published payload.
 * Returns null when the slug is missing from slugIndex.
 */
export function buildPersonSchedule(
  payload: PublishedSchedulePayload,
  personSlug: string
): PersonScheduleView | null {
  const entry = payload.slugIndex[personSlug];
  if (!entry) return null;

  const { settings } = payload;
  const judgeById = new Map(payload.judges.map((j) => [j.id, j]));
  const entrantById = new Map(payload.entrants.map((e) => [e.id, e]));

  if (entry.kind === 'entrant') {
    const entrant = entrantById.get(entry.id);
    if (!entrant) return null;

    const showRoomColumn = settings.moving === 'groups';
    const sessionRows = payload.sessions
      .filter((s) => s.entrantId === entry.id)
      .map((session) => {
        const judge = judgeById.get(session.judgeId);
        const duration = getSessionDurationMinutes(session.type, settings as SessionSettings);
        const startTime = rowIndexToTime(session.startRowIndex, settings.startTime);
        const endTime = addMinutesToTime(startTime, duration);
        const judgeLabel = judge
          ? judge.category
            ? `${judge.name} (${judge.category})`
            : judge.name
          : 'Unknown judge';
        return {
          startTime,
          endTime,
          timeLabel: `${formatTimeForDisplay(startTime)}-${formatTimeForDisplay(endTime)}`,
          counterpart: judgeLabel,
          sessionType: session.type,
          roomNumber: showRoomColumn ? judge?.roomNumber : undefined,
        };
      });

    const ownSessionType =
      sessionRows.length > 0 ? sessionRows[0].sessionType : undefined;

    return {
      kind: 'entrant',
      name: entrant.name,
      moving: settings.moving,
      ownRoom: settings.moving === 'judges' ? entrant.roomNumber : undefined,
      ownSessionType,
      showRoomColumn,
      showOrderColumn: false,
      rows: insertByeRows(sessionRows),
    };
  }

  const judge = judgeById.get(entry.id);
  if (!judge) return null;

  const showRoomColumn = settings.moving === 'judges';
  const sessionRows = payload.sessions
    .filter((s) => s.judgeId === entry.id)
    .map((session) => {
      const entrant = entrantById.get(session.entrantId);
      const duration = getSessionDurationMinutes(session.type, settings as SessionSettings);
      const startTime = rowIndexToTime(session.startRowIndex, settings.startTime);
      const endTime = addMinutesToTime(startTime, duration);
      const entrantName = entrant?.name ?? session.entrantName ?? 'Unknown';
      const isFirstPreference = Boolean(entrant?.judgePreference1 && entrant.judgePreference1 === entry.id);
      const orderOfAppearance = formatOrderOfAppearance(entrant?.overallSF, entrant?.overallF);
      return {
        startTime,
        endTime,
        timeLabel: `${formatTimeForDisplay(startTime)}-${formatTimeForDisplay(endTime)}`,
        counterpart: isFirstPreference ? `*${entrantName}` : entrantName,
        sessionType: session.type,
        roomNumber: showRoomColumn ? entrant?.roomNumber : undefined,
        orderOfAppearance,
      };
    });

  const showOrderColumn = sessionRows.some((r) => Boolean(r.orderOfAppearance));

  return {
    kind: 'judge',
    name: judge.category ? `${judge.name} (${judge.category})` : judge.name,
    moving: settings.moving,
    ownRoom: settings.moving === 'groups' ? judge.roomNumber : undefined,
    showRoomColumn,
    showOrderColumn,
    rows: insertByeRows(sessionRows),
  };
}
