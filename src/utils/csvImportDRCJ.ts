import type { Entrant } from '../types';
import { 
  type ImportResult, 
  type DRCJReportImportData, 
  parseComplexCSV, 
  generateId 
} from './csvImportShared';

/**
 * Import entrants from a DRCJ Report CSV
 * 
 * Expected CSV format:
 * - OA (O/A SF score)
 * - Group Name (required)
 * - BHS ID, District, Division, Area, Chapter(s), Director/Participant(s)
 * - Estimated POS, Evaluation?, Score/Eval-Only?, Award(s), Chart(s)
 * - Contacts, Shared Members (groups to avoid), Notes
 * 
 * @param csvText The raw CSV text
 * @returns ImportResult with entrants data
 */
export const importDRCJReportCSV = (csvText: string): ImportResult<DRCJReportImportData> => {
  try {
    const rows = parseComplexCSV(csvText); // Use complex parser for multi-line fields
    
    if (rows.length === 0) {
      return {
        success: false,
        message: 'CSV file is empty or could not be parsed'
      };
    }

    // Validate required columns
    const firstRow = rows[0];
    if (!('Group Name' in firstRow)) {
      return {
        success: false,
        message: 'Missing required column: "Group Name"',
        errors: ['Group Name column not found']
      };
    }

    console.log('DRCJ Import: Starting processing of', rows.length, 'rows');
    console.log('DRCJ Import: Available columns:', Object.keys(rows[0] || {}));

    // First pass: collect all group names for shared members matching
    const allGroupNames = new Map<string, string>(); // lowercase -> original casing
    rows.forEach((row, index) => {
      const groupName = row['Group Name']?.trim();
      if (groupName) {
        allGroupNames.set(groupName.toLowerCase(), groupName);
        console.log(`DRCJ Import: Row ${index + 2} - Found group: "${groupName}"`);
      } else {
        console.log(`DRCJ Import: Row ${index + 2} - No group name found`);
      }
    });

    console.log('DRCJ Import: Total unique groups found:', allGroupNames.size);
    console.log('DRCJ Import: Group names:', Array.from(allGroupNames.values()));

    // Process rows and create entrants
    const entrants: Entrant[] = [];
    const warnings: string[] = [];
    let rowsSkipped = 0;

    rows.forEach((row, index) => {
      const groupName = row['Group Name']?.trim();
      
      console.log(`DRCJ Import: Processing row ${index + 2}:`, {
        groupName,
        oa: row['OA'],
        sharedMembers: row['Shared Members'],
        allColumns: Object.keys(row)
      });
      
      // Skip rows with no group name
      if (!groupName) {
        rowsSkipped++;
        warnings.push(`Row ${index + 2}: Skipped - no group name provided`);
        console.log(`DRCJ Import: Row ${index + 2} - SKIPPED (no group name)`);
        return;
      }

      // Parse O/A SF score
      const parseNumber = (value: string | undefined): number | undefined => {
        if (!value) return undefined;
        const num = parseFloat(value);
        return isNaN(num) ? undefined : num;
      };

      const overallSF = parseNumber(row['OA']);

      // Process Shared Members for groups to avoid
      let groupsToAvoid = '';
      const sharedMembers = row['Shared Members']?.trim();
      if (sharedMembers) {
        console.log(`DRCJ Import: Row ${index + 2} - Processing shared members: "${sharedMembers}"`);
        
        // Split by comma and check each member against existing group names
        const sharedMemberNames = sharedMembers.split(',').map(name => name.trim());
        const validGroupsToAvoid: string[] = [];
        
        sharedMemberNames.forEach(memberName => {
          console.log(`DRCJ Import: Row ${index + 2} - Checking member: "${memberName}"`);
          
          // Check if this shared member name matches any existing group name (case insensitive)
          const matchingGroupOriginal = allGroupNames.get(memberName.toLowerCase());
          
          if (matchingGroupOriginal && matchingGroupOriginal !== groupName) {
            validGroupsToAvoid.push(matchingGroupOriginal);
            console.log(`DRCJ Import: Row ${index + 2} - Added to groups to avoid: "${matchingGroupOriginal}"`);
          } else if (matchingGroupOriginal === groupName) {
            console.log(`DRCJ Import: Row ${index + 2} - Skipped self-reference: "${memberName}"`);
          } else {
            console.log(`DRCJ Import: Row ${index + 2} - No match found for: "${memberName}"`);
          }
        });
        
        groupsToAvoid = validGroupsToAvoid.join(' | ');
        console.log(`DRCJ Import: Row ${index + 2} - Final groups to avoid: "${groupsToAvoid}"`);
      }

      // Create entrant object
      const entrant: Entrant = {
        id: generateId(groupName),
        name: groupName,
        groupsToAvoid,
        preference: null, // Default to null, can be set manually later
        judgePreference1: '',
        judgePreference2: '',
        judgePreference3: '',
        includeInSchedule: false, // Default to false for new imports
        roomNumber: undefined,
        overallSF,
        overallF: undefined // Not available in DRCJ Report format
      };

      entrants.push(entrant);
      console.log(`DRCJ Import: Row ${index + 2} - Created entrant:`, entrant);
    });

    console.log('DRCJ Import: Final results:', {
      totalRows: rows.length,
      entrantsCreated: entrants.length,
      rowsSkipped,
      warnings: warnings.length
    });

    return {
      success: true,
      message: `Successfully imported ${entrants.length} entrants from ${rows.length} rows`,
      data: {
        entrants,
        rowsProcessed: rows.length,
        rowsSkipped
      },
      warnings: warnings.length > 0 ? warnings : undefined
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to import entrants: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
};
