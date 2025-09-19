import { createContext } from 'react';
import type { Entrant } from '../types';

export interface EntrantContextType {
  selectedEntrant: string | null;
  setSelectedEntrant: (entrant: string | null) => void;
  selectedGroupsToAvoid: string[];
  setSelectedGroupsToAvoid: (groups: string[]) => void;
  addSelectedGroupToAvoid: (groupId: string) => void;
  removeSelectedGroupToAvoid: (groupId: string) => void;
  clearSelectedGroupsToAvoid: () => void;
  // New functions to work with entrants data
  entrants: Entrant[];
  setEntrants: (entrants: Entrant[]) => void;
  getGroupsToAvoidForSelectedEntrant: () => string[];
}

export const EntrantContext = createContext<EntrantContextType | undefined>(undefined);





