import type { Entrant, SessionBlock } from '../types';
import { SessionService } from '../services/SessionService';

export function buildBlocksAfterEntrantEdits(
  sessionBlocks: SessionBlock[],
  entrants: Entrant[]
): SessionBlock[] {
  return SessionService.regenerateSessionBlocks(entrants, sessionBlocks);
}
