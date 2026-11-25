import { describe, expect, it } from 'vitest';
import { formatTimeForDisplay, formatTimeRange } from './printHelpers';

describe('formatTimeForDisplay', () => {
  it('defaults to 24-hour and wraps past midnight', () => {
    expect(formatTimeForDisplay('09:05')).toBe('09:05');
    expect(formatTimeForDisplay('13:30')).toBe('13:30');
    expect(formatTimeForDisplay('25:15')).toBe('01:15');
  });

  it('formats 12-hour times with AM/PM', () => {
    expect(formatTimeForDisplay('00:10', '12h')).toBe('12:10 AM');
    expect(formatTimeForDisplay('09:05', '12h')).toBe('9:05 AM');
    expect(formatTimeForDisplay('12:00', '12h')).toBe('12:00 PM');
    expect(formatTimeForDisplay('13:30', '12h')).toBe('1:30 PM');
    expect(formatTimeForDisplay('24:10', '12h')).toBe('12:10 AM');
  });
});

describe('formatTimeRange', () => {
  it('joins 24-hour times', () => {
    expect(formatTimeRange('21:40', '22:00')).toBe('21:40-22:00');
  });

  it('shows the meridiem once when both ends share it', () => {
    expect(formatTimeRange('09:00', '09:20', '12h')).toBe('9:00-9:20 AM');
  });

  it('shows both meridiems when the range crosses noon or midnight', () => {
    expect(formatTimeRange('11:50', '12:10', '12h')).toBe('11:50 AM-12:10 PM');
    expect(formatTimeRange('23:50', '24:10', '12h')).toBe('11:50 PM-12:10 AM');
  });
});
