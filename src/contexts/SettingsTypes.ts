import { createContext } from 'react';
import type { SessionSettings } from '../config/timeConfig';

export interface SettingsContextType {
  settings: SessionSettings;
  setSettings: (settings: SessionSettings) => void;
  loadSettings: () => void;
}

export const SettingsContext = createContext<SettingsContextType | undefined>(undefined);





