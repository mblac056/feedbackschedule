import type { Entrant } from '../types';

export function reorderEntrantsByIds(
  entrants: Entrant[],
  draggedId: string,
  targetId: string
): Entrant[] | null {
  const draggedIndex = entrants.findIndex((entrant) => entrant.id === draggedId);
  const targetIndex = entrants.findIndex((entrant) => entrant.id === targetId);
  if (draggedIndex === -1 || targetIndex === -1) return null;

  const next = [...entrants];
  const [moved] = next.splice(draggedIndex, 1);
  next.splice(targetIndex, 0, moved);
  return next;
}
