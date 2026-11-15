import type { FlowDocumentEntry } from './flowDocument';
import { timeToSortValue } from './printHelpers';

/** How long a moment stays "happening now" after its listed time. */
export const FLOW_NOW_BUFFER_MINUTES = 5;
/** How early before the first entry the live view switches on. */
export const FLOW_LEAD_IN_MINUTES = 30;

const DAY_MINUTES = 24 * 60;
const HALF_DAY_MINUTES = 12 * 60;

/**
 * - past: more than the buffer ago, so clearly done
 * - now: at or after its time, within the buffer
 * - next: the first entry still to come
 * - later: everything after that
 * - idle: the schedule isn't running, so nothing is marked
 */
export type FlowEntryStatus = 'past' | 'now' | 'next' | 'later' | 'idle';

export interface FlowTimeline {
  live: boolean;
  statuses: FlowEntryStatus[];
  /** Index the "now" marker sits before (entries.length = after the last one). */
  markerIndex: number;
  /** Schedule clock now, in minutes (may be >= 24h for schedules past midnight). */
  nowMinutes: number;
  /** Whole minutes until the next entry, when there is one. */
  minutesUntilNext?: number;
}

/**
 * Map the wall clock onto the schedule's clock. Schedules carry no date, so this
 * matches the personal countdown: past-midnight schedules count on past 24:00,
 * and an all-morning schedule also runs 12 hours later (for 12-hour time entry).
 */
export function getFlowNowMinutes(now: Date, startTime: string, entryMinutes: number[]): number {
  const wall = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
  if (entryMinutes.length === 0) return wall;

  const last = Math.max(...entryMinutes);
  if (last >= DAY_MINUTES && wall < timeToSortValue(startTime)) {
    return wall + DAY_MINUTES;
  }
  if (last < HALF_DAY_MINUTES && wall >= HALF_DAY_MINUTES) {
    return wall - HALF_DAY_MINUTES;
  }
  return wall;
}

export function getFlowTimeline(
  entries: FlowDocumentEntry[],
  startTime: string,
  now: Date
): FlowTimeline {
  const minutes = entries.map((entry) => timeToSortValue(entry.time));
  const nowMinutes = getFlowNowMinutes(now, startTime, minutes);
  const idle: FlowTimeline = {
    live: false,
    statuses: entries.map(() => 'idle'),
    markerIndex: -1,
    nowMinutes,
  };
  if (entries.length === 0) return idle;

  const first = minutes[0];
  const last = minutes[minutes.length - 1];
  if (nowMinutes < first - FLOW_LEAD_IN_MINUTES || nowMinutes > last + FLOW_NOW_BUFFER_MINUTES) {
    return idle;
  }

  let markerIndex = minutes.findIndex((m) => m > nowMinutes);
  if (markerIndex === -1) markerIndex = entries.length;

  const statuses = minutes.map((m, index): FlowEntryStatus => {
    if (m > nowMinutes) return index === markerIndex ? 'next' : 'later';
    return nowMinutes - m <= FLOW_NOW_BUFFER_MINUTES ? 'now' : 'past';
  });

  return {
    live: true,
    statuses,
    markerIndex,
    nowMinutes,
    minutesUntilNext:
      markerIndex < entries.length ? Math.ceil(minutes[markerIndex] - nowMinutes) : undefined,
  };
}
