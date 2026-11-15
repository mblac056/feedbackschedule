import { TIME_CONFIG } from '../config/timeConfig';

/**
 * Schedule times are "HH:MM" strings in an extended-hour clock: a schedule that
 * runs past midnight keeps counting (24:10, 25:15) so times still sort as strings.
 */

export function rowIndexToTime(rowIndex: number, startTime: string): string {
  const [startHour, startMinute] = startTime.split(':').map(Number);
  const totalMinutes = startMinute + rowIndex * TIME_CONFIG.MINUTES_PER_SLOT;
  const hour = startHour + Math.floor(totalMinutes / 60);
  const minute = totalMinutes % 60;
  return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
}

export function addMinutesToTime(timeStr: string, minutes: number): string {
  const [hours, mins] = timeStr.split(':').map(Number);
  const totalMinutes = hours * 60 + mins + minutes;
  const newHours = Math.floor(totalMinutes / 60);
  const newMins = totalMinutes % 60;
  return `${newHours.toString().padStart(2, '0')}:${newMins.toString().padStart(2, '0')}`;
}

export interface ScheduleBye {
  startTime: string;
  endTime: string;
  duration: number;
}

/**
 * Gaps between consecutive sessions (already sorted by start time).
 * `wrapMidnight` matches judge schedules: negative gaps wrap by 24h, and a gap
 * from the last session back to the first is added when the schedule wraps.
 */
export function findByes(
  sortedSessions: Array<{ startTime: string; endTime: string }>,
  { wrapMidnight }: { wrapMidnight: boolean }
): ScheduleBye[] {
  const toMinutes = (time: string) => {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  };

  const byes: ScheduleBye[] = [];
  for (let i = 0; i < sortedSessions.length - 1; i++) {
    const currentEnd = sortedSessions[i].endTime;
    const nextStart = sortedSessions[i + 1].startTime;
    if (currentEnd === nextStart) continue;

    let duration = toMinutes(nextStart) - toMinutes(currentEnd);
    if (wrapMidnight && duration < 0) duration += 24 * 60;
    byes.push({ startTime: currentEnd, endTime: nextStart, duration });
  }

  if (wrapMidnight && sortedSessions.length > 1) {
    const lastEnd = sortedSessions[sortedSessions.length - 1].endTime;
    const firstStart = sortedSessions[0].startTime;
    if (toMinutes(lastEnd) < toMinutes(firstStart)) {
      byes.push({
        startTime: lastEnd,
        endTime: firstStart,
        duration: toMinutes(firstStart) - toMinutes(lastEnd),
      });
    }
  }

  return byes;
}
