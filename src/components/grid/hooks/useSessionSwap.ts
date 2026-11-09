import { useEffect, useRef, useState } from 'react';
import type { DragEvent as ReactDragEvent } from 'react';
import type { DraggedSessionData, SessionBlock } from '../../../types';
import { buildEntrantSwapUpdates, buildSessionSwapUpdates } from '../../../utils/scheduleHelpers';
import { applyBlockUpdates } from '../../../utils/sessionBlockUpdates';

const SWAP_HOVER_TIMEOUT = 1000;

interface UseSessionSwapParams {
  draggedSessionData?: DraggedSessionData | null;
  scheduledSessions: SessionBlock[];
  allSessionBlocks: SessionBlock[];
  isGroupDragActive: (draggedSessionData?: DraggedSessionData | null) => boolean;
  onSessionBlocksReplace: (blocks: SessionBlock[]) => void;
}

export function useSessionSwap({
  draggedSessionData,
  scheduledSessions,
  allSessionBlocks,
  isGroupDragActive,
  onSessionBlocksReplace,
}: UseSessionSwapParams) {
  const [swapCandidateSessionId, setSwapCandidateSessionId] = useState<string | null>(null);
  const swapHoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSwapSessionIdRef = useRef<string | null>(null);

  const cancelSwapHover = (sessionId?: string) => {
    if (swapHoverTimeoutRef.current) {
      if (!sessionId || pendingSwapSessionIdRef.current === sessionId) {
        clearTimeout(swapHoverTimeoutRef.current);
        swapHoverTimeoutRef.current = null;
        pendingSwapSessionIdRef.current = null;
      }
    }
    if (!sessionId) {
      setSwapCandidateSessionId(null);
    } else {
      setSwapCandidateSessionId((current) => (current === sessionId ? null : current));
    }
  };

  const startSwapHoverTimer = (sessionId: string) => {
    setSwapCandidateSessionId((current) => (current === sessionId ? current : null));

    if (swapHoverTimeoutRef.current) {
      if (pendingSwapSessionIdRef.current === sessionId) {
        return;
      }
      clearTimeout(swapHoverTimeoutRef.current);
      swapHoverTimeoutRef.current = null;
      pendingSwapSessionIdRef.current = null;
    }

    pendingSwapSessionIdRef.current = sessionId;
    swapHoverTimeoutRef.current = setTimeout(() => {
      setSwapCandidateSessionId(sessionId);
      swapHoverTimeoutRef.current = null;
      pendingSwapSessionIdRef.current = null;
    }, SWAP_HOVER_TIMEOUT);
  };

  useEffect(() => {
    if (!draggedSessionData) {
      setSwapCandidateSessionId(null);
      if (swapHoverTimeoutRef.current) {
        clearTimeout(swapHoverTimeoutRef.current);
        swapHoverTimeoutRef.current = null;
      }
      pendingSwapSessionIdRef.current = null;
    }
  }, [draggedSessionData]);

  useEffect(() => {
    return () => {
      if (swapHoverTimeoutRef.current) {
        clearTimeout(swapHoverTimeoutRef.current);
      }
      swapHoverTimeoutRef.current = null;
      pendingSwapSessionIdRef.current = null;
    };
  }, []);

  const handleScheduledBlockDragEnter = (_e: ReactDragEvent, targetSession: SessionBlock) => {
    if (isGroupDragActive(draggedSessionData)) {
      cancelSwapHover(targetSession.id);
      return;
    }
    if (!draggedSessionData || draggedSessionData.isRemoving !== true || !draggedSessionData.sessionId) {
      cancelSwapHover(targetSession.id);
      return;
    }
    if (draggedSessionData.sessionId === targetSession.id) {
      cancelSwapHover(targetSession.id);
      return;
    }
    if (draggedSessionData.type !== targetSession.type) {
      cancelSwapHover(targetSession.id);
      return;
    }
    startSwapHoverTimer(targetSession.id);
  };

  const handleScheduledBlockDragOver = (e: ReactDragEvent, targetSession: SessionBlock) => {
    // Always keep the occupied cell eligible as a drop target so the browser
    // does not snap-back when the pointer is over the absolute-positioned block.
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    if (isGroupDragActive(draggedSessionData)) return;
    if (!draggedSessionData || draggedSessionData.isRemoving !== true || !draggedSessionData.sessionId) return;
    if (draggedSessionData.sessionId === targetSession.id) return;
    if (draggedSessionData.type !== targetSession.type) return;
    startSwapHoverTimer(targetSession.id);
  };

  const handleScheduledBlockDragEnd = () => {
    cancelSwapHover();
  };

  const handleSessionBlockSwapDrop = (e: ReactDragEvent, targetSession: SessionBlock) => {
    if (!draggedSessionData || draggedSessionData.isRemoving !== true || !draggedSessionData.sessionId) return;
    if (swapCandidateSessionId !== targetSession.id) return;

    e.preventDefault();
    e.stopPropagation();

    const sourceSession = scheduledSessions.find((session) => session.id === draggedSessionData.sessionId);
    const fullTargetSession = scheduledSessions.find((session) => session.id === targetSession.id);
    if (!sourceSession || !fullTargetSession || sourceSession.type !== fullTargetSession.type) {
      cancelSwapHover();
      return;
    }

    const sourceEntrantSessions = allSessionBlocks.filter(
      (session) => session.entrantId === sourceSession.entrantId && session.type === sourceSession.type
    );
    const targetEntrantSessions = allSessionBlocks.filter(
      (session) => session.entrantId === fullTargetSession.entrantId && session.type === fullTargetSession.type
    );

    let updatedBlocks = buildEntrantSwapUpdates(sourceEntrantSessions, targetEntrantSessions);
    if (updatedBlocks.length === 0) {
      updatedBlocks = buildSessionSwapUpdates(sourceSession, fullTargetSession);
    }

    onSessionBlocksReplace(applyBlockUpdates(allSessionBlocks, updatedBlocks));
    cancelSwapHover();
  };

  return {
    swapCandidateSessionId,
    cancelSwapHover,
    handleScheduledBlockDragEnter,
    handleScheduledBlockDragOver,
    handleScheduledBlockDragEnd,
    handleSessionBlockSwapDrop,
  };
}
