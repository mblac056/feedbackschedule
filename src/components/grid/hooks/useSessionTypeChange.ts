import { useCallback } from 'react';
import type { Entrant, SessionBlock } from '../../../types';
import { buildBlocksAfterSessionTypeChange } from '../../../utils/sessionTypeChange';

interface UseSessionTypeChangeParams {
  allSessionBlocks: SessionBlock[];
  entrants: Entrant[];
  onSessionBlocksReplace: (blocks: SessionBlock[]) => void;
}

export function useSessionTypeChange({
  allSessionBlocks,
  entrants,
  onSessionBlocksReplace,
}: UseSessionTypeChangeParams) {
  const handleSessionTypeChange = useCallback(
    (entrantId: string, oldType: '1xLong' | '3x20' | '3x10', newType: '1xLong' | '3x20' | '3x10') => {
      const entrant = entrants.find((item) => item.id === entrantId);
      onSessionBlocksReplace(
        buildBlocksAfterSessionTypeChange(allSessionBlocks, entrant, oldType, newType)
      );
    },
    [allSessionBlocks, entrants, onSessionBlocksReplace]
  );

  return { handleSessionTypeChange };
}
