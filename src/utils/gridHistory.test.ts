import { describe, expect, it } from 'vitest';
import type { SessionBlock } from '../types';
import {
  MAX_GRID_HISTORY,
  clearGridHistory,
  createGridHistory,
  pushGridHistory,
  redoGridHistory,
  undoGridHistory,
} from './gridHistory';

function block(id: string, scheduled = false): SessionBlock {
  return {
    id,
    entrantId: `e-${id}`,
    entrantName: id,
    type: '3x20',
    sessionIndex: 0,
    isScheduled: scheduled,
  };
}

describe('gridHistory', () => {
  it('returns null when there is nothing to undo or redo', () => {
    const history = createGridHistory();
    const present = [block('a')];

    expect(undoGridHistory(history, present)).toBeNull();
    expect(redoGridHistory(history, present)).toBeNull();
  });

  it('undo restores the previous snapshot and redo restores the undone present', () => {
    const first = [block('a')];
    const second = [block('a', true)];
    const history = pushGridHistory(createGridHistory(), first);

    const undone = undoGridHistory(history, second);
    expect(undone).not.toBeNull();
    expect(undone?.present).toEqual(first);
    expect(undone?.present).not.toBe(first);

    const redone = redoGridHistory(undone!.history, undone!.present);
    expect(redone).not.toBeNull();
    expect(redone?.present).toEqual(second);
  });

  it('clears redo when a new change is pushed after undo', () => {
    const first = [block('a')];
    const second = [block('a', true)];
    const third = [block('b')];

    const afterUndo = undoGridHistory(pushGridHistory(createGridHistory(), first), second);
    expect(afterUndo).not.toBeNull();

    const afterPush = pushGridHistory(afterUndo!.history, afterUndo!.present);
    expect(redoGridHistory(afterPush, third)).toBeNull();
  });

  it('drops the oldest snapshot when the cap is exceeded', () => {
    let history = createGridHistory();
    for (let i = 0; i < MAX_GRID_HISTORY + 1; i += 1) {
      history = pushGridHistory(history, [block(String(i))]);
    }

    expect(history.past).toHaveLength(MAX_GRID_HISTORY);
    expect(history.past[0][0].id).toBe('1');
  });

  it('clearGridHistory empties both stacks', () => {
    const history = pushGridHistory(createGridHistory(), [block('a')]);
    const cleared = clearGridHistory();
    expect(cleared).toEqual({ past: [], future: [] });
    expect(undoGridHistory(cleared, [block('a', true)])).toBeNull();
    expect(history.past).toHaveLength(1);
  });

  it('stores clones so later mutation of present does not rewrite history', () => {
    const present = [block('a')];
    const history = pushGridHistory(createGridHistory(), present);
    present[0].isScheduled = true;

    const undone = undoGridHistory(history, [block('a', true)]);
    expect(undone?.present[0].isScheduled).toBe(false);
  });
});
