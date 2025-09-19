import { useState, useEffect, type ReactNode } from 'react';
import { SettingsContext, type SettingsContextType } from './SettingsTypes';
import type { SessionSettings } from '../config/timeConfig';

const DEFAULT_SETTINGS: SessionSettings = {
  oneXLongLength: 40,
  threeX20Length: 20,
  threeX10Length: 10,
  startTime: '09:00',
  moving: 'groups',
};

const STORAGE_KEY = 'evalmatrix_settings';

interface SettingsProviderProps {
  children: ReactNode;
}

export function SettingsProvider({ children }: SettingsProviderProps) {
  const [settings, setSettingsState] = useState<SessionSettings>(DEFAULT_SETTINGS);

  const loadSettings = () => {
    try {
      const storedSettings = localStorage.getItem(STORAGE_KEY);
      if (storedSettings) {
        const parsedSettings = JSON.parse(storedSettings);
        // Ensure all required fields are present with defaults
        setSettingsState({ 
          ...DEFAULT_SETTINGS, 
          ...parsedSettings,
          // Handle legacy settings that might not have startTime
          startTime: parsedSettings.startTime || DEFAULT_SETTINGS.startTime,
          moving: parsedSettings.moving || DEFAULT_SETTINGS.moving
        });
      } else {
        setSettingsState(DEFAULT_SETTINGS);
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
      setSettingsState(DEFAULT_SETTINGS);
    }
  };

  const setSettings = (newSettings: SessionSettings) => {
    setSettingsState(newSettings);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newSettings));
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
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
