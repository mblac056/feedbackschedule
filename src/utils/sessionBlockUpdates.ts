import type { SessionBlock } from '../types';

export function applyBlockUpdates(allBlocks: SessionBlock[], updates: SessionBlock[]): SessionBlock[] {
  const byId = new Map(updates.map((block) => [block.id, block]));
  return allBlocks.map((block) => byId.get(block.id) ?? block);
}
