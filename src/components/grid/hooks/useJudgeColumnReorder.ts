import { useState } from 'react';
import type { DragEvent as ReactDragEvent } from 'react';
import type { Judge } from '../../../types';

interface UseJudgeColumnReorderParams {
  judges: Judge[];
  onJudgesReorder?: (reorderedJudges: Judge[]) => void;
}

export function useJudgeColumnReorder({ judges, onJudgesReorder }: UseJudgeColumnReorderParams) {
  const [draggedJudgeId, setDraggedJudgeId] = useState<string | null>(null);
  const [dragOverJudgeId, setDragOverJudgeId] = useState<string | null>(null);

  const handleDragStart = (e: ReactDragEvent, judgeId: string) => {
    setDraggedJudgeId(judgeId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', judgeId);
  };

  const handleDragOver = (e: ReactDragEvent, judgeId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggedJudgeId && draggedJudgeId !== judgeId) {
      setDragOverJudgeId(judgeId);
    }
  };

  const handleDragLeave = () => {
    setDragOverJudgeId(null);
  };

  const handleDrop = (e: ReactDragEvent, targetJudgeId: string) => {
    e.preventDefault();
    if (!draggedJudgeId || draggedJudgeId === targetJudgeId) return;

    const draggedIndex = judges.findIndex(judge => judge.id === draggedJudgeId);
    const targetIndex = judges.findIndex(judge => judge.id === targetJudgeId);

    if (draggedIndex === -1 || targetIndex === -1) return;

    const newJudges = [...judges];
    const [draggedJudge] = newJudges.splice(draggedIndex, 1);
    newJudges.splice(targetIndex, 0, draggedJudge);

    onJudgesReorder?.(newJudges);
    setDraggedJudgeId(null);
    setDragOverJudgeId(null);
  };

  const handleDragEnd = () => {
    setDraggedJudgeId(null);
    setDragOverJudgeId(null);
  };

  return {
    draggedJudgeId,
    dragOverJudgeId,
    handleDragStart,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleDragEnd,
  };
}
