import { useMemo } from 'react';
import type { RefObject } from 'react';
import type { SessionSettings } from '../../../config/timeConfig';
import { TIME_CONFIG } from '../../../config/timeConfig';
import type { DraggedSessionData, Judge, SessionBlock } from '../../../types';
import { getSessionDurationInSlots, hasTimeConflict } from '../../../utils/scheduleHelpers';
import type { DragPreview } from '../types';

interface GroupMoveProposal {
  session: SessionBlock;
  judgeId: string;
  startRowIndex: number;
  endRowIndex: number;
}

interface UseGroupSessionDragParams {
  judges: Judge[];
  scheduledSessions: SessionBlock[];
  settings: SessionSettings;
  gridBodyRef: RefObject<HTMLDivElement | null>;
  onSessionBlockUpdate: (sessionBlock: SessionBlock) => void;
}

interface UseGroupSessionDragReturn {
  isGroupDragActive: (draggedSessionData?: DraggedSessionData | null) => boolean;
  getGroupDragPreview: (
    targetJudgeId: string,
    targetTimeSlot: number,
    draggedSession: DraggedSessionData
  ) => Pick<DragPreview, 'isValid' | 'groupShadowFrame'>;
  canDropGroupAtPosition: (
    targetJudgeId: string,
    targetTimeSlot: number,
    draggedSession: DraggedSessionData
  ) => boolean;
  applyGroupDrop: (
    targetJudgeId: string,
    targetTimeSlot: number,
    draggedSession: DraggedSessionData
  ) => boolean;
}

