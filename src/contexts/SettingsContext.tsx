import { useState, useEffect, type ReactNode } from 'react';
import { SettingsContext, type SettingsContextType } from './SettingsTypes';
import type { SessionSettings } from '../config/timeConfig';
import { LocalStorageService } from '../utils/localStorage';

interface SettingsProviderProps {
  children: ReactNode;
}

export function SettingsProvider({ children }: SettingsProviderProps) {
  const [settings, setSettingsState] = useState<SessionSettings>(LocalStorageService.getSettings());

  const loadSettings = () => {
    const loadedSettings = LocalStorageService.getSettings();
    setSettingsState(loadedSettings);
  };

  const setSettings = (newSettings: SessionSettings) => {
    setSettingsState(newSettings);
    LocalStorageService.saveSettings(newSettings);
  };

  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, []);

  const value: SettingsContextType = {
    settings,
    setSettings,
    loadSettings,
  };

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}
