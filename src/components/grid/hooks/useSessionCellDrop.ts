import { useCallback, useEffect, useState } from 'react';
import type { DragEvent as ReactDragEvent } from 'react';
import type { SessionSettings } from '../../../config/timeConfig';
import type { DraggedSessionData, SessionBlock } from '../../../types';
import { hasTimeConflict } from '../../../utils/scheduleHelpers';
import type { DragPreview } from '../types';

interface UseSessionCellDropParams {
  scheduledSessions: SessionBlock[];
  allSessionBlocks: SessionBlock[];
  settings: SessionSettings;
  draggedSessionData?: DraggedSessionData | null;
  isGroupDragActive: (draggedSessionData?: DraggedSessionData | null) => boolean;
  getGroupDragPreview: (
    targetJudgeId: string,
    targetTimeSlot: number,
    draggedSession: DraggedSessionData
  ) => Pick<DragPreview, 'isValid' | 'groupShadowFrame'>;
  applyGroupDrop: (
    targetJudgeId: string,
    targetTimeSlot: number,
    draggedSession: DraggedSessionData
  ) => boolean;
  onSessionBlockUpdate: (sessionBlock: SessionBlock) => void;
  onSessionAssigned?: (sessionData: DraggedSessionData) => void;
  onSwapCancel: () => void;
}

export function useSessionCellDrop({
  scheduledSessions,
  allSessionBlocks,
  settings,
  draggedSessionData,
  isGroupDragActive,
  getGroupDragPreview,
  applyGroupDrop,
  onSessionBlockUpdate,
  onSessionAssigned,
  onSwapCancel,
}: UseSessionCellDropParams) {
  const [dragPreview, setDragPreview] = useState<DragPreview | null>(null);

  useEffect(() => {
    if (!draggedSessionData) {
      setDragPreview(null);
    }
  }, [draggedSessionData]);

  const updatePreview = useCallback(
    (judgeId: string, timeSlot: number) => {
      if (!draggedSessionData) return;
      const groupPreview = isGroupDragActive(draggedSessionData)
        ? getGroupDragPreview(judgeId, timeSlot, draggedSessionData)
        : null;
      const isValid = groupPreview
        ? groupPreview.isValid
        : !hasTimeConflict(
            scheduledSessions,
            judgeId,
            timeSlot,
            draggedSessionData.type,
            settings,
            draggedSessionData
          );
      setDragPreview({
        judgeId,
        timeSlot,
        sessionType: draggedSessionData.type,
        isValid,
        groupShadowFrame: groupPreview?.groupShadowFrame,
      });
    },
    [draggedSessionData, getGroupDragPreview, isGroupDragActive, scheduledSessions, settings]
  );

  const handleSessionDrop = (e: ReactDragEvent, judgeId: string, timeSlot: number) => {
    e.preventDefault();
    onSwapCancel();

    try {
      const sessionData = e.dataTransfer.getData('application/json');
      if (!sessionData) return;

      const draggedSession: DraggedSessionData = JSON.parse(sessionData);

      if (draggedSession.groupSessionIds && draggedSession.groupSessionIds.length > 1) {
        const wasGroupApplied = applyGroupDrop(judgeId, timeSlot, draggedSession);
        if (!wasGroupApplied && import.meta.env.DEV) {
          console.warn('Cannot drop session group: invalid location or conflict detected');
        }
        setDragPreview(null);
        return;
      }

      if (hasTimeConflict(scheduledSessions, judgeId, timeSlot, draggedSession.type, settings, draggedSession)) {
        if (import.meta.env.DEV) {
          console.warn('Cannot drop session: time conflict detected');
        }
        return;
      }

      const sessionBlock = allSessionBlocks.find(
        (block) =>
          block.entrantId === draggedSession.entrantId &&
          block.type === draggedSession.type &&
          block.sessionIndex === draggedSession.sessionIndex
      );

      if (sessionBlock) {
        onSessionBlockUpdate({
          ...sessionBlock,
          isScheduled: true,
          startRowIndex: timeSlot,
          judgeId,
        });
      }

      if (onSessionAssigned && draggedSession.isRemoving !== true) {
        onSessionAssigned(draggedSession);
      }
      setDragPreview(null);
    } catch (error) {
      console.error('Failed to parse session data:', error);
    }
  };

  const handleSessionDragEnter = (e: ReactDragEvent, judgeId: string, timeSlot: number) => {
    onSwapCancel();
    if (draggedSessionData) {
      e.preventDefault();
      updatePreview(judgeId, timeSlot);
    }
  };

  const handleSessionDragOverWithPreview = (e: ReactDragEvent, judgeId: string, timeSlot: number) => {
    if (draggedSessionData) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      updatePreview(judgeId, timeSlot);
    }
  };

  const handleSessionDragLeave = () => {
    setDragPreview(null);
    onSwapCancel();
  };

  return {
    dragPreview,
    setDragPreview,
    handleSessionDrop,
    handleSessionDragEnter,
    handleSessionDragOverWithPreview,
    handleSessionDragLeave,
  };
}
