import { useEffect, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, ChangeEvent as ReactChangeEvent } from 'react';
import type { SessionSettings } from '../../../config/timeConfig';

const TIME_REGEX = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;

interface UseStartTimeEditParams {
  settings: SessionSettings;
  setSettings: (settings: SessionSettings) => void;
}

export function useStartTimeEdit({ settings, setSettings }: UseStartTimeEditParams) {
  const [isEditingStartTime, setIsEditingStartTime] = useState(false);
  const [tempStartTime, setTempStartTime] = useState(settings.startTime);

  useEffect(() => {
    setTempStartTime(settings.startTime);
  }, [settings.startTime]);

  const handleStartTimeClick = () => {
    setIsEditingStartTime(true);
  };

  const handleStartTimeChange = (e: ReactChangeEvent<HTMLInputElement>) => {
    setTempStartTime(e.target.value);
  };

  const handleStartTimeBlur = () => {
    if (TIME_REGEX.test(tempStartTime)) {
      setSettings({ ...settings, startTime: tempStartTime });
    } else {
      setTempStartTime(settings.startTime);
    }
    setIsEditingStartTime(false);
  };

  const handleStartTimeKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleStartTimeBlur();
    } else if (e.key === 'Escape') {
      setTempStartTime(settings.startTime);
      setIsEditingStartTime(false);
    }
  };

  return {
    isEditingStartTime,
    tempStartTime,
    handleStartTimeClick,
    handleStartTimeChange,
    handleStartTimeBlur,
    handleStartTimeKeyDown,
  };
}
