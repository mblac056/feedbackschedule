import React, { useState, type ReactNode } from 'react';
import { EntrantContext, type EntrantContextType } from './EntrantTypes';
import type { Entrant } from '../types';

interface EntrantProviderProps {
  children: ReactNode;
}

export function EntrantProvider({ children }: EntrantProviderProps) {
  const [selectedEntrant, setSelectedEntrant] = useState<string | null>(null);
  const [entrants, setEntrants] = useState<Entrant[]>([]);

  // Compute groups to avoid whenever selectedEntrant or entrants change
  const selectedGroupsToAvoid = React.useMemo(() => {
    if (!selectedEntrant || entrants.length === 0) return [];
    
    const entrant = entrants.find(e => e.id === selectedEntrant);
    if (!entrant || !entrant.groupsToAvoid) return [];
    
    // groupsToAvoid is now already an array of IDs
    console.log('Selected entrant:', entrant.name, 'Groups to avoid:', entrant.groupsToAvoid);
    return entrant.groupsToAvoid;
  }, [selectedEntrant, entrants]);

  const value: EntrantContextType = {
    selectedEntrant,
    setSelectedEntrant,
    selectedGroupsToAvoid,
    setSelectedGroupsToAvoid: () => {}, // No-op since we compute this automatically
    addSelectedGroupToAvoid: () => {}, // No-op since we compute this automatically
    removeSelectedGroupToAvoid: () => {}, // No-op since we compute this automatically
    clearSelectedGroupsToAvoid: () => {}, // No-op since we compute this automatically
    entrants,
    setEntrants,
    getGroupsToAvoidForSelectedEntrant: () => selectedGroupsToAvoid,
  };

  return (
    <EntrantContext.Provider value={value}>
      {children}
    </EntrantContext.Provider>
  );
}
