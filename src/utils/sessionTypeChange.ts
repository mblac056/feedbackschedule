import type { Entrant, SessionBlock } from '../types';

type SessionType = '1xLong' | '3x20' | '3x10';

function createBlocksForType(entrant: Entrant, type: SessionType): SessionBlock[] {
  if (type === '1xLong') {
    return [
      {
        id: `${entrant.id}-1xlong`,
        entrantId: entrant.id,
        entrantName: entrant.name,
        type: '1xLong',
        isScheduled: false,
      },
    ];
  }

  return [0, 1, 2].map((sessionIndex) => ({
    id: `${entrant.id}-${type}-${sessionIndex}`,
    entrantId: entrant.id,
    entrantName: entrant.name,
    type,
    sessionIndex,
    isScheduled: false,
  }));
}

export function buildBlocksAfterSessionTypeChange(
  allSessionBlocks: SessionBlock[],
  entrant: Entrant | undefined,
  oldType: SessionType,
  newType: SessionType
): SessionBlock[] {
  if (!entrant) return allSessionBlocks;

  const withoutOld = allSessionBlocks.filter(
    (block) => !(block.entrantId === entrant.id && block.type === oldType)
  );
  return [...withoutOld, ...createBlocksForType(entrant, newType)];
}
