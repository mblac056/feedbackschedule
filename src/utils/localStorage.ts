import type { Judge, Entrant, SessionBlock } from '../types';
import type { SessionSettings } from '../config/timeConfig';

// Storage keys - centralized in one place
const STORAGE_KEYS = {
  JUDGES: 'evalmatrix_judges',
  ENTRANTS: 'evalmatrix_entrants',
  SETTINGS: 'evalmatrix_settings',
  SESSION_BLOCKS: 'evalmatrix_session_blocks',
  PREFERENCE_NOTES: 'evalmatrix_preference_notes',
} as const;

// Default settings - centralized and consistent
const DEFAULT_SETTINGS: SessionSettings = {
  startTime: '09:00',
  oneXLongLength: 40,
  threeX20Length: 20,
  threeX10Length: 10,
  moving: 'groups',
};

// Enhanced localStorage service with consistent error handling and logging
export class LocalStorageService {
  private static logError(operation: string, error: unknown): void {
    console.error(`LocalStorageService.${operation} failed:`, error);
  }

  /*private static logSuccess(operation: string, data?: unknown): void {
    if (import.meta.env.DEV) {
      console.log(`LocalStorageService.${operation} succeeded`, data ? `with ${Array.isArray(data) ? data.length : 'data'}` : '');
    }
  }*/

  // Judges operations
  static getJudges(): Judge[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.JUDGES);
      const judges = stored ? JSON.parse(stored) : [];
      //this.logSuccess('getJudges', judges);
      return judges;
    } catch (error) {
      this.logError('getJudges', error);
      return [];
    }
  }

  static saveJudges(judges: Judge[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.JUDGES, JSON.stringify(judges));
      //this.logSuccess('saveJudges', judges);
    } catch (error) {
      this.logError('saveJudges', error);
    }
  }

  // Entrants operations
  static getEntrants(): Entrant[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.ENTRANTS);
      const entrants = stored ? JSON.parse(stored) : [];
      
      // Migrate old string-based groupsToAvoid to new array format
      const migratedEntrants = entrants.map((entrant: Entrant | (Partial<Entrant> & { groupsToAvoid?: string | string[]; name?: string; id?: string })) => {
        if (entrant.groupsToAvoid && typeof entrant.groupsToAvoid === 'string') {
          // Convert string to array of IDs by looking up names
          const groupNames = entrant.groupsToAvoid.split(' | ').map((g: string) => g.trim()).filter((g: string) => g);
          const groupIds: string[] = [];
          
          groupNames.forEach((groupName: string) => {
            // Find the entrant with this name and get its ID
            const matchingEntrant = entrants.find((e: Entrant | (Partial<Entrant> & { name?: string; id?: string })) => e.name === groupName);
            if (matchingEntrant) {
              groupIds.push(matchingEntrant.id);
            } else {
              console.warn(`Could not find entrant with name "${groupName}" for migration`);
            }
          });
          
          console.log(`Migrating entrant ${entrant.name}: converted "${entrant.groupsToAvoid}" to ${groupIds.length} IDs`);
          return {
            ...entrant,
            groupsToAvoid: groupIds
          };
        }
        return entrant;
      });
      
      //this.logSuccess('getEntrants', migratedEntrants);
      return migratedEntrants;
    } catch (error) {
      this.logError('getEntrants', error);
      return [];
    }
  }

  static saveEntrants(entrants: Entrant[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.ENTRANTS, JSON.stringify(entrants));
      //this.logSuccess('saveEntrants', entrants);
      
      // Dispatch custom event to notify components of entrant data changes
      window.dispatchEvent(new CustomEvent('entrantsUpdated', { detail: entrants }));
    } catch (error) {
      this.logError('saveEntrants', error);
    }
  }

  // Settings operations
  static getSettings(): SessionSettings {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (stored) {
        const parsedSettings = JSON.parse(stored);
        // Merge with defaults to ensure all properties are present
        const settings = { ...DEFAULT_SETTINGS, ...parsedSettings };
        //this.logSuccess('getSettings', settings);
        return settings;
      }
      //this.logSuccess('getSettings', 'using defaults');
      return DEFAULT_SETTINGS;
    } catch (error) {
      this.logError('getSettings', error);
      return DEFAULT_SETTINGS;
    }
  }

  static saveSettings(settings: SessionSettings): void {
    try {
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
      //this.logSuccess('saveSettings', settings);
    } catch (error) {
      this.logError('saveSettings', error);
    }
  }

  static clearSettings(): void {
    try {
      localStorage.removeItem(STORAGE_KEYS.SETTINGS);
      //this.logSuccess('clearSettings');
    } catch (error) {
      this.logError('clearSettings', error);
    }
  }

  // Session Blocks operations
  static getSessionBlocks(): SessionBlock[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.SESSION_BLOCKS);
      const sessionBlocks = stored ? JSON.parse(stored) : [];
      //this.logSuccess('getSessionBlocks', sessionBlocks);
      return sessionBlocks;
    } catch (error) {
      this.logError('getSessionBlocks', error);
      return [];
    }
  }

  static saveSessionBlocks(sessionBlocks: SessionBlock[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.SESSION_BLOCKS, JSON.stringify(sessionBlocks));
      //this.logSuccess('saveSessionBlocks', sessionBlocks);
    } catch (error) {
      this.logError('saveSessionBlocks', error);
    }
  }

  // Preference Notes operations
  static getPreferenceNotes(): string {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.PREFERENCE_NOTES);
      return stored || '';
    } catch (error) {
      this.logError('getPreferenceNotes', error);
      return '';
    }
  }

  static savePreferenceNotes(notes: string): void {
    try {
      localStorage.setItem(STORAGE_KEYS.PREFERENCE_NOTES, notes);
    } catch (error) {
      this.logError('savePreferenceNotes', error);
    }
  }

  // Utility methods
  static clearAll(): void {
    try {
      Object.values(STORAGE_KEYS).forEach(key => {
        localStorage.removeItem(key);
      });
      //this.logSuccess('clearAll');
    } catch (error) {
      this.logError('clearAll', error);
    }
  }

  static getStorageInfo(): { key: string; size: number; data: unknown }[] {
    return Object.entries(STORAGE_KEYS).map(([, key]) => {
      const data = localStorage.getItem(key);
      return {
        key,
        size: data ? data.length : 0,
        data: data ? JSON.parse(data) : null,
      };
    });
  }
}

