import { useState, useEffect, useCallback, useMemo } from 'react';
import type { Judge, Entrant, EntrantJudgeAssignments, SessionBlock } from '../types';
import { getJudges, getEntrants } from '../utils/localStorage';
import { SessionService, type SessionConflict } from '../services/SessionService';

interface UseSessionManagementReturn {
  // State
  judges: Judge[];
  allSessionBlocks: SessionBlock[];
  scheduledSessions: SessionBlock[];
  entrantJudgeAssignments: EntrantJudgeAssignments;
  scheduleConflicts: SessionConflict[];

  // Actions
  setJudges: (judges: Judge[]) => void;
  generateAllSessionBlocks: (entrants: Entrant[]) => void;
  handleSessionBlockUpdate: (updatedSessionBlock: SessionBlock) => void;
  handleSessionBlockRemove: (sessionBlockId: string) => void;
  handleScheduledSessionsChange: (sessions: SessionBlock[]) => void;
  handleClearGrid: () => void;
  initializeEntrantJudgeAssignments: (entrants: Entrant[]) => void;
  refreshSessionBlocks: () => void;
}

export const useSessionManagement = (): UseSessionManagementReturn => {
  const [judges, setJudges] = useState<Judge[]>([]);
  const [allSessionBlocks, setAllSessionBlocks] = useState<SessionBlock[]>([]);
  const [entrantJudgeAssignments, setEntrantJudgeAssignments] = useState<EntrantJudgeAssignments>({});
  const [scheduleConflicts, setScheduleConflicts] = useState<SessionConflict[]>([]);

  // Computed property: scheduled sessions are just session blocks that are scheduled
  const scheduledSessions: SessionBlock[] = useMemo(() => {
    return SessionService.getScheduledSessions(allSessionBlocks);
  }, [allSessionBlocks]);

  // Generate all session blocks for all entrants
  const generateAllSessionBlocks = useCallback((entrants: Entrant[]) => {
    const sessionBlocks = SessionService.generateSessionBlocks(entrants);
    setAllSessionBlocks(sessionBlocks);
    SessionService.saveSessionBlocks(sessionBlocks);
  }, []);

  // Initialize entrant-judge assignments from localStorage or other sources
  const initializeEntrantJudgeAssignments = useCallback((entrants: Entrant[]) => {
    const initialAssignments = SessionService.initializeEntrantJudgeAssignments(entrants);
    setEntrantJudgeAssignments(initialAssignments);
  }, []);

  // Check for schedule conflicts between entrants and their groups to avoid
  const checkScheduleConflicts = useCallback((sessions: SessionBlock[], entrants: Entrant[]) => {
    const conflicts = SessionService.detectConflicts(sessions, entrants);
    setScheduleConflicts(conflicts);
    SessionService.logConflicts(conflicts, entrants);
  }, []);

  // Update entrant-judge assignments when sessions change
  const handleScheduledSessionsChange = useCallback((sessions: SessionBlock[]) => {
    const entrants = getEntrants();
    const newAssignments = SessionService.updateEntrantJudgeAssignments(sessions, entrants);
    setEntrantJudgeAssignments(newAssignments);
    
    // Check for schedule conflicts with groups to avoid
    checkScheduleConflicts(sessions, entrants);
  }, [checkScheduleConflicts]);

  // Handle session block updates (when a session is scheduled or unscheduled)
  const handleSessionBlockUpdate = useCallback((updatedSessionBlock: SessionBlock) => {
    setAllSessionBlocks(prev => {
      const updated = SessionService.updateSessionBlock(prev, updatedSessionBlock);
      SessionService.saveSessionBlocks(updated);
      return updated;
    });
  }, []);

  // Handle removing session blocks by ID
  const handleSessionBlockRemove = useCallback((sessionBlockId: string) => {
    setAllSessionBlocks(prev => {
      const updated = SessionService.removeSessionBlock(prev, sessionBlockId);
      SessionService.saveSessionBlocks(updated);
      return updated;
    });
  }, []);

  // Handle clearing the grid when settings change
  const handleClearGrid = useCallback(() => {
    const clearedSessionBlocks = SessionService.clearGrid(allSessionBlocks);
    setAllSessionBlocks(clearedSessionBlocks);
    SessionService.saveSessionBlocks(clearedSessionBlocks);
  }, [allSessionBlocks]);

  // Initialize data on mount
  useEffect(() => {
    const storedJudges = getJudges();
    const storedEntrants = getEntrants();
    const storedSessionBlocks = SessionService.getSessionBlocks();
    
    setJudges(storedJudges);
    
    // Clean up session blocks that reference non-existent entrants
    const validSessionBlocks = SessionService.cleanSessionBlocks(storedSessionBlocks, storedEntrants);
    
    // Save cleaned data back to localStorage if any cleanup was needed
    if (validSessionBlocks.length !== storedSessionBlocks.length) {
      SessionService.saveSessionBlocks(validSessionBlocks);
    }
    
    // Initialize entrant-judge assignments from existing data
    initializeEntrantJudgeAssignments(storedEntrants);
    
    // If we have stored session blocks, use them; otherwise generate new ones
    if (validSessionBlocks.length > 0) {
      setAllSessionBlocks(validSessionBlocks);
    } else {
      // Generate all session blocks
      generateAllSessionBlocks(storedEntrants);
    }
  }, [generateAllSessionBlocks, initializeEntrantJudgeAssignments]);

  // Method to refresh session blocks (called when entrants change)
  const refreshSessionBlocks = useCallback(() => {
    const storedEntrants = getEntrants();
    const regeneratedBlocks = SessionService.regenerateSessionBlocks(storedEntrants, allSessionBlocks);
    setAllSessionBlocks(regeneratedBlocks);
    SessionService.saveSessionBlocks(regeneratedBlocks);
  }, [allSessionBlocks]);

  // Check for conflicts whenever scheduledSessions changes
  useEffect(() => {
    const entrants = getEntrants();
    checkScheduleConflicts(scheduledSessions, entrants);
  }, [scheduledSessions, checkScheduleConflicts]);

  return {
    // State
    judges,
    allSessionBlocks,
    scheduledSessions,
    entrantJudgeAssignments,
    scheduleConflicts,

    // Actions
    setJudges,
    generateAllSessionBlocks,
    handleSessionBlockUpdate,
    handleSessionBlockRemove,
    handleScheduledSessionsChange,
    handleClearGrid,
    initializeEntrantJudgeAssignments,
    refreshSessionBlocks,
  };
};