export const useGroupSessionDrag = ({
  judges,
  scheduledSessions,
  settings,
  gridBodyRef,
  onSessionBlockUpdate
}: UseGroupSessionDragParams): UseGroupSessionDragReturn => {
  const judgeIndexById = useMemo(() => {
    const indexMap = new Map<string, number>();
    judges.forEach((judge, index) => {
      indexMap.set(judge.id, index);
    });
    return indexMap;
  }, [judges]);

  const getGroupMoveProposals = (
    targetJudgeId: string,
    targetTimeSlot: number,
    draggedSession: DraggedSessionData
  ): GroupMoveProposal[] | null => {
    const groupSessionIds = draggedSession.groupSessionIds ?? [];
    if (groupSessionIds.length < 2) {
      return null;
    }

    const selectedSessions = groupSessionIds
      .map(sessionId => scheduledSessions.find(session => session.id === sessionId))
      .filter((session): session is SessionBlock => session !== undefined);

    if (selectedSessions.length !== groupSessionIds.length) {
      return null;
    }

    const anchorSessionId = draggedSession.groupAnchorSessionId ?? draggedSession.sessionId ?? groupSessionIds[0];
    const anchorSession = selectedSessions.find(session => session.id === anchorSessionId) ?? selectedSessions[0];
    if (!anchorSession || anchorSession.startRowIndex === undefined || !anchorSession.judgeId) {
      return null;
    }

    const anchorJudgeIndex = judgeIndexById.get(anchorSession.judgeId) ?? -1;
    const targetJudgeIndex = judgeIndexById.get(targetJudgeId) ?? -1;
    if (anchorJudgeIndex === -1 || targetJudgeIndex === -1) {
      return null;
    }

    const proposals: GroupMoveProposal[] = [];

    for (const session of selectedSessions) {
      if (session.startRowIndex === undefined || !session.judgeId) {
        return null;
      }

      const sourceJudgeIndex = judgeIndexById.get(session.judgeId) ?? -1;
      if (sourceJudgeIndex === -1) {
        return null;
      }

      const judgeOffset = sourceJudgeIndex - anchorJudgeIndex;
      const timeOffset = session.startRowIndex - anchorSession.startRowIndex;
      const nextJudgeIndex = targetJudgeIndex + judgeOffset;
      const nextStartRow = targetTimeSlot + timeOffset;
      const durationSlots = getSessionDurationInSlots(session.type, settings);
      const nextEndRow = nextStartRow + durationSlots - 1;

      if (nextJudgeIndex < 0 || nextJudgeIndex >= judges.length) {
        return null;
      }

      if (nextStartRow < 0 || nextEndRow >= TIME_CONFIG.TIME_SLOTS) {
        return null;
      }

      proposals.push({
        session,
        judgeId: judges[nextJudgeIndex].id,
        startRowIndex: nextStartRow,
        endRowIndex: nextEndRow
      });
    }

    return proposals;
  };

  const canDropGroupAtPosition = (
    targetJudgeId: string,
    targetTimeSlot: number,
    draggedSession: DraggedSessionData
  ): boolean => {
    const proposals = getGroupMoveProposals(targetJudgeId, targetTimeSlot, draggedSession);
    if (!proposals || proposals.length === 0) {
      return false;
    }

    const groupIdSet = new Set(proposals.map(proposal => proposal.session.id));
    const validationSessions: SessionBlock[] = scheduledSessions.filter(session => !groupIdSet.has(session.id));

    for (const proposal of proposals) {
      const hasConflict = hasTimeConflict(
        validationSessions,
        proposal.judgeId,
        proposal.startRowIndex,
        proposal.session.type,
        settings
      );
      if (hasConflict) {
        return false;
      }

      validationSessions.push({
        ...proposal.session,
        isScheduled: true,
        judgeId: proposal.judgeId,
        startRowIndex: proposal.startRowIndex,
        endRowIndex: proposal.endRowIndex
      });
    }

    return true;
  };

  const buildGroupShadowFrame = (
    proposals: GroupMoveProposal[]
  ): DragPreview['groupShadowFrame'] => {
    const gridBody = gridBodyRef.current;
    if (!gridBody) {
      return undefined;
    }

    const containerRect = gridBody.getBoundingClientRect();
    const judgeColumnElements = Array.from(
      gridBody.querySelectorAll<HTMLElement>('[data-judge-column]')
    );
    const judgeRectById = new Map<string, DOMRect>();

    judgeColumnElements.forEach(element => {
      const judgeId = element.dataset.judgeColumn;
      if (judgeId) {
        judgeRectById.set(judgeId, element.getBoundingClientRect());
      }
    });

    let minLeft = Infinity;
    let maxRight = -Infinity;
    let minStartRow = Infinity;
    let maxEndRow = -Infinity;

    for (const proposal of proposals) {
      const judgeRect = judgeRectById.get(proposal.judgeId);
      if (!judgeRect) {
        return undefined;
      }
      minLeft = Math.min(minLeft, judgeRect.left - containerRect.left);
      maxRight = Math.max(maxRight, judgeRect.right - containerRect.left);
      minStartRow = Math.min(minStartRow, proposal.startRowIndex);
      maxEndRow = Math.max(maxEndRow, proposal.endRowIndex);
    }

    if (!Number.isFinite(minLeft) || !Number.isFinite(maxRight)) {
      return undefined;
    }

    return {
      left: minLeft,
      top: minStartRow * TIME_CONFIG.SLOT_HEIGHT_PX,
      width: Math.max(0, maxRight - minLeft),
      height: Math.max(0, (maxEndRow - minStartRow + 1) * TIME_CONFIG.SLOT_HEIGHT_PX)
    };
  };

  const getGroupDragPreview = (
    targetJudgeId: string,
    targetTimeSlot: number,
    draggedSession: DraggedSessionData
  ): Pick<DragPreview, 'isValid' | 'groupShadowFrame'> => {
    const proposals = getGroupMoveProposals(targetJudgeId, targetTimeSlot, draggedSession);
    if (!proposals || proposals.length === 0) {
      return {
        isValid: false,
        groupShadowFrame: undefined
      };
    }

    return {
      isValid: canDropGroupAtPosition(targetJudgeId, targetTimeSlot, draggedSession),
      groupShadowFrame: buildGroupShadowFrame(proposals)
    };
  };

  const applyGroupDrop = (
    targetJudgeId: string,
    targetTimeSlot: number,
    draggedSession: DraggedSessionData
  ): boolean => {
    const proposals = getGroupMoveProposals(targetJudgeId, targetTimeSlot, draggedSession);
    if (!proposals || proposals.length === 0) {
      return false;
    }

    if (!canDropGroupAtPosition(targetJudgeId, targetTimeSlot, draggedSession)) {
      return false;
    }

    proposals.forEach(proposal => {
      onSessionBlockUpdate({
        ...proposal.session,
        isScheduled: true,
        judgeId: proposal.judgeId,
        startRowIndex: proposal.startRowIndex,
        endRowIndex: proposal.endRowIndex
      });
    });

    return true;
  };

  const isGroupDragActive = (draggedSessionData?: DraggedSessionData | null) => (
    draggedSessionData?.groupSessionIds !== undefined &&
    draggedSessionData.groupSessionIds.length > 1
  );

  return {
    isGroupDragActive,
    getGroupDragPreview,
    canDropGroupAtPosition,
    applyGroupDrop
  };
};
