export type UndoRedoAction = 'undo' | 'redo';

export function matchUndoRedoShortcut(event: {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
}): UndoRedoAction | null {
  if (!event.ctrlKey && !event.metaKey) {
    return null;
  }

  const key = event.key.toLowerCase();
  if (key === 'y') {
    return 'redo';
  }
  if (key === 'z') {
    return event.shiftKey ? 'redo' : 'undo';
  }
  return null;
}

export function isTextEditingTarget(target: { tagName: string; isContentEditable: boolean } | null): boolean {
  if (!target) {
    return false;
  }
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
}
