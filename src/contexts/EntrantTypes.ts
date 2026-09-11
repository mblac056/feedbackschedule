import { createContext } from 'react';
import type { Entrant } from '../types';

export interface EntrantContextType {
  selectedEntrant: string | null;
  setSelectedEntrant: (entrant: string | null) => void;
  selectedGroupsToAvoid: string[];
  entrants: Entrant[];
  setEntrants: (entrants: Entrant[]) => void;
}

export const EntrantContext = createContext<EntrantContextType | undefined>(undefined);
