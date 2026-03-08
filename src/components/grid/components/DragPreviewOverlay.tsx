import type { DraggedSessionData } from '../../../types';
import { TIME_CONFIG } from '../../../config/timeConfig';
import type { DragPreview } from '../types';

interface DragPreviewOverlayProps {
  draggedSessionData?: DraggedSessionData | null;
  dragPreview: DragPreview | null;
}

export default function DragPreviewOverlay({
  draggedSessionData,
  dragPreview
}: DragPreviewOverlayProps) {
  if (!draggedSessionData || !dragPreview) {
    return null;
  }

  return (
    <>
      {!dragPreview.groupShadowFrame && (
        <div
          className={`absolute left-0 right-0 border-t-2 pointer-events-none z-30 ${
            dragPreview.isValid ? 'border-green-500' : 'border-red-500'
          }`}
          style={{
            top: `${dragPreview.timeSlot * TIME_CONFIG.SLOT_HEIGHT_PX}px`
          }}
        />
      )}
      {dragPreview.groupShadowFrame && (
        <div
          className={`absolute border-2 border-dashed pointer-events-none z-30 ${
            dragPreview.isValid
              ? 'border-green-500 bg-green-50 bg-opacity-30'
              : 'border-red-500 bg-red-50 bg-opacity-30'
          }`}
          style={{
            left: `${dragPreview.groupShadowFrame.left}px`,
            top: `${dragPreview.groupShadowFrame.top}px`,
            width: `${dragPreview.groupShadowFrame.width}px`,
            height: `${dragPreview.groupShadowFrame.height}px`
          }}
        />
      )}
    </>
  );
}
