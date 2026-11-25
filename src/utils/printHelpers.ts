import type { TimeFormat } from '../config/timeConfig';

const parseWrapped = (time: string): { hours: number; minutes: number } => {
  const [hours, minutes] = time.split(':').map(Number);
  return { hours: ((hours % 24) + 24) % 24, minutes };
};

const meridiem = (hours: number): 'AM' | 'PM' => (hours < 12 ? 'AM' : 'PM');

// Format an "HH:MM" time for display, wrapping hours >= 24 to the next day.
// 24h: 24:10 -> 00:10, 13:05 -> 13:05. 12h: 00:10 -> 12:10 AM, 13:05 -> 1:05 PM.
export const formatTimeForDisplay = (time: string, format: TimeFormat = '24h'): string => {
  const { hours, minutes } = parseWrapped(time);
  const mm = minutes.toString().padStart(2, '0');
  if (format === '12h') {
    return `${hours % 12 || 12}:${mm} ${meridiem(hours)}`;
  }
  return `${hours.toString().padStart(2, '0')}:${mm}`;
};

// Format a start-end range. In 12h mode the AM/PM is only shown once when both ends share it,
// e.g. "9:00-9:20 AM" but "11:50 AM-12:10 PM".
export const formatTimeRange = (start: string, end: string, format: TimeFormat = '24h'): string => {
  if (format === '12h') {
    const s = parseWrapped(start);
    const e = parseWrapped(end);
    if (meridiem(s.hours) === meridiem(e.hours)) {
      return `${s.hours % 12 || 12}:${s.minutes.toString().padStart(2, '0')}-${formatTimeForDisplay(end, format)}`;
    }
  }
  return `${formatTimeForDisplay(start, format)}-${formatTimeForDisplay(end, format)}`;
};

// Helper function to convert time string to sortable numeric value (minutes since midnight)
// e.g., "24:10" -> 1450, "25:15" -> 1515
export const timeToSortValue = (time: string): number => {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};
