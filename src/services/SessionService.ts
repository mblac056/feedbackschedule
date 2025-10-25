import type { Entrant, SessionBlock, EntrantJudgeAssignments } from '../types';
import { getSessionBlocks, saveSessionBlocks, clearGrid } from '../utils/localStorage';

export interface SessionConflict {
  entrantId: string;
  entrantName: string;
  conflictingGroup: string;
  conflictingEntrantId: string;
  conflictingEntrantName: string;
  timeSlot: string;
}

export class SessionService {
  /**
   * Generate session blocks for all included entrants
   */
  static generateSessionBlocks(entrants: Entrant[]): SessionBlock[] {
    const sessionBlocks: SessionBlock[] = [];
    const includedEntrants = entrants.filter(e => e.includeInSchedule);
    
    for (const entrant of includedEntrants) {
      // Use preference if set, otherwise default to 3x20
      const sessionType = entrant.preference || '3x20';
      
      if (sessionType === '1xLong') {
        sessionBlocks.push({
          id: `${entrant.id}-1xlong`,
          entrantId: entrant.id,
          entrantName: entrant.name,
          type: '1xLong',
          isScheduled: false
        });
      } else if (sessionType === '3x20') {
        for (let i = 0; i < 3; i++) {
          sessionBlocks.push({
            id: `${entrant.id}-3x20-${i}`,
            entrantId: entrant.id,
            entrantName: entrant.name,
            type: '3x20',
            sessionIndex: i,
            isScheduled: false
          });
        }
      } else if (sessionType === '3x10') {
        for (let i = 0; i < 3; i++) {
          sessionBlocks.push({
            id: `${entrant.id}-3x10-${i}`,
            entrantId: entrant.id,
            entrantName: entrant.name,
            type: '3x10',
            sessionIndex: i,
            isScheduled: false
          });
        }
      }
    }
    
    return sessionBlocks;
  }

  /**
   * Regenerate session blocks while preserving existing scheduled sessions
   */
  static regenerateSessionBlocks(entrants: Entrant[], existingBlocks: SessionBlock[]): SessionBlock[] {
    const newBlocks = this.generateSessionBlocks(entrants);
    const scheduledBlocks = existingBlocks.filter(block => block.isScheduled);
    
    // Create a map of existing scheduled blocks by entrant ID and session type
    const scheduledMap = new Map<string, SessionBlock>();
    scheduledBlocks.forEach(block => {
      const key = `${block.entrantId}-${block.type}-${block.sessionIndex || 0}`;
      scheduledMap.set(key, block);
    });
    
    // Update new blocks with existing scheduled data where applicable
    return newBlocks.map(block => {
      const key = `${block.entrantId}-${block.type}-${block.sessionIndex || 0}`;
      const existingScheduled = scheduledMap.get(key);
      
      if (existingScheduled) {
        // Preserve the scheduled session data
        return {
          ...block,
          isScheduled: existingScheduled.isScheduled,
          startRowIndex: existingScheduled.startRowIndex,
          endRowIndex: existingScheduled.endRowIndex,
          judgeId: existingScheduled.judgeId
        };
      }
      
      return block;
    });
  }

  /**
   * Save session blocks to localStorage
   */
  static saveSessionBlocks(sessionBlocks: SessionBlock[]): void {
    saveSessionBlocks(sessionBlocks);
  }

  /**
   * Get session blocks from localStorage
   */
  static getSessionBlocks(): SessionBlock[] {
    return getSessionBlocks();
  }

  /**
   * Clean up session blocks that reference non-existent entrants
   */
  static cleanSessionBlocks(sessionBlocks: SessionBlock[], entrants: Entrant[]): SessionBlock[] {
    return sessionBlocks.filter(block => 
      block && block.entrantId && 
      entrants.find(entrant => entrant.id === block.entrantId) !== undefined
    );
  }

  /**
   * Get scheduled sessions from all session blocks
   */
  static getScheduledSessions(sessionBlocks: SessionBlock[]): SessionBlock[] {
    return sessionBlocks.filter(block => 
      block.isScheduled && 
      block.startRowIndex !== undefined && 
      block.judgeId
    );
  }

  /**
   * Update a session block
   */
  static updateSessionBlock(
    currentBlocks: SessionBlock[], 
    updatedBlock: SessionBlock
  ): SessionBlock[] {
    const existingIndex = currentBlocks.findIndex(block => 
      block.entrantId === updatedBlock.entrantId && 
      block.type === updatedBlock.type && 
      block.sessionIndex === updatedBlock.sessionIndex
    );
    
    let updated;
    if (existingIndex !== -1) {
      // Update existing session block
      updated = [...currentBlocks];
      updated[existingIndex] = updatedBlock;
    } else {
      // Add new session block
      updated = [...currentBlocks, updatedBlock];
    }
    
    return updated;
  }

  /**
   * Remove a session block by ID
   */
  static removeSessionBlock(currentBlocks: SessionBlock[], sessionBlockId: string): SessionBlock[] {
    return currentBlocks.filter(block => block.id !== sessionBlockId);
  }

  /**
   * Clear the grid by unscheduling all session blocks
   */
  static clearGrid(sessionBlocks: SessionBlock[]): SessionBlock[] {
    return clearGrid(sessionBlocks);
  }

