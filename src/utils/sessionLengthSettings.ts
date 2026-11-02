import type { SessionSettings } from '../config/timeConfig';
import type { SessionBlock } from '../types';
import { getSessionDurationInSlots } from './scheduleHelpers';

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

export function refreshScheduledEndRowIndexes(
  blocks: SessionBlock[],
  settings: SessionSettings
): SessionBlock[] {
  return blocks.map((block) => {
    if (!block.isScheduled || block.startRowIndex === undefined) {
      return block;
    }
    const durationSlots = getSessionDurationInSlots(block.type, settings);
    return {
      ...block,
      endRowIndex: block.startRowIndex + durationSlots - 1,
    };
  });
}
