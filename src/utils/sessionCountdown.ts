import type { PersonScheduleRow } from './publishedPersonSchedule';
import { timeToSortValue } from './printHelpers';

const NOON_MINUTES = 12 * 60;
const TWELVE_HOURS_MINUTES = 12 * 60;

interface SessionTimeWindow {
  start: number;
  end: number;
}

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

function isInSessionWindow(nowMinutes: number, start: number, end: number): boolean {
  if (end > start) {
    return nowMinutes >= start && nowMinutes < end;
  }
  return nowMinutes >= start || nowMinutes < end;
}

/**
 * Schedule windows for countdown matching.
 * Sub-noon non-wrapping sessions also get a +12h mirror so e.g. 10:00–10:20
 * arms at both 10:00 and 22:00 wall clock. Military evening times (22:00) do not
 * mirror back to morning. Display labels are unchanged.
 */
export function getSessionTimeWindows(row: PersonScheduleRow): SessionTimeWindow[] {
  const start = timeToSortValue(row.startTime);
  const end = timeToSortValue(row.endTime);
  const windows: SessionTimeWindow[] = [{ start, end }];

  if (end > start && start < NOON_MINUTES && end < NOON_MINUTES) {
    windows.push({
      start: start + TWELVE_HOURS_MINUTES,
      end: end + TWELVE_HOURS_MINUTES,
    });
  }

  return windows;
}

export function findActiveSessionRow(
  rows: PersonScheduleRow[],
  eventStartTime: string,
  now: Date = new Date()
): PersonScheduleRow | null {
  const nowMinutes = getScheduleNowMinutes(now, eventStartTime, rows);

  for (const row of rows) {
    if (row.isBye) continue;

    for (const { start, end } of getSessionTimeWindows(row)) {
      if (isInSessionWindow(nowMinutes, start, end)) return row;
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
  const matching = getSessionTimeWindows(row).find(({ start, end }) =>
    isInSessionWindow(nowMinutes, start, end)
  );
  const end = matching?.end ?? timeToSortValue(row.endTime);
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