  /**
   * Initialize entrant-judge assignments
   */
  static initializeEntrantJudgeAssignments(entrants: Entrant[]): EntrantJudgeAssignments {
    const assignments: EntrantJudgeAssignments = {};
    entrants.forEach(entrant => {
      assignments[entrant.id] = [];
    });
    return assignments;
  }

  /**
   * Update entrant-judge assignments based on scheduled sessions
   */
  static updateEntrantJudgeAssignments(
    scheduledSessions: SessionBlock[], 
    entrants: Entrant[]
  ): EntrantJudgeAssignments {
    const assignments: EntrantJudgeAssignments = {};
    
    // Initialize empty arrays for all entrants
    entrants.forEach(entrant => {
      assignments[entrant.id] = [];
    });
    
    // Populate assignments based on current sessions
    scheduledSessions.forEach(session => {
      if (assignments[session.entrantId] && session.judgeId) {
        assignments[session.entrantId].push(session.judgeId);
      }
    });
    
    return assignments;
  }

  /**
   * Calculate session duration in row slots
   */
  private static getSessionDurationRows(sessionType: string): number {
    // Use default durations for conflict detection (these should match the settings)
    const durationMinutes = sessionType === '1xLong' ? 40 : 
                           sessionType === '3x20' ? 20 : 
                           10; // 3x10
    // Convert minutes to row slots (assuming 5-minute slots)
    return Math.ceil(durationMinutes / 5);
  }

  /**
   * Check if two row ranges overlap
   */
  private static doSessionsOverlap(
    startRow1: number, 
    durationRows1: number, 
    startRow2: number, 
    durationRows2: number
  ): boolean {
    const endRow1 = startRow1 + durationRows1 - 1;
    const endRow2 = startRow2 + durationRows2 - 1;
    
    // Check if sessions overlap (one starts before the other ends and ends after the other starts)
    return startRow1 <= endRow2 && endRow1 >= startRow2;
  }

  /**
   * Detect schedule conflicts between entrants and their groups to avoid
   */
  static detectConflicts(sessions: SessionBlock[], entrants: Entrant[]): SessionConflict[] {
    const conflicts: SessionConflict[] = [];

    // Check each entrant for conflicts
    entrants.forEach(entrant => {
      if (!entrant.groupsToAvoid || entrant.groupsToAvoid.trim() === '') {
        return; // Skip if no groups to avoid
      }

      const groupsToAvoid = entrant.groupsToAvoid.split(' | ').map(g => g.trim()).filter(g => g);
      
      // Find this entrant's scheduled sessions
      const entrantSessions = sessions.filter(s => s.entrantId === entrant.id);
      
      entrantSessions.forEach(session => {
        const sessionDuration = this.getSessionDurationRows(session.type);
        
        // Check all other sessions for overlaps
        sessions.forEach(otherSession => {
          if (otherSession.entrantId === entrant.id) return; // Skip self
          
          const otherSessionDuration = this.getSessionDurationRows(otherSession.type);
          
          // Check if sessions overlap in row indices
          if (this.doSessionsOverlap(
            session.startRowIndex!, 
            sessionDuration, 
            otherSession.startRowIndex!, 
            otherSessionDuration
          )) {
            const conflictingEntrant = entrants.find(e => e.id === otherSession.entrantId);
            if (!conflictingEntrant) return;
            
            // Check if the conflicting entrant's name matches a group this entrant should avoid
            const hasConflict = groupsToAvoid.some(groupToAvoid => {
              return conflictingEntrant.name === groupToAvoid;
            });
            
            if (hasConflict) {
              const conflictingGroup = conflictingEntrant.name;
                            
              conflicts.push({
                entrantId: entrant.id,
                entrantName: entrant.name,
                conflictingGroup: conflictingGroup,
                conflictingEntrantId: conflictingEntrant.id,
                conflictingEntrantName: conflictingEntrant.name,
                timeSlot: `Row ${session.startRowIndex}` // Convert row index to display string
              });
            }
          }
        });
      });
    });

    return conflicts;
  }

  /**
   * Log conflicts to console (for debugging)
   */
  static logConflicts(conflicts: SessionConflict[], entrants: Entrant[]): void {
    if (conflicts.length > 0) {
      console.warn('Schedule conflicts detected with groups to avoid:', conflicts);
      
      // Group conflicts by entrant for better readability
      const conflictsByEntrant = conflicts.reduce((acc, conflict) => {
        if (!acc[conflict.entrantId]) {
          acc[conflict.entrantId] = [];
        }
        acc[conflict.entrantId].push(conflict);
        return acc;
      }, {} as Record<string, SessionConflict[]>);
      
      Object.entries(conflictsByEntrant).forEach(([entrantId, entrantConflicts]) => {
        const entrant = entrants.find(e => e.id === entrantId);
        console.warn(`${entrant?.name} has ${entrantConflicts.length} conflict(s):`);
        entrantConflicts.forEach(conflict => {
          console.warn(`  - At ${conflict.timeSlot}: conflicting with ${conflict.conflictingEntrantName} (${conflict.conflictingGroup})`);
        });
      });
    } else {
      console.log('No schedule conflicts detected with groups to avoid.');
    }
  }
}
