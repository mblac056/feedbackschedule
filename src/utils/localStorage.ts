import type { Judge, Entrant, SessionBlock } from '../types';

const JUDGES_STORAGE_KEY = 'evalmatrix_judges';
const ENTRANTS_STORAGE_KEY = 'evalmatrix_entrants';
const SETTINGS_STORAGE_KEY = 'evalmatrix_settings';
const SESSION_BLOCKS_STORAGE_KEY = 'evalmatrix_session_blocks';

export const getJudges = (): Judge[] => {
  try {
    const stored = localStorage.getItem(JUDGES_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

export const saveJudges = (judges: Judge[]): void => {
  try {
    localStorage.setItem(JUDGES_STORAGE_KEY, JSON.stringify(judges));
  } catch (error) {
    console.error('Failed to save judges to localStorage:', error);
  }
};

export const addJudge = (judge: Judge): Judge[] => {
  const judges = getJudges();
  const updatedJudges = [...judges, judge];
  saveJudges(updatedJudges);
  return updatedJudges;
};

export const updateJudge = (judgeId: string, updates: Partial<Judge>): Judge[] => {
  const judges = getJudges();
  const updatedJudges = judges.map(judge => 
    judge.id === judgeId ? { ...judge, ...updates } : judge
  );
  saveJudges(updatedJudges);
  return updatedJudges;
};

export const removeJudge = (judgeId: string): Judge[] => {
  const judges = getJudges();
  const updatedJudges = judges.filter(judge => judge.id !== judgeId);
  saveJudges(updatedJudges);
  return updatedJudges;
};

// Entrants functions
export const getEntrants = (): Entrant[] => {
  try {
    const stored = localStorage.getItem(ENTRANTS_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

export const saveEntrants = (entrants: Entrant[]): void => {
  try {
    localStorage.setItem(ENTRANTS_STORAGE_KEY, JSON.stringify(entrants));
  } catch (error) {
    console.error('Failed to save entrants to localStorage:', error);
  }
};

export const addEntrant = (entrant: Entrant): Entrant[] => {
  const entrants = getEntrants();
  const updatedEntrants = [...entrants, entrant];
  saveEntrants(updatedEntrants);
  return updatedEntrants;
};

export const updateEntrant = (entrantId: string, updatedEntrant: Partial<Entrant>): Entrant[] => {
  const entrants = getEntrants();
  const updatedEntrants = entrants.map(entrant => 
    entrant.id === entrantId ? { ...entrant, ...updatedEntrant } : entrant
  );
  saveEntrants(updatedEntrants);
  return updatedEntrants;
};

export const removeEntrant = (entrantId: string): Entrant[] => {
  const entrants = getEntrants();
  const updatedEntrants = entrants.filter(entrant => entrant.id !== entrantId);
  saveEntrants(updatedEntrants);
  return updatedEntrants;
};

// Settings functions
export const getSettings = () => {
  const defaultSettings = {
    startTime: '09:00',
    oneXLongLength: 40,
    threeX20Length: 20,
    threeX10Length: 10,
    moving: 'groups' as 'groups' | 'judges',
  };

  try {
    const stored = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (stored) {
      const parsedSettings = JSON.parse(stored);
      // Merge with defaults to ensure all properties are present
      return { ...defaultSettings, ...parsedSettings };
    }
    // Return default settings if none stored
    return defaultSettings;
  } catch {
    return defaultSettings;
  }
};

export const saveSettings = (settings: {
  startTime: string;
  oneXLongLength: number;
  threeX20Length: number;
  threeX10Length: number;
  moving: 'groups' | 'judges';
}): void => {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch (error) {
    console.error('Failed to save settings to localStorage:', error);
  }
};

// Session Blocks functions
export const getSessionBlocks = (): SessionBlock[] => {
  try {
    const stored = localStorage.getItem(SESSION_BLOCKS_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

export const saveSessionBlocks = (sessionBlocks: SessionBlock[]): void => {
  try {
    localStorage.setItem(SESSION_BLOCKS_STORAGE_KEY, JSON.stringify(sessionBlocks));
  } catch (error) {
    console.error('Failed to save session blocks to localStorage:', error);
  }
};

