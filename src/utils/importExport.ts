import type { Judge, Entrant, SessionBlock } from '../types';
import { getJudges, getEntrants, getSessionBlocks, saveJudges, saveEntrants, saveSessionBlocks, getSettings, saveSettings, getPreferenceNotes, savePreferenceNotes } from './localStorage';

export interface ExportData {
  judges: Judge[];
  entrants: Entrant[];
  sessionBlocks: SessionBlock[];
  settings: {
    startTime: string;
    oneXLongLength: number;
    threeX20Length: number;
    threeX10Length: number;
    moving: 'judges' | 'groups';
  };
  preferenceNotes?: string;
  exportDate: string;
  version: string;
}

// Convert object to JSON string (more reliable than YAML)
export const convertToJSON = (data: ExportData): string => {
  return JSON.stringify(data, null, 2);
};

// Parse JSON string back to object
export const parseJSON = (jsonString: string): ExportData | null => {
  try {
    const data = JSON.parse(jsonString);
    console.log('Parsed data:', data);
    return data as ExportData;
  } catch (error) {
    console.error('Error parsing JSON:', error);
    return null;
  }
};

// Generate export data from current localStorage state
export const generateExportData = (): ExportData => {
  return {
    exportDate: new Date().toISOString(),
    version: '1.0',
    settings: getSettings(),
    judges: getJudges(),
    entrants: getEntrants(),
    sessionBlocks: getSessionBlocks(),
    preferenceNotes: getPreferenceNotes() || undefined,
  };
};

// Import data from JSON string
export const importData = (jsonString: string): { success: boolean; message: string; data?: any } => {
  try {
    if (!jsonString.trim()) {
      return { success: false, message: 'Please paste JSON data to import' };
    }

    console.log('Starting import with data:', jsonString.substring(0, 200) + '...');
    const parsedData = parseJSON(jsonString);
    console.log('Parsed data result:', parsedData);
    
    if (!parsedData) {
      return { success: false, message: 'Invalid JSON format. Please check your data and try again.' };
    }

    // Validate the data structure
    if (!Array.isArray(parsedData.judges) || !Array.isArray(parsedData.entrants)) {
      throw new Error('Invalid data structure');
    }

    // Clean up any invalid data before saving
    console.log('Raw settings:', parsedData.settings);
    console.log('Raw judges:', parsedData.judges);
    console.log('Raw entrants:', parsedData.entrants);
    console.log('Raw sessionBlocks:', parsedData.sessionBlocks);
    
    const cleanJudges = parsedData.judges
      .filter(judge => judge && judge.id && judge.name)
      .map(judge => ({ ...judge, active: judge.active !== false }));
    const cleanEntrants = parsedData.entrants.filter(entrant => entrant && entrant.id && entrant.name);
    const cleanSessionBlocks = (parsedData.sessionBlocks || []).filter(block => 
      block && block.id && block.entrantId && block.entrantName && block.type
    );
    
    // Clean settings with defaults
    const cleanSettings = {
      startTime: parsedData.settings?.startTime || '09:00',
      oneXLongLength: parsedData.settings?.oneXLongLength || 40,
      threeX20Length: parsedData.settings?.threeX20Length || 20,
      threeX10Length: parsedData.settings?.threeX10Length || 10,
      moving: parsedData.settings?.moving || 'judges' as 'judges' | 'groups',
    };
    
    console.log('Clean settings:', cleanSettings);
    console.log('Clean judges:', cleanJudges);
    console.log('Clean entrants:', cleanEntrants);
    console.log('Clean sessionBlocks:', cleanSessionBlocks);

    // Save to localStorage
    saveSettings(cleanSettings);
    saveJudges(cleanJudges);
    saveEntrants(cleanEntrants);
    saveSessionBlocks(cleanSessionBlocks);
    
    // Import preference notes if present
    if (parsedData.preferenceNotes !== undefined) {
      savePreferenceNotes(parsedData.preferenceNotes || '');
    }

    return { 
      success: true, 
      message: `Successfully imported ${cleanJudges.length} judges, ${cleanEntrants.length} entrants, ${cleanSessionBlocks.length} session blocks, settings${parsedData.preferenceNotes !== undefined ? ', and preference notes' : ''}. Please refresh the page to see changes.`,
      data: {
        judges: cleanJudges,
        entrants: cleanEntrants,
        sessionBlocks: cleanSessionBlocks,
        settings: cleanSettings,
        preferenceNotes: parsedData.preferenceNotes
      }
    };
  } catch (error) {
    return { 
      success: false, 
      message: `Import failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
    };
  }
};

// Quick export to clipboard
export const quickExportToClipboard = async (): Promise<{ success: boolean; message: string }> => {
  try {
    const exportData = generateExportData();
    const jsonString = convertToJSON(exportData);
    
    await navigator.clipboard.writeText(jsonString);
    
    return { 
      success: true, 
      message: `Exported ${exportData.judges.length} judges, ${exportData.entrants.length} entrants, ${exportData.sessionBlocks.length} session blocks, and settings to clipboard.` 
    };
  } catch (error) {
    return { 
      success: false, 
      message: `Export failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
    };
  }
};

// Quick export to file
export const quickExportToFile = (): { success: boolean; message: string } => {
  try {
    const exportData = generateExportData();
    const jsonString = convertToJSON(exportData);
    
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `evalmatrix-export-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    return { 
      success: true, 
      message: `Downloaded export file with ${exportData.judges.length} judges, ${exportData.entrants.length} entrants, ${exportData.sessionBlocks.length} session blocks, and settings.` 
    };
  } catch (error) {
    return { 
      success: false, 
      message: `Export failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
    };
  }
};
