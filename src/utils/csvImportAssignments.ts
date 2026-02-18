import type { Judge } from '../types';
import { 
  type ImportResult, 
  type AssignmentsImportData, 
  parseSimpleCSV, 
  shortenJudgeNames, 
  generateId, 
  validateColumns 
} from './csvImportShared';

/**
 * Import judges from an Assignments CSV
 * 
 * Expected CSV format:
 * - Name (required) - Full name of the person
 * - Type (required) - Must be "Official" to be included
 * - Category (required) - Must be "MUS", "PER", or "SNG" to be included
 * - District, City, State, Country (optional, ignored)
 * 
 * Filters applied:
 * - Only imports rows where Type = "Official" and Category is one of "MUS", "PER", "SNG"
 * - Ignores rows where Type = "Practice" or Category is "PC" or "ADM"
 * - Shortens names to first initial + last name format
 * 
 * @param csvText The raw CSV text
 * @returns ImportResult with judges data
 */
export const importAssignmentsCSV = (csvText: string): ImportResult<AssignmentsImportData> => {
  try {
    const rows = parseSimpleCSV(csvText);
    
    if (rows.length === 0) {
      return {
        success: false,
        message: 'CSV file is empty or could not be parsed'
      };
    }

    // Validate required columns
    const requiredColumns = ['Name', 'Type', 'Category'];
    const validation = validateColumns(rows, requiredColumns);
    
    if (!validation.valid) {
      return {
        success: false,
        message: `Missing required columns: ${validation.missing.join(', ')}`,
        errors: validation.missing
      };
    }

    // First pass: collect all valid full names for duplicate detection
    const validFullNames: string[] = [];
    const validRows: Array<{ fullName: string; category: string; rowIndex: number }> = [];
    
    rows.forEach((row, index) => {
      const fullName = row['Name']?.trim();
      const type = row['Type']?.trim();
      const category = row['Category']?.trim().toUpperCase();
      
      // Skip rows with missing required data
      if (!fullName || !type || !category) {
        return;
      }

      // Filter: Only "Official" type
      if (type.toLowerCase() !== 'official') {
        return;
      }

      // Filter: Only MUS, PER, or SNG categories
      if (!['MUS', 'PER', 'SNG'].includes(category)) {
        return;
      }

      validFullNames.push(fullName);
      validRows.push({ fullName, category, rowIndex: index });
    });

    // Shorten all names at once to handle duplicates intelligently
    const shortenedNames = shortenJudgeNames(validFullNames);

    // Second pass: create judges with shortened names
    const judges: Judge[] = [];
    const warnings: string[] = [];
    let rowsSkipped = 0;

    // Count skipped rows for reporting
    rowsSkipped = rows.length - validRows.length;

    validRows.forEach((validRow, index) => {
      const { category } = validRow;
      const shortenedName = shortenedNames[index];

      // Create judge object
      const judge: Judge = {
        id: generateId(shortenedName),
        name: shortenedName,
        category: category as 'SNG' | 'MUS' | 'PER',
        active: true,
      };

      judges.push(judge);
    });

    // Add warnings for skipped rows
    rows.forEach((row, index) => {
      const fullName = row['Name']?.trim();
      const type = row['Type']?.trim();
      const category = row['Category']?.trim().toUpperCase();
      
      // Check if this row was skipped and why
      if (!fullName || !type || !category) {
        warnings.push(`Row ${index + 2}: Skipped - missing required data (Name, Type, or Category)`);
      } else if (type.toLowerCase() !== 'official') {
        warnings.push(`Row ${index + 2}: Skipped - Type "${type}" is not "Official"`);
      } else if (!['MUS', 'PER', 'SNG'].includes(category)) {
        warnings.push(`Row ${index + 2}: Skipped - Category "${category}" is not MUS, PER, or SNG`);
      }
    });

    return {
      success: true,
      message: `Successfully imported ${judges.length} judges from ${rows.length} rows (${rowsSkipped} filtered out)`,
      data: {
        judges,
        rowsProcessed: rows.length,
        rowsSkipped
      },
      warnings: warnings.length > 0 ? warnings : undefined
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to import judges: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
};
