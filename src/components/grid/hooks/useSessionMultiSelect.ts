import { useCallback, useEffect, useState } from 'react';
import type { RefObject, MouseEvent as ReactMouseEvent } from 'react';
import type { SessionBlock } from '../../../types';
import type { SelectionRect } from '../types';

interface UseSessionMultiSelectParams {
  scheduledSessions: SessionBlock[];
  gridBodyRef: RefObject<HTMLDivElement | null>;
}

interface UseSessionMultiSelectReturn {
  selectedSessionIds: string[];
  selectionRect: SelectionRect | null;
  isSelectingBlocks: boolean;
  handleGridMouseDown: (event: ReactMouseEvent<HTMLDivElement>) => void;
}

const normalizeRect = (rect: SelectionRect) => {
  const x = Math.min(rect.startX, rect.currentX);
  const y = Math.min(rect.startY, rect.currentY);
  const width = Math.abs(rect.currentX - rect.startX);
  const height = Math.abs(rect.currentY - rect.startY);
  return { x, y, width, height };
};

const getViewportRectFromSelection = (
  rect: SelectionRect,
  containerRect: DOMRect
) => {
  const normalized = normalizeRect(rect);
  return {
    left: containerRect.left + normalized.x,
    top: containerRect.top + normalized.y,
    right: containerRect.left + normalized.x + normalized.width,
    bottom: containerRect.top + normalized.y + normalized.height
  };
};

const intersects = (
  a: { left: number; top: number; right: number; bottom: number },
  b: { left: number; top: number; right: number; bottom: number }
) => a.left <= b.right && a.right >= b.left && a.top <= b.bottom && a.bottom >= b.top;

export const useSessionMultiSelect = ({
  scheduledSessions,
  gridBodyRef
}: UseSessionMultiSelectParams): UseSessionMultiSelectReturn => {
  const [selectedSessionIds, setSelectedSessionIds] = useState<string[]>([]);
  const [selectionRect, setSelectionRect] = useState<SelectionRect | null>(null);
  const [isSelectingBlocks, setIsSelectingBlocks] = useState(false);

  useEffect(() => {
    const scheduledSessionIds = new Set(scheduledSessions.map(session => session.id));
    setSelectedSessionIds(currentSelection =>
      currentSelection.filter(sessionId => scheduledSessionIds.has(sessionId))
    );
  }, [scheduledSessions]);

  const updateSelectedSessionsFromRect = useCallback((rect: SelectionRect) => {
    const gridBody = gridBodyRef.current;
    if (!gridBody) {
      return;
    }

    const containerRect = gridBody.getBoundingClientRect();
    const marqueeViewportRect = getViewportRectFromSelection(rect, containerRect);
    const matchedSessionIds = scheduledSessions
      .filter(session => {
        const element = gridBody.querySelector<HTMLElement>(`[data-session-id="${session.id}"]`);
        if (!element) {
          return false;
        }
        const blockRect = element.getBoundingClientRect();
        return intersects(blockRect, marqueeViewportRect);
      })
      .map(session => session.id);

    setSelectedSessionIds(matchedSessionIds);
  }, [gridBodyRef, scheduledSessions]);

  const handleGridMouseDown = useCallback((event: ReactMouseEvent<HTMLDivElement>) => {
    if (event.button !== 0) {
      return;
    }

    const targetElement = event.target as HTMLElement;
    if (targetElement.closest('[data-session-id]')) {
      return;
    }

    const gridBody = gridBodyRef.current;
    if (!gridBody) {
      return;
    }

    const containerRect = gridBody.getBoundingClientRect();
    const startX = event.clientX - containerRect.left;
    const startY = event.clientY - containerRect.top;
    const initialRect: SelectionRect = {
      startX,
      startY,
      currentX: startX,
      currentY: startY
    };

    setIsSelectingBlocks(true);
    setSelectionRect(initialRect);
    setSelectedSessionIds([]);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const currentRect: SelectionRect = {
        startX,
        startY,
        currentX: moveEvent.clientX - containerRect.left,
        currentY: moveEvent.clientY - containerRect.top
      };
      setSelectionRect(currentRect);
      updateSelectedSessionsFromRect(currentRect);
    };

    const handleMouseUp = () => {
      setIsSelectingBlocks(false);
      setSelectionRect(null);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [gridBodyRef, updateSelectedSessionsFromRect]);

  return {
    selectedSessionIds,
    selectionRect,
    isSelectingBlocks,
    handleGridMouseDown
  };
};
