import { useState, useEffect } from 'react';
import { FaTimes } from 'react-icons/fa';
import type { SessionBlock } from '../types';
import { useSettings } from '../contexts/useSettings';
import type { SessionSettings } from '../config/timeConfig';
import { LocalStorageService } from '../utils/localStorage';

interface Settings extends SessionSettings {
  feedbackStart: string;
  moving: 'judges' | 'groups';
}

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  scheduledSessions: SessionBlock[];
  onCompleteReset?: () => void;
  onClearGrid?: () => void;
}

const DEFAULT_SETTINGS: Settings = {
  feedbackStart: '21:00',
  oneXLongLength: 40,
  threeX20Length: 20,
  threeX10Length: 10,
  startTime: '09:00',
  moving: 'groups',
};


export default function SettingsModal({ isOpen, onClose, scheduledSessions, onCompleteReset, onClearGrid }: SettingsModalProps) {
  const { setSettings: setContextSettings } = useSettings();
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [originalSettings, setOriginalSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [showResetWarning, setShowResetWarning] = useState(false);
  const [showValidationError, setShowValidationError] = useState(false);
  const [showCompleteResetWarning, setShowCompleteResetWarning] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Load settings from LocalStorageService
      const loadedSettings = LocalStorageService.getSettings();
      // Convert SessionSettings to Settings by adding feedbackStart
      const settingsWithFeedback: Settings = {
        ...loadedSettings,
        feedbackStart: '21:00', // Default feedback start time
      };
      setSettings(settingsWithFeedback);
      // Store the original settings to detect changes
      setOriginalSettings(settingsWithFeedback);
      // Reset warnings when modal opens
      setShowResetWarning(false);
      setShowValidationError(false);
      setShowCompleteResetWarning(false);
    }
  }, [isOpen]);

  const validateSessionLengths = (settings: Settings): boolean => {
    return settings.oneXLongLength % 5 === 0 && 
           settings.threeX20Length % 5 === 0 && 
           settings.threeX10Length % 5 === 0 &&
           settings.threeX10Length < settings.threeX20Length &&
           settings.threeX20Length < settings.oneXLongLength;
  };

  const hasSessionLengthsChanged = (): boolean => {
    return settings.oneXLongLength !== originalSettings.oneXLongLength ||
           settings.threeX20Length !== originalSettings.threeX20Length ||
           settings.threeX10Length !== originalSettings.threeX10Length;
  };

  const handleSave = () => {
    // Check if session lengths are valid (multiples of 5)
    if (!validateSessionLengths(settings)) {
      setShowValidationError(true);
      return;
    }
    
    // Check if session lengths have changed and clear grid if needed
    if (hasSessionLengthsChanged() && onClearGrid) {
      onClearGrid();
    }
    
    // Save settings using LocalStorageService (only SessionSettings part)
    const sessionSettings: SessionSettings = {
      oneXLongLength: settings.oneXLongLength,
      threeX20Length: settings.threeX20Length,
      threeX10Length: settings.threeX10Length,
      startTime: settings.startTime,
      moving: settings.moving,
    };
    LocalStorageService.saveSettings(sessionSettings);
    
    // Update the context settings with all settings
    setContextSettings({
      oneXLongLength: settings.oneXLongLength,
      threeX20Length: settings.threeX20Length,
      threeX10Length: settings.threeX10Length,
      startTime: settings.startTime,
      moving: settings.moving as 'judges' | 'groups',
    });
    
    setShowResetWarning(false);
    setShowValidationError(false);
    onClose();
  };

  const handleReset = () => {
    setSettings(DEFAULT_SETTINGS);
    setShowResetWarning(false);
    setShowValidationError(false);
  };

  const handleCompleteReset = () => {
    // Clear all data using LocalStorageService
    LocalStorageService.saveJudges([]);
    LocalStorageService.saveEntrants([]);
    LocalStorageService.saveSessionBlocks([]);
    LocalStorageService.clearSettings();
    
    // Reset settings to default
    setSettings(DEFAULT_SETTINGS);
    
    // Update context settings
    setContextSettings({
      oneXLongLength: DEFAULT_SETTINGS.oneXLongLength,
      threeX20Length: DEFAULT_SETTINGS.threeX20Length,
      threeX10Length: DEFAULT_SETTINGS.threeX10Length,
      startTime: DEFAULT_SETTINGS.startTime,
      moving: DEFAULT_SETTINGS.moving as 'judges' | 'groups',
    });
    
    // Reset all warning states
    setShowResetWarning(false);
    setShowValidationError(false);
    setShowCompleteResetWarning(false);
    
    // Call parent callback to refresh the app
    if (onCompleteReset) {
      onCompleteReset();
    }
    
    // Close modal
    onClose();
  };

  const handleInputChange = (field: keyof Settings, value: string | number) => {
    setSettings(prev => {
      const newSettings = {
        ...prev,
        [field]: value
      };
      
      // Check if this is a session length change and there are existing scheduled sessions
      const isSessionLengthField = field === 'oneXLongLength' || field === 'threeX20Length' || field === 'threeX10Length';
      const hasExistingSessions = scheduledSessions.length > 0;
      
      if (isSessionLengthField && hasExistingSessions) {
        setShowResetWarning(true);
      }
      
      // Validate session lengths and update validation error state
      if (isSessionLengthField) {
        setShowValidationError(!validateSessionLengths(newSettings));
      }
      
      return newSettings;
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="bg-gradient-to-r from-gray-600 to-gray-700 text-white p-6 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold">Settings</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
          >
            <FaTimes />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          <div className="space-y-6 text-gray-700">
            {/* Travel Directions */}
            <div>
              <label className="block text-sm font-medium  mb-2">
                Movement
              </label>
              <select
                value={settings.moving}
                onChange={(e) => handleInputChange('moving', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-transparent"
              >
                <option value="judges">Judges visit groups</option>
                <option value="groups">Groups visit judges</option>
              </select>
            </div>
            {/* Feedback Start Time */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Feedback Start Time
              </label>
              <input
                type="time"
                value={settings.startTime}
                onChange={(e) => handleInputChange('startTime', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-transparent"
              />
            </div>

            {/* 1XLong Length */}
            <div>
              <label className="block text-sm font-medium mb-2">
                1XLong Length (minutes)
              </label>
              <input
                type="number"
                min="5"
                max="120"
                step="5"
                value={settings.oneXLongLength}
                onChange={(e) => handleInputChange('oneXLongLength', parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-transparent"
              />
            </div>

            {/* 3X20 Length */}
            <div>
              <label className="block text-sm font-medium mb-2">
                3X20 Length (minutes)
              </label>
              <input
                type="number"
                min="5"
                max="60"
                step="5"
                value={settings.threeX20Length}
                onChange={(e) => handleInputChange('threeX20Length', parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-transparent"
              />
            </div>

            {/* 3X10 Length */}
            <div>
              <label className="block text-sm font-medium mb-2">
                3X10 Length (minutes)
              </label>
              <input
                type="number"
                min="5"
                max="30"
                step="5"
                value={settings.threeX10Length}
                onChange={(e) => handleInputChange('threeX10Length', parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Warning Message */}
          {showResetWarning && (
            <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-amber-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-amber-800">
                    Warning: Scheduling Grid Reset
                  </h3>
                  <div className="mt-2 text-sm text-amber-700">
                    <p>
                      Changing session lengths will automatically clear your current scheduling grid and unschedule all sessions. 
                      Make sure to save or export your current schedule before proceeding.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Validation Error Message */}
          {showValidationError && (
            <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">
                    Invalid Session Lengths
                  </h3>
                  <div className="mt-2 text-sm text-red-700">
                    <p>
                      All session lengths must be multiples of 5 minutes, the 3X10 length must be less than the 3X20 length, and the 3X20 length must be less than the 1XLong length. Please adjust the values before saving.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Complete Reset Warning Message */}
          {showCompleteResetWarning && (
            <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">
                    Complete Reset Warning
                  </h3>
                  <div className="mt-2 text-sm text-red-700">
                    <p>
                      This will permanently delete ALL data including judges, entrants, session blocks, and settings. 
                      This action cannot be undone. Make sure to export your data first if you want to keep it.
                    </p>
                  </div>
                  <div className="mt-4 flex space-x-3">
                    <button
                      onClick={() => setShowCompleteResetWarning(false)}
                      className="px-3 py-1 bg-gray-200 text-gray-800 rounded text-sm hover:bg-gray-300 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleCompleteReset}
                      className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700 transition-colors"
                    >
                      Confirm Complete Reset
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          {!showCompleteResetWarning && (
            <div className="space-y-3 mt-8">
            <div className="flex space-x-3">
              <button
                onClick={handleReset}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Reset to Defaults
              </button>
              <button
                onClick={handleSave}
                disabled={showValidationError}
                className={`flex-1 px-4 py-2 rounded-lg focus:ring-2 focus:ring-offset-2 transition-colors ${
                  showValidationError 
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                    : 'bg-gray-600 text-white hover:bg-gray-700 focus:ring-gray-500'
                }`}
              >
                Save Settings
              </button>
            </div>
            <button
              onClick={() => setShowCompleteResetWarning(true)}
              className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors"
            >
              Complete Reset
            </button>
          </div>
          )}
        </div>
      </div>
    </div>
  );
}
