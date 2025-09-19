// Time configuration constants
export const TIME_CONFIG = {
  // Time slot configuration
  SLOT_HEIGHT_PX: 12, // Height of a 5-minute slot in pixels
  MINUTES_PER_SLOT: 5, // Minutes represented by each slot
  
  // Default session durations (fallback values)
  DEFAULT_SESSION_DURATIONS: {
    '1xLong': 8,    // 40 minutes = 8 slots (40/5)
    '3x20': 4,      // 20 minutes = 4 slots (20/5)
    '3x10': 2       // 10 minutes = 2 slots (10/5)
  },
  
  // Grid configuration
  TIME_SLOTS: 42,   // 3 hours 30 minutes * 12 slots per hour (5-minute increments)
  
  // Visual styling
  HOUR_MARKER_INTERVAL: 12, // Show hour marker every 12 slots (every hour)
  HALF_HOUR_MARKER_INTERVAL: 6 // Show half-hour marker every 6 slots
} as const;

// Settings interface for session durations
export interface SessionSettings {
  oneXLongLength: number;
  threeX20Length: number;
  threeX10Length: number;
  startTime: string;
  moving: 'judges' | 'groups';
}

// Helper function to get session duration in minutes from settings
export const getSessionDurationMinutes = (sessionType: '1xLong' | '3x20' | '3x10', settings?: SessionSettings): number => {
  if (!settings) {
    // Use default values if no settings provided
    const defaultMinutes = {
      '1xLong': 40,
      '3x20': 20,
      '3x10': 10
    };
    return defaultMinutes[sessionType];
  }
  switch (sessionType) {
    case '1xLong':
      return settings.oneXLongLength;
    case '3x20':
      return settings.threeX20Length;
    case '3x10':
      return settings.threeX10Length;
    default:
      return 10; // fallback
  }
};

// Helper function to calculate session height based on type and settings
export const getSessionHeight = (sessionType: '1xLong' | '3x20' | '3x10', settings?: SessionSettings): number => {
  const durationMinutes = getSessionDurationMinutes(sessionType, settings);
  const slotCount = durationMinutes / TIME_CONFIG.MINUTES_PER_SLOT;
  return slotCount * TIME_CONFIG.SLOT_HEIGHT_PX;
};

// Helper function to calculate session height in CSS
export const getSessionHeightCSS = (sessionType: '1xLong' | '3x20' | '3x10', settings?: SessionSettings): string => {
  return `${getSessionHeight(sessionType, settings)}px`;
};

// Helper function to get session duration in slots
export const getSessionDurationSlots = (sessionType: '1xLong' | '3x20' | '3x10', settings?: SessionSettings): number => {
  const durationMinutes = getSessionDurationMinutes(sessionType, settings);
  return durationMinutes / TIME_CONFIG.MINUTES_PER_SLOT;
};
