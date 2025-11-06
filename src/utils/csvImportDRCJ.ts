import type { Entrant } from '../types';
import {
  type ImportResult,
  type DRCJReportImportData,
  parseComplexCSV,
  generateId
} from './csvImportShared';
import { createNameToIdMapper } from './nameToIdMapper';

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

    // First pass: create all entrants without groups to avoid
    const entrants: Entrant[] = [];
    const warnings: string[] = [];
    let rowsSkipped = 0;

    rows.forEach((row, index) => {
      const groupName = row['Group Name']?.trim();
      const estimated_pos:number = Number(row['Estimated POS']);

      const parsePOS = (pos: number) => {
        if (pos > 4) {
          return "Chorus";
        }
        return "Quartet";
      }

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

      // Create entrant object (without groups to avoid for now)
      const entrant: Entrant = {
        id: generateId(groupName),
        name: groupName,
        groupsToAvoid: [], // Will be populated in second pass
        preference: null, // Default to null, can be set manually later
        judgePreference1: '',
        judgePreference2: '',
        judgePreference3: '',
        includeInSchedule: false, // Default to false for new imports
        roomNumber: undefined,
        overallSF,
        overallF: undefined, // Not available in DRCJ Report format
        score: undefined, // Not available in DRCJ Report format
        groupType: parsePOS(estimated_pos),
      };

      entrants.push(entrant);
      console.log(`DRCJ Import: Row ${index + 2} - Created entrant:`, entrant);
    });

    console.log('DRCJ Import: Total unique groups found:', entrants.length);
    console.log('DRCJ Import: Group names:', entrants.map(e => e.name));

    // Second pass: process shared members using robust name-to-ID mapping
    const nameToIdMapper = createNameToIdMapper([], entrants); // Use newly created entrants

    rows.forEach((row, index) => {
      const groupName = row['Group Name']?.trim();
      if (!groupName) return; // Skip if no group name

      const entrant = entrants.find(e => e.name === groupName);
      if (!entrant) return; // Skip if entrant not found

      const sharedMembers = row['Shared Members']?.trim();
      if (sharedMembers) {
        console.log(`DRCJ Import: Row ${index + 2} - Processing shared members: "${sharedMembers}"`);

        // Split by comma and check each member against all group names
        const sharedMemberNames = sharedMembers.split(',').map(name => name.trim());

        sharedMemberNames.forEach(memberName => {
          console.log(`DRCJ Import: Row ${index + 2} - Checking member: "${memberName}"`);

          // Use robust name-to-ID mapping
          const groupToAvoidId = nameToIdMapper.findIdByName(memberName);

          if (groupToAvoidId && groupToAvoidId !== entrant.id) {
            // Add the ID if not already present
            if (!entrant.groupsToAvoid.includes(groupToAvoidId)) {
              entrant.groupsToAvoid.push(groupToAvoidId);
              console.log(`DRCJ Import: Row ${index + 2} - Added to groups to avoid: "${memberName}" (ID: ${groupToAvoidId})`);
            }
          } else if (groupToAvoidId === entrant.id) {
            console.log(`DRCJ Import: Row ${index + 2} - Skipped self-reference: "${memberName}"`);
          } else {
            console.log(`DRCJ Import: Row ${index + 2} - No match found for: "${memberName}"`);
            warnings.push(`Row ${index + 2}: Shared member "${memberName}" not found in imported groups`);
          }
        });

        console.log(`DRCJ Import: Row ${index + 2} - Final groups to avoid IDs:`, entrant.groupsToAvoid);
      }
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
