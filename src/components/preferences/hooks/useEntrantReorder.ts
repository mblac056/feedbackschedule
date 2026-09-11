import { useState } from 'react';
import type { DragEvent as ReactDragEvent } from 'react';
import type { Entrant, SessionBlock } from '../../../types';
import { saveEntrants, reorderSessionBlocksByEntrants } from '../../../utils/localStorage';
import { reorderEntrantsByIds } from '../../../utils/entrantOrder';

interface UseEntrantReorderParams {
  entrants: Entrant[];
  sessionBlocks: SessionBlock[];
  onSessionBlocksReplace: (blocks: SessionBlock[]) => void;
}

export function useEntrantReorder({
  entrants,
  sessionBlocks,
  onSessionBlocksReplace,
}: UseEntrantReorderParams) {
  const [draggedEntrantId, setDraggedEntrantId] = useState<string | null>(null);
  const [dragOverEntrantId, setDragOverEntrantId] = useState<string | null>(null);

  const handleDragStart = (e: ReactDragEvent, entrantId: string) => {
    setDraggedEntrantId(entrantId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', entrantId);
  };

  const handleDragOver = (e: ReactDragEvent, entrantId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggedEntrantId && draggedEntrantId !== entrantId) {
      setDragOverEntrantId(entrantId);
    }
  };

  const handleDragLeave = () => {
    setDragOverEntrantId(null);
  };

  const handleDrop = (e: ReactDragEvent, targetEntrantId: string) => {
    e.preventDefault();
    if (!draggedEntrantId || draggedEntrantId === targetEntrantId) return;

    const includedIds = new Set(
      entrants.filter((entrant) => entrant.includeInSchedule).map((entrant) => entrant.id)
    );
    if (!includedIds.has(draggedEntrantId) || !includedIds.has(targetEntrantId)) return;

    const reorderedEntrants = reorderEntrantsByIds(entrants, draggedEntrantId, targetEntrantId);
    if (!reorderedEntrants) return;

    if (!saveEntrants(reorderedEntrants)) {
      setDraggedEntrantId(null);
      setDragOverEntrantId(null);
      return;
    }

    onSessionBlocksReplace(reorderSessionBlocksByEntrants(sessionBlocks, reorderedEntrants));
    setDraggedEntrantId(null);
    setDragOverEntrantId(null);
  };

  const handleDragEnd = () => {
    setDraggedEntrantId(null);
    setDragOverEntrantId(null);
  };

  return {
    draggedEntrantId,
    dragOverEntrantId,
    handleDragStart,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleDragEnd,
  };
}
