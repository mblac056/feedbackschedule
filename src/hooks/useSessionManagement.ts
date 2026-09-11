import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { Judge, Entrant, EntrantJudgeAssignments, SessionBlock } from '../types';
import { getJudges, getEntrants, getSettings } from '../utils/localStorage';
import { SessionService, type SessionConflict } from '../services/SessionService';
import { useEntrant } from '../contexts/useEntrant';

interface UseSessionManagementReturn {
  judges: Judge[];
  allSessionBlocks: SessionBlock[];
  scheduledSessions: SessionBlock[];
  entrantJudgeAssignments: EntrantJudgeAssignments;
  scheduleConflicts: SessionConflict[];
  setJudges: (judges: Judge[]) => void;
  generateAllSessionBlocks: (entrants: Entrant[]) => void;
  handleSessionBlockUpdate: (updatedSessionBlock: SessionBlock) => void;
  handleSessionBlocksReplace: (blocks: SessionBlock[]) => void;
  handleScheduledSessionsChange: (sessions: SessionBlock[]) => void;
  handleClearGrid: () => void;
  initializeEntrantJudgeAssignments: (entrants: Entrant[]) => void;
}

export const useSessionManagement = (): UseSessionManagementReturn => {
  const { entrants } = useEntrant();
  const [judges, setJudges] = useState<Judge[]>([]);
  const [allSessionBlocks, setAllSessionBlocks] = useState<SessionBlock[]>([]);
  const [entrantJudgeAssignments, setEntrantJudgeAssignments] = useState<EntrantJudgeAssignments>({});
  const [scheduleConflicts, setScheduleConflicts] = useState<SessionConflict[]>([]);
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestBlocksRef = useRef<SessionBlock[] | null>(null);

  const scheduledSessions: SessionBlock[] = useMemo(() => {
    return SessionService.getScheduledSessions(allSessionBlocks);
  }, [allSessionBlocks]);

  const flushPersist = useCallback(() => {
    if (persistTimerRef.current != null) {
      clearTimeout(persistTimerRef.current);
      persistTimerRef.current = null;
    }
    if (latestBlocksRef.current) {
      SessionService.saveSessionBlocks(latestBlocksRef.current);
      latestBlocksRef.current = null;
    }
  }, []);

  const schedulePersist = useCallback((blocks: SessionBlock[]) => {
    latestBlocksRef.current = blocks;
    if (persistTimerRef.current != null) return;
    persistTimerRef.current = setTimeout(() => {
      persistTimerRef.current = null;
      if (latestBlocksRef.current) {
        SessionService.saveSessionBlocks(latestBlocksRef.current);
        latestBlocksRef.current = null;
      }
    }, 0);
  }, []);

  useEffect(() => () => flushPersist(), [flushPersist]);

  useEffect(() => {
    const onFlush = () => flushPersist();
    window.addEventListener('evalmatrix:flush-persist', onFlush);
    window.addEventListener('beforeunload', onFlush);
    return () => {
      window.removeEventListener('evalmatrix:flush-persist', onFlush);
      window.removeEventListener('beforeunload', onFlush);
    };
  }, [flushPersist]);

  const generateAllSessionBlocks = useCallback((entrants: Entrant[]) => {
    const sessionBlocks = SessionService.generateSessionBlocks(entrants);
    setAllSessionBlocks(sessionBlocks);
    SessionService.saveSessionBlocks(sessionBlocks);
  }, []);

  const initializeEntrantJudgeAssignments = useCallback((entrants: Entrant[]) => {
    const initialAssignments = SessionService.initializeEntrantJudgeAssignments(entrants);
    setEntrantJudgeAssignments(initialAssignments);
  }, []);

  const checkScheduleConflicts = useCallback((sessions: SessionBlock[], entrants: Entrant[]) => {
    const conflicts = SessionService.detectConflicts(sessions, entrants, getSettings());
    setScheduleConflicts(conflicts);
    SessionService.logConflicts(conflicts, entrants);
  }, []);

  const handleScheduledSessionsChange = useCallback((sessions: SessionBlock[]) => {
    const newAssignments = SessionService.updateEntrantJudgeAssignments(sessions, entrants);
    setEntrantJudgeAssignments(newAssignments);
    checkScheduleConflicts(sessions, entrants);
  }, [checkScheduleConflicts, entrants]);

  const handleSessionBlockUpdate = useCallback((updatedSessionBlock: SessionBlock) => {
    setAllSessionBlocks(prev => {
      const updated = SessionService.updateSessionBlock(prev, updatedSessionBlock);
      schedulePersist(updated);
      return updated;
    });
  }, [schedulePersist]);

  const handleSessionBlocksReplace = useCallback((blocks: SessionBlock[]) => {
    flushPersist();
    setAllSessionBlocks(blocks);
    SessionService.saveSessionBlocks(blocks);
  }, [flushPersist]);

  const handleClearGrid = useCallback(() => {
    flushPersist();
    const clearedSessionBlocks = SessionService.clearGrid(allSessionBlocks);
    setAllSessionBlocks(clearedSessionBlocks);
    SessionService.saveSessionBlocks(clearedSessionBlocks);
  }, [allSessionBlocks, flushPersist]);

  useEffect(() => {
    const storedJudges = getJudges();
    const storedEntrants = getEntrants();
    const storedSessionBlocks = SessionService.getSessionBlocks();
    
    setJudges(storedJudges);
    
    const validSessionBlocks = SessionService.cleanSessionBlocks(storedSessionBlocks, storedEntrants);
    
    if (validSessionBlocks.length !== storedSessionBlocks.length) {
      SessionService.saveSessionBlocks(validSessionBlocks);
    }
    
    initializeEntrantJudgeAssignments(storedEntrants);
    
    if (validSessionBlocks.length > 0) {
      setAllSessionBlocks(validSessionBlocks);
    } else {
      generateAllSessionBlocks(storedEntrants);
    }
  }, [generateAllSessionBlocks, initializeEntrantJudgeAssignments]);

  useEffect(() => {
    const run = () => {
      checkScheduleConflicts(scheduledSessions, entrants);
    };
    run();

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'evalmatrix_settings') {
        run();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [scheduledSessions, checkScheduleConflicts, entrants]);

  return {
    judges,
    allSessionBlocks,
    scheduledSessions,
    entrantJudgeAssignments,
    scheduleConflicts,
    setJudges,
    generateAllSessionBlocks,
    handleSessionBlockUpdate,
    handleSessionBlocksReplace,
    handleScheduledSessionsChange,
    handleClearGrid,
    initializeEntrantJudgeAssignments,
  };
};
