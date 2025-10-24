export interface Judge {
  id: string;
  category?: 'SNG' | 'MUS' | 'PER'
  name: string;
  roomNumber?: string;
}

export interface Entrant {
  id: string;
  name: string;
  groupsToAvoid: string;
  preference: '1xLong' | '3x20' | '3x10' | 'None' | null;
  judgePreference1: string;
  judgePreference2: string;
  judgePreference3: string;
  includeInSchedule: boolean;
  roomNumber?: string;
  overallSF?: number;
  overallF?: number;
}


// New interface for all session blocks (both scheduled and unscheduled)
export interface SessionBlock {
  id: string;
  entrantId: string;
  entrantName: string;
  type: '1xLong' | '3x20' | '3x10';
  sessionIndex?: number;
  // Scheduling information (only present for scheduled sessions)
  startRowIndex?: number; // Row index where the session starts (0-based)
  endRowIndex?: number; // Row index where the session ends (0-based)
  judgeId?: string;
  isScheduled?: boolean;
}


  
  export interface DraggedSessionData {
    entrantId: string;
    entrantName: string;
    type:  '1xLong' | '3x20' | '3x10';
    sessionIndex?: number;
    isRemoving?: boolean;
  }

export interface EntrantJudgeAssignments {
  [entrantId: string]: string[];
}