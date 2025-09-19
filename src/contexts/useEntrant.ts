import { useContext } from 'react';
import { EntrantContext } from './EntrantTypes';

export function useEntrant() {
  const context = useContext(EntrantContext);
  if (context === undefined) {
    throw new Error('useEntrant must be used within an EntrantProvider');
  }
  return context;
}
