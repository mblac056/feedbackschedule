import { describe, expect, it } from 'vitest';
import { getFlowNowMinutes, getFlowTimeline } from './flowTimeline';

const at = (hhmm: string, seconds = 0) => {
  const [h, m] = hhmm.split(':').map(Number);
  return new Date(2026, 10, 15, h, m, seconds);
};

const entries = ['14:00', '14:15', '14:20', '14:40', '15:00'].map((time) => ({
  time,
  events: [`event at ${time}`],
}));

describe('getFlowTimeline', () => {
  it('is idle well before the schedule and after it finishes', () => {
    expect(getFlowTimeline(entries, '14:00', at('13:00')).live).toBe(false);
    expect(getFlowTimeline(entries, '14:00', at('15:06')).live).toBe(false);
  });

  it('shows the first entry as next during the lead-in', () => {
    const timeline = getFlowTimeline(entries, '14:00', at('13:45'));
    expect(timeline.live).toBe(true);
    expect(timeline.markerIndex).toBe(0);
    expect(timeline.statuses).toEqual(['next', 'later', 'later', 'later', 'later']);
    expect(timeline.minutesUntilNext).toBe(15);
  });

  it('keeps entries "now" for 5 minutes, then greys them out', () => {
    const timeline = getFlowTimeline(entries, '14:00', at('14:22'));
    expect(timeline.statuses).toEqual(['past', 'past', 'now', 'next', 'later']);
    expect(timeline.markerIndex).toBe(3);
    expect(timeline.minutesUntilNext).toBe(18);
  });

  it('places the marker after the last entry while it is still happening', () => {
    const timeline = getFlowTimeline(entries, '14:00', at('15:03'));
    expect(timeline.statuses.at(-1)).toBe('now');
    expect(timeline.markerIndex).toBe(entries.length);
    expect(timeline.minutesUntilNext).toBeUndefined();
  });

  it('treats a schedule past midnight as continuing after 24:00', () => {
    const late = [{ time: '23:50', events: [] }, { time: '24:10', events: [] }];
    const timeline = getFlowTimeline(late, '23:30', at('00:05'));
    expect(timeline.statuses).toEqual(['past', 'next']);
  });
});

describe('getFlowNowMinutes', () => {
  it('runs an all-morning schedule again in the evening', () => {
    expect(getFlowNowMinutes(at('21:30'), '09:00', [9 * 60, 11 * 60])).toBe(9 * 60 + 30);
    expect(getFlowNowMinutes(at('21:30'), '13:00', [13 * 60])).toBe(21 * 60 + 30);
  });
});
