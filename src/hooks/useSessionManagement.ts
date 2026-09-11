import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { Judge, Entrant, EntrantJudgeAssignments, SessionBlock } from '../types';
import { getJudges, getEntrants, getSettings } from '../utils/localStorage';
import { SessionService, type SessionConflict } from '../services/SessionService';
import { useEntrant } from '../contexts/useEntrant';
import {
  clearGridHistory,
  createGridHistory,
  pushGridHistory,
  redoGridHistory,
  undoGridHistory,
  type SessionBlocksReplaceOptions,
} from '../utils/gridHistory';

interface UseSessionManagementReturn {
  judges: Judge[];
  allSessionBlocks: SessionBlock[];
  scheduledSessions: SessionBlock[];
  entrantJudgeAssignments: EntrantJudgeAssignments;
  scheduleConflicts: SessionConflict[];
  setJudges: (judges: Judge[]) => void;
  generateAllSessionBlocks: (entrants: Entrant[]) => void;
  handleSessionBlockUpdate: (updatedSessionBlock: SessionBlock) => void;
  handleSessionBlocksReplace: (blocks: SessionBlock[], options?: SessionBlocksReplaceOptions) => void;
  handleScheduledSessionsChange: (sessions: SessionBlock[]) => void;
  handleClearGrid: () => void;
  handleUndoGridChange: () => void;
  handleRedoGridChange: () => void;
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
  const historyRef = useRef(createGridHistory());
  const blocksRef = useRef<SessionBlock[]>([]);
  blocksRef.current = allSessionBlocks;

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
    historyRef.current = clearGridHistory();
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

  const applyBlocks = useCallback((blocks: SessionBlock[]) => {
    flushPersist();
    setAllSessionBlocks(blocks);
    SessionService.saveSessionBlocks(blocks);
  }, [flushPersist]);

  const handleSessionBlockUpdate = useCallback((updatedSessionBlock: SessionBlock) => {
    historyRef.current = pushGridHistory(historyRef.current, blocksRef.current);
    setAllSessionBlocks(prev => {
      const updated = SessionService.updateSessionBlock(prev, updatedSessionBlock);
      schedulePersist(updated);
      return updated;
    });
  }, [schedulePersist]);

  const handleSessionBlocksReplace = useCallback((blocks: SessionBlock[], options?: SessionBlocksReplaceOptions) => {
    if (options?.resetHistory) {
      historyRef.current = clearGridHistory();
    } else {
      historyRef.current = pushGridHistory(historyRef.current, blocksRef.current);
    }
    applyBlocks(blocks);
  }, [applyBlocks]);

  const handleClearGrid = useCallback(() => {
    historyRef.current = clearGridHistory();
    applyBlocks(SessionService.clearGrid(blocksRef.current));
  }, [applyBlocks]);

  const handleUndoGridChange = useCallback(() => {
    const result = undoGridHistory(historyRef.current, blocksRef.current);
    if (!result) return;
    historyRef.current = result.history;
    applyBlocks(result.present);
  }, [applyBlocks]);

  const handleRedoGridChange = useCallback(() => {
    const result = redoGridHistory(historyRef.current, blocksRef.current);
    if (!result) return;
    historyRef.current = result.history;
    applyBlocks(result.present);
  }, [applyBlocks]);

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
    handleUndoGridChange,
    handleRedoGridChange,
    initializeEntrantJudgeAssignments,
  };
};
