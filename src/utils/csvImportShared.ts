import type { Judge, Entrant } from '../types';

// ============================================================================
// Type Definitions
// ============================================================================

export interface ImportResult<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  errors?: string[];
  warnings?: string[];
}

export interface AssignmentsImportData {
  judges: Judge[];
  rowsProcessed: number;
  rowsSkipped: number;
}

export interface DRCJReportImportData {
  entrants: Entrant[];
  rowsProcessed: number;
  rowsSkipped: number;
}

export interface EvalPreferencesImportData {
  entrantsUpdated: number;
  entrantsNotFound: number;
  rowsProcessed: number;
  rowsSkipped: number;
}

// ============================================================================
// Shared Utility Functions
// ============================================================================

/**
 * Shorten all judge names to first initial + last name format
 * @param fullNames Array of all full names to process
 * @returns Array of shortened names in "FirstInitial. LastName" format
 */
export const shortenJudgeNames = (fullNames: string[]): string[] => {
  if (fullNames.length === 0) return [];
  
  const shortenedNames: string[] = [];
  
  fullNames.forEach(fullName => {
    const trimmed = fullName.trim();
    if (!trimmed) {
      shortenedNames.push('');
      return;
    }
    
    const nameParts = trimmed.split(/\s+/);
    if (nameParts.length === 0) {
      shortenedNames.push(trimmed);
      return;
    }
    
    const lastName = nameParts[nameParts.length - 1];
    const firstName = nameParts[0];
    
    // Always use first initial + last name format
    const firstInitial = firstName[0].toUpperCase();
    shortenedNames.push(`${firstInitial}. ${lastName}`);
  });
  
  return shortenedNames;
};

/**
 * Shorten a single judge name (for backward compatibility)
 * @param fullName The full name to shorten
 * @param allNames Array of all names to check for duplicates (optional)
 * @returns Shortened name in "FirstInitial. LastName" format
 */
export const shortenJudgeName = (fullName: string, allNames?: string[]): string => {
  if (allNames && allNames.length > 0) {
    const shortened = shortenJudgeNames(allNames);
    const index = allNames.findIndex(name => name.trim() === fullName.trim());
    return index >= 0 ? shortened[index] : fullName.trim();
  }
  
  // Fallback: convert to first initial + last name format
  const trimmed = fullName.trim();
  if (!trimmed) return trimmed;
  
  const nameParts = trimmed.split(/\s+/);
  if (nameParts.length === 0) return trimmed;
  
  const lastName = nameParts[nameParts.length - 1];
  const firstName = nameParts[0];
  const firstInitial = firstName[0].toUpperCase();
  
  return `${firstInitial}. ${lastName}`;
};

/**
 * Convert any judge name to the standardized "FirstInitial. LastName" format
 * @param fullName The full name to convert
 * @returns Standardized name format
 */
export const normalizeJudgeName = (fullName: string): string => {
  const trimmed = fullName.trim();
  if (!trimmed) return trimmed;
  
  const nameParts = trimmed.split(/\s+/);
  if (nameParts.length === 0) return trimmed;
  
  const lastName = nameParts[nameParts.length - 1];
  const firstName = nameParts[0];
  const firstInitial = firstName[0].toUpperCase();
  
  return `${firstInitial}. ${lastName}`;
};

/**
 * Parse a simple CSV string (for Assignments - no multi-line fields)
 * @param csvText The raw CSV text
 * @param delimiter The delimiter used (default: comma)
 * @returns Array of row objects with headers as keys (duplicate headers get numbered)
 */
export const parseSimpleCSV = (csvText: string, delimiter: string = ','): Record<string, string>[] => {
  const lines = csvText.trim().split('\n');
  if (lines.length === 0) {
    return [];
  }

  // Parse header row
  const originalHeaders = lines[0].split(delimiter).map(h => h.trim().replace(/^"|"$/g, ''));
  
  // Create unique headers by appending numbers to duplicates
  const headers: string[] = [];
  const headerCounts = new Map<string, number>();
  
  originalHeaders.forEach(header => {
    const count = headerCounts.get(header) || 0;
    headerCounts.set(header, count + 1);
    
    if (count === 0) {
      headers.push(header);
    } else {
      headers.push(`${header} (${count})`);
    }
  });
  
  // Parse data rows (simple line-by-line)
  const rows: Record<string, string>[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue; // Skip empty lines
    
    const values = line.split(delimiter).map(v => v.trim().replace(/^"|"$/g, ''));
    const row: Record<string, string> = {};
    
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });
    
    rows.push(row);
  }
  
  return rows;
};

/**
 * Parse a complex CSV string with multi-line fields (for DRCJ Reports)
 * @param csvText The raw CSV text
 * @param delimiter The delimiter used (default: comma)
 * @returns Array of row objects with headers as keys (only rows with Group Name)
 */
export const parseComplexCSV = (csvText: string, delimiter: string = ','): Record<string, string>[] => {
  const lines = csvText.trim().split('\n');
  if (lines.length === 0) {
    return [];
  }

  // Parse header row
  const headers = lines[0].split(delimiter).map(h => h.trim().replace(/^"|"$/g, ''));
  
  // Parse data rows with proper CSV handling for quoted fields with newlines
  const rows: Record<string, string>[] = [];
  let currentRow = '';
  let quoteCount = 0;
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    
    // Count quotes in the line
    const lineQuoteCount = (line.match(/"/g) || []).length;
    quoteCount += lineQuoteCount;
    
    // If we're building a row, add this line to it
    if (currentRow) {
      currentRow += '\n' + line;
    } else {
      currentRow = line;
    }
    
    // If we have an even number of quotes, we have a complete row
    if (quoteCount % 2 === 0) {
      // Parse the complete row
      const values = parseCSVLine(currentRow, delimiter);
      const row: Record<string, string> = {};
      
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });
      
      // Only include rows with a Group Name (filters out song title rows)
      if (row['Group Name'] && row['Group Name'].trim()) {
        rows.push(row);
      }
      
      // Reset for next row
      currentRow = '';
      quoteCount = 0;
    }
  }
  
  return rows;
};

/**
 * Parse a single CSV line, handling quoted fields properly
 */
const parseCSVLine = (line: string, delimiter: string): string[] => {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped quote
        current += '"';
        i++; // Skip next quote
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      // End of field
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  // Add the last field
  result.push(current.trim());
  
  return result;
};

/**
 * Generate a unique ID based on name and timestamp
 */
export const generateId = (name: string): string => {
  const timestamp = Date.now();
  const sanitized = name.toLowerCase().replace(/[^a-z0-9]/g, '-');
  return `${sanitized}-${timestamp}`;
};

/**
 * Validate that required columns exist in the CSV
 */
export const validateColumns = (
  rows: Record<string, string>[],
  requiredColumns: string[]
): { valid: boolean; missing: string[] } => {
  if (rows.length === 0) {
    return { valid: false, missing: requiredColumns };
  }

  const availableColumns = Object.keys(rows[0]);
  const missing = requiredColumns.filter(col => !availableColumns.includes(col));
  
  return {
    valid: missing.length === 0,
    missing
  };
};