// Backward-compatible wrapper functions that use the new LocalStorageService
// These maintain the existing API while using the centralized service internally

// Judges functions
export const getJudges = (): Judge[] => LocalStorageService.getJudges();
export const saveJudges = (judges: Judge[]): void => LocalStorageService.saveJudges(judges);

export const addJudge = (judge: Judge): Judge[] => {
  const judges = LocalStorageService.getJudges();
  const updatedJudges = [...judges, judge];
  LocalStorageService.saveJudges(updatedJudges);
  return updatedJudges;
};

export const updateJudge = (judgeId: string, updates: Partial<Judge>): Judge[] => {
  const judges = LocalStorageService.getJudges();
  const updatedJudges = judges.map(judge => 
    judge.id === judgeId ? { ...judge, ...updates } : judge
  );
  LocalStorageService.saveJudges(updatedJudges);
  return updatedJudges;
};

export const removeJudge = (judgeId: string): Judge[] => {
  const judges = LocalStorageService.getJudges();
  const updatedJudges = judges.filter(judge => judge.id !== judgeId);
  LocalStorageService.saveJudges(updatedJudges);
  return updatedJudges;
};

// Entrants functions
export const getEntrants = (): Entrant[] => LocalStorageService.getEntrants();
export const saveEntrants = (entrants: Entrant[]): void => LocalStorageService.saveEntrants(entrants);

export const addEntrant = (entrant: Entrant): Entrant[] => {
  const entrants = LocalStorageService.getEntrants();
  const updatedEntrants = [...entrants, entrant];
  LocalStorageService.saveEntrants(updatedEntrants);
  return updatedEntrants;
};

export const updateEntrant = (entrantId: string, updatedEntrant: Partial<Entrant>): Entrant[] => {
  const entrants = LocalStorageService.getEntrants();
  const updatedEntrants = entrants.map(entrant => 
    entrant.id === entrantId ? { ...entrant, ...updatedEntrant } : entrant
  );
  LocalStorageService.saveEntrants(updatedEntrants);
  return updatedEntrants;
};

export const removeEntrant = (entrantId: string): Entrant[] => {
  const entrants = LocalStorageService.getEntrants();
  const updatedEntrants = entrants.filter(entrant => entrant.id !== entrantId);
  LocalStorageService.saveEntrants(updatedEntrants);
  return updatedEntrants;
};

// Settings functions
export const getSettings = (): SessionSettings => LocalStorageService.getSettings();
export const saveSettings = (settings: SessionSettings): void => LocalStorageService.saveSettings(settings);

// Session Blocks functions
export const getSessionBlocks = (): SessionBlock[] => LocalStorageService.getSessionBlocks();
export const saveSessionBlocks = (sessionBlocks: SessionBlock[]): void => LocalStorageService.saveSessionBlocks(sessionBlocks);

// Preference Notes functions
export const getPreferenceNotes = (): string => LocalStorageService.getPreferenceNotes();
export const savePreferenceNotes = (notes: string): void => LocalStorageService.savePreferenceNotes(notes);

// Utility function to clear the grid by unscheduling all session blocks
export const clearGrid = (sessionBlocks: SessionBlock[]): SessionBlock[] => {
  return sessionBlocks.map(block => ({
    ...block,
    isScheduled: false,
    startRowIndex: undefined,
    judgeId: undefined
  }));
};

// Utility function to reorder session blocks based on entrant order
export const reorderSessionBlocksByEntrants = (sessionBlocks: SessionBlock[], entrants: Entrant[]): SessionBlock[] => {
  // Create a map of entrant order for quick lookup
  const entrantOrderMap = new Map<string, number>();
  entrants.forEach((entrant, index) => {
    entrantOrderMap.set(entrant.id, index);
  });

  // Sort session blocks by entrant order, then by type, then by session index
  return [...sessionBlocks].sort((a, b) => {
    const aOrder = entrantOrderMap.get(a.entrantId) ?? 999;
    const bOrder = entrantOrderMap.get(b.entrantId) ?? 999;
    
    // First sort by entrant order
    if (aOrder !== bOrder) {
      return aOrder - bOrder;
    }
    
    // Then sort by type (1xLong, 3x20, 3x10)
    const typeOrder = { '1xLong': 1, '3x20': 2, '3x10': 3 };
    const aTypeOrder = typeOrder[a.type] || 4;
    const bTypeOrder = typeOrder[b.type] || 4;
    
    if (aTypeOrder !== bTypeOrder) {
      return aTypeOrder - bTypeOrder;
    }
    
    // Finally sort by session index for multi-session types
    const aSessionIndex = a.sessionIndex ?? 0;
    const bSessionIndex = b.sessionIndex ?? 0;
    
    return aSessionIndex - bSessionIndex;
  });
};

