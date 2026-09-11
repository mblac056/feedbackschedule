import type { SessionBlock } from '../types';

export const MAX_GRID_HISTORY = 50;

export type SessionBlocksReplaceOptions = {
  resetHistory?: boolean;
};

export type GridHistory = {
  past: SessionBlock[][];
  future: SessionBlock[][];
};

export function createGridHistory(): GridHistory {
  return { past: [], future: [] };
}

export function clearGridHistory(): GridHistory {
  return { past: [], future: [] };
}

export function cloneSessionBlocks(blocks: SessionBlock[]): SessionBlock[] {
  return blocks.map((block) => ({ ...block }));
}

export function pushGridHistory(
  history: GridHistory,
  present: SessionBlock[],
  max = MAX_GRID_HISTORY
): GridHistory {
  const past = [...history.past, cloneSessionBlocks(present)];
  if (past.length > max) {
    past.shift();
  }
  return { past, future: [] };
}

export function undoGridHistory(
  history: GridHistory,
  present: SessionBlock[]
): { history: GridHistory; present: SessionBlock[] } | null {
  if (history.past.length === 0) {
    return null;
  }

  const past = [...history.past];
  const previous = past.pop()!;
  return {
    history: {
      past,
      future: [...history.future, cloneSessionBlocks(present)],
    },
    present: previous,
  };
}

export function redoGridHistory(
  history: GridHistory,
  present: SessionBlock[]
): { history: GridHistory; present: SessionBlock[] } | null {
  if (history.future.length === 0) {
    return null;
  }

  const future = [...history.future];
  const next = future.pop()!;
  return {
    history: {
      past: [...history.past, cloneSessionBlocks(present)],
      future,
    },
    present: next,
  };
}
