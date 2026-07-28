import type { PersonScheduleRow } from './publishedPersonSchedule';
import { timeToSortValue } from './printHelpers';

function getWallClockMinutes(now: Date): number {
  return now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
}

/** Map wall clock to the schedule's extended-hour coordinate system. */
export function getScheduleNowMinutes(
  now: Date,
  eventStartTime: string,
  rows: PersonScheduleRow[]
): number {
  const eventStartMinutes = timeToSortValue(eventStartTime);
  const nowMinutes = getWallClockMinutes(now);
  const scheduleExtendsPastMidnight = rows.some(
    (row) => !row.isBye && timeToSortValue(row.endTime) >= 24 * 60
  );

  if (nowMinutes < eventStartMinutes && scheduleExtendsPastMidnight) {
    return nowMinutes + 24 * 60;
  }

  return nowMinutes;
}

export function findActiveSessionRow(
  rows: PersonScheduleRow[],
  eventStartTime: string,
  now: Date = new Date()
): PersonScheduleRow | null {
  const nowMinutes = getScheduleNowMinutes(now, eventStartTime, rows);

  for (const row of rows) {
    if (row.isBye) continue;

    const start = timeToSortValue(row.startTime);
    const end = timeToSortValue(row.endTime);

    if (end > start) {
      if (nowMinutes >= start && nowMinutes < end) return row;
    } else if (nowMinutes >= start || nowMinutes < end) {
      return row;
    }
  }

  return null;
}

export function getRemainingSeconds(
  row: PersonScheduleRow,
  eventStartTime: string,
  rows: PersonScheduleRow[],
  now: Date = new Date()
): number {
  const nowMinutes = getScheduleNowMinutes(now, eventStartTime, rows);
  const end = timeToSortValue(row.endTime);
  const remainingMinutes = end - nowMinutes;
  return Math.max(0, Math.ceil(remainingMinutes * 60));
}

export function formatCountdown(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
