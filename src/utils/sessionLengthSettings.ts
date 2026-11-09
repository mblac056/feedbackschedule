import type { SessionSettings } from '../config/timeConfig';

export function anySessionLengthIncreased(
  next: SessionSettings,
  previous: SessionSettings
): boolean {
  return (
    next.oneXLongLength > previous.oneXLongLength ||
    next.threeX20Length > previous.threeX20Length ||
    next.threeX10Length > previous.threeX10Length
  );
}
