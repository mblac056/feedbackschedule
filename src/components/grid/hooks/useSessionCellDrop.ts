import { useCallback, useEffect, useRef, useState } from 'react';
import type { DragEvent as ReactDragEvent, RefObject } from 'react';
import type { SessionSettings } from '../../../config/timeConfig';
import type { DraggedSessionData, SessionBlock } from '../../../types';
import { getSessionDurationInSlots, hasTimeConflict } from '../../../utils/scheduleHelpers';
import { applyBlockUpdates } from '../../../utils/sessionBlockUpdates';
import type { DragPreview } from '../types';

interface UseSessionCellDropParams {
  scheduledSessions: SessionBlock[];
  allSessionBlocks: SessionBlock[];
  settings: SessionSettings;
  draggedSessionData?: DraggedSessionData | null;
  /** Sync drag payload; updated on dragstart before React state commits. */
  draggedSessionDataRef?: RefObject<DraggedSessionData | null>;
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
  onSessionBlocksReplace: (blocks: SessionBlock[]) => void;
  onSessionAssigned?: (sessionData: DraggedSessionData) => void;
  onSwapCancel: () => void;
}

export function useSessionCellDrop({
  scheduledSessions,
  allSessionBlocks,
  settings,
  draggedSessionData,
  draggedSessionDataRef: externalDragRef,
  isGroupDragActive,
  getGroupDragPreview,
  applyGroupDrop,
  onSessionBlocksReplace,
  onSessionAssigned,
  onSwapCancel,
}: UseSessionCellDropParams) {
  const [dragPreview, setDragPreview] = useState<DragPreview | null>(null);
  const previewRafRef = useRef<number | null>(null);
  const pendingPreviewRef = useRef<{ judgeId: string; timeSlot: number } | null>(null);
  const previewGenerationRef = useRef(0);

  const getActiveDrag = useCallback((): DraggedSessionData | null => {
    return externalDragRef?.current ?? draggedSessionData ?? null;
  }, [draggedSessionData, externalDragRef]);

  const clearDragPreview = useCallback(() => {
    pendingPreviewRef.current = null;
    if (previewRafRef.current != null) {
      cancelAnimationFrame(previewRafRef.current);
      previewRafRef.current = null;
    }
    previewGenerationRef.current += 1;
    setDragPreview(null);
  }, []);

  useEffect(() => {
    if (!draggedSessionData && !externalDragRef?.current) {
      clearDragPreview();
    }
  }, [clearDragPreview, draggedSessionData, externalDragRef]);

  const flushPreview = useCallback(() => {
    previewRafRef.current = null;
    const generation = previewGenerationRef.current;
    const pending = pendingPreviewRef.current;
    const activeDrag = getActiveDrag();
    if (!pending || !activeDrag) return;
    // Drop/dragend may have cleared after this frame was scheduled.
    if (generation !== previewGenerationRef.current) return;

    const { judgeId, timeSlot } = pending;
    const groupPreview = isGroupDragActive(activeDrag)
      ? getGroupDragPreview(judgeId, timeSlot, activeDrag)
      : null;
    const isValid = groupPreview
      ? groupPreview.isValid
      : !hasTimeConflict(
          scheduledSessions,
          judgeId,
          timeSlot,
          activeDrag.type,
          settings,
          activeDrag
        );
    const nextPreview: DragPreview = {
      judgeId,
      timeSlot,
      sessionType: activeDrag.type,
      isValid,
      groupShadowFrame: groupPreview?.groupShadowFrame,
    };
    if (generation !== previewGenerationRef.current) return;
    setDragPreview((prev) => {
      if (
        prev &&
        prev.judgeId === nextPreview.judgeId &&
        prev.timeSlot === nextPreview.timeSlot &&
        prev.sessionType === nextPreview.sessionType &&
        prev.isValid === nextPreview.isValid &&
        prev.groupShadowFrame?.left === nextPreview.groupShadowFrame?.left &&
        prev.groupShadowFrame?.top === nextPreview.groupShadowFrame?.top &&
        prev.groupShadowFrame?.width === nextPreview.groupShadowFrame?.width &&
        prev.groupShadowFrame?.height === nextPreview.groupShadowFrame?.height
      ) {
        return prev;
      }
      return nextPreview;
    });
  }, [getActiveDrag, getGroupDragPreview, isGroupDragActive, scheduledSessions, settings]);

  const updatePreview = useCallback(
    (judgeId: string, timeSlot: number) => {
      if (!getActiveDrag()) return;
      pendingPreviewRef.current = { judgeId, timeSlot };
      if (previewRafRef.current != null) return;
      previewRafRef.current = requestAnimationFrame(flushPreview);
    },
    [flushPreview, getActiveDrag]
  );

  const handleSessionDrop = (e: ReactDragEvent, judgeId: string, timeSlot: number) => {
    e.preventDefault();
    onSwapCancel();
    clearDragPreview();

    try {
      const sessionData = e.dataTransfer.getData('application/json');
      if (!sessionData) return;

      const draggedSession: DraggedSessionData = JSON.parse(sessionData);

      if (draggedSession.groupSessionIds && draggedSession.groupSessionIds.length > 1) {
        const wasGroupApplied = applyGroupDrop(judgeId, timeSlot, draggedSession);
        if (!wasGroupApplied && import.meta.env.DEV) {
          console.warn('Cannot drop session group: invalid location or conflict detected');
        }
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
        onSessionBlocksReplace(applyBlockUpdates(allSessionBlocks, [{
          ...sessionBlock,
          isScheduled: true,
          startRowIndex: timeSlot,
          endRowIndex: timeSlot + getSessionDurationInSlots(sessionBlock.type, settings) - 1,
          judgeId,
        }]));
      }

      if (onSessionAssigned && draggedSession.isRemoving !== true) {
        onSessionAssigned(draggedSession);
      }
    } catch (error) {
      console.error('Failed to parse session data:', error);
    }
  };

  const handleSessionDragEnter = (e: ReactDragEvent, judgeId: string, timeSlot: number) => {
    onSwapCancel();
    e.preventDefault();
    updatePreview(judgeId, timeSlot);
  };

  const handleSessionDragOverWithPreview = (e: ReactDragEvent, judgeId: string, timeSlot: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    updatePreview(judgeId, timeSlot);
  };

  const handleSessionDragLeave = () => {
    onSwapCancel();
  };

  return {
    dragPreview,
    setDragPreview,
    clearDragPreview,
    handleSessionDrop,
    handleSessionDragEnter,
    handleSessionDragOverWithPreview,
    handleSessionDragLeave,
  };
}
