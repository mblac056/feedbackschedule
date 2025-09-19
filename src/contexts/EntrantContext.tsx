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
    
    // Split the groupsToAvoid string and find the corresponding entrant IDs
    const groupNames = entrant.groupsToAvoid.split(' | ').map(g => g.trim()).filter(g => g);
    const groupIds = groupNames
      .map(groupName => entrants.find(e => e.name === groupName)?.id)
      .filter(id => id !== undefined) as string[];
    
    console.log('Selected entrant:', entrant.name, 'Groups to avoid:', groupIds);
    return groupIds;
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
