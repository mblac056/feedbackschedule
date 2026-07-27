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
}

export interface PersonScheduleView {
  kind: 'entrant' | 'judge';
  name: string;
  moving: 'judges' | 'groups';
  /** Person's fixed room, shown above the table when they are not moving. */
  ownRoom?: string;
  showRoomColumn: boolean;
  rows: PersonScheduleRow[];
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
    const rows = payload.sessions
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
      })
      .sort((a, b) => a.startTime.localeCompare(b.startTime));

    return {
      kind: 'entrant',
      name: entrant.name,
      moving: settings.moving,
      ownRoom: settings.moving === 'judges' ? entrant.roomNumber : undefined,
      showRoomColumn,
      rows,
    };
  }

  const judge = judgeById.get(entry.id);
  if (!judge) return null;

  const showRoomColumn = settings.moving === 'judges';
  const rows = payload.sessions
    .filter((s) => s.judgeId === entry.id)
    .map((session) => {
      const entrant = entrantById.get(session.entrantId);
      const duration = getSessionDurationMinutes(session.type, settings as SessionSettings);
      const startTime = rowIndexToTime(session.startRowIndex, settings.startTime);
      const endTime = addMinutesToTime(startTime, duration);
      return {
        startTime,
        endTime,
        timeLabel: `${formatTimeForDisplay(startTime)}-${formatTimeForDisplay(endTime)}`,
        counterpart: entrant?.name ?? session.entrantName ?? 'Unknown',
        sessionType: session.type,
        roomNumber: showRoomColumn ? entrant?.roomNumber : undefined,
      };
    })
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  return {
    kind: 'judge',
    name: judge.category ? `${judge.name} (${judge.category})` : judge.name,
    moving: settings.moving,
    ownRoom: settings.moving === 'groups' ? judge.roomNumber : undefined,
    showRoomColumn,
    rows,
  };
}
