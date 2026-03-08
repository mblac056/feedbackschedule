export interface GroupShadowFrame {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface DragPreview {
  judgeId: string;
  timeSlot: number;
  sessionType: '1xLong' | '3x20' | '3x10';
  isValid: boolean;
  groupShadowFrame?: GroupShadowFrame;
}

export interface SelectionRect {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}
