import { describe, expect, it } from 'vitest';
import { isTextEditingTarget, matchUndoRedoShortcut } from './undoShortcuts';

describe('matchUndoRedoShortcut', () => {
  it('maps Ctrl/Cmd+Z to undo and Ctrl/Cmd+Y or Shift+Z to redo', () => {
    expect(matchUndoRedoShortcut({ key: 'z', ctrlKey: true, metaKey: false, shiftKey: false })).toBe('undo');
    expect(matchUndoRedoShortcut({ key: 'Z', metaKey: true, ctrlKey: false, shiftKey: false })).toBe('undo');
    expect(matchUndoRedoShortcut({ key: 'y', ctrlKey: true, metaKey: false, shiftKey: false })).toBe('redo');
    expect(matchUndoRedoShortcut({ key: 'z', ctrlKey: true, metaKey: false, shiftKey: true })).toBe('redo');
    expect(matchUndoRedoShortcut({ key: 'z', ctrlKey: false, metaKey: false, shiftKey: false })).toBeNull();
    expect(matchUndoRedoShortcut({ key: 'e', ctrlKey: true, metaKey: false, shiftKey: false })).toBeNull();
  });
});

describe('isTextEditingTarget', () => {
  it('treats inputs, textareas, selects, and contenteditable as editing', () => {
    expect(isTextEditingTarget({ tagName: 'INPUT', isContentEditable: false })).toBe(true);
    expect(isTextEditingTarget({ tagName: 'TEXTAREA', isContentEditable: false })).toBe(true);
    expect(isTextEditingTarget({ tagName: 'SELECT', isContentEditable: false })).toBe(true);
    expect(isTextEditingTarget({ tagName: 'DIV', isContentEditable: true })).toBe(true);
    expect(isTextEditingTarget({ tagName: 'DIV', isContentEditable: false })).toBe(false);
    expect(isTextEditingTarget(null)).toBe(false);
  });
});
