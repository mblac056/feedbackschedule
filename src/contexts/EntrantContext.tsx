import { useState, useEffect, useMemo, type ReactNode } from 'react';
import { EntrantContext, type EntrantContextType } from './EntrantTypes';
import type { Entrant } from '../types';
import { getEntrants } from '../utils/localStorage';

interface EntrantProviderProps {
  children: ReactNode;
}

export function EntrantProvider({ children }: EntrantProviderProps) {
  const [selectedEntrant, setSelectedEntrant] = useState<string | null>(null);
  const [entrants, setEntrants] = useState<Entrant[]>(() => getEntrants());

  useEffect(() => {
    const sync = () => setEntrants(getEntrants());
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === 'evalmatrix_entrants') sync();
    };
    window.addEventListener('entrantsUpdated', sync);
    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('entrantsUpdated', sync);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const selectedGroupsToAvoid = useMemo(() => {
    if (!selectedEntrant || entrants.length === 0) return [];
    const entrant = entrants.find(e => e.id === selectedEntrant);
    return entrant?.groupsToAvoid ?? [];
  }, [selectedEntrant, entrants]);

  const value = useMemo<EntrantContextType>(
    () => ({
      selectedEntrant,
      setSelectedEntrant,
      selectedGroupsToAvoid,
      entrants,
      setEntrants,
    }),
    [selectedEntrant, selectedGroupsToAvoid, entrants]
  );

  return (
    <EntrantContext.Provider value={value}>
      {children}
    </EntrantContext.Provider>
  );
}
