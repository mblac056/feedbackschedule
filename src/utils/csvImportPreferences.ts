import type { Judge, Entrant } from '../types';
import { 
  type ImportResult, 
  type EvalPreferencesImportData, 
  parseSimpleCSV, 
  normalizeJudgeName 
} from './csvImportShared';
import { createNameToIdMapper } from './nameToIdMapper';

/**
 * Import preferences for existing entrants/groups from submission document
 * 
 * Expected CSV format:
 * - Group Name (required, must match existing)
 * - Group To Avoid (optional, group names to avoid - can reference existing or other imported entrants)
 * - Eval Type Finals (optional, preference)
 * - Eval Type Semifinals (optional, preference)
 * - Eval Type Finals (optional, preference - multiple columns)
 * - 1st Choice, 2nd Choice, 3rd Choice (optional, judge names with categories)
 * 
 * @param csvText The raw CSV text
 * @param existingEntrants Current entrants to update
 * @param existingJudges Current judges for validation
 * @param importedEntrants Optional array of entrants being imported in the same batch (for cross-references)
 * @returns ImportResult with update statistics
 */
export const importEvalPreferencesCSV = (
  csvText: string,
  existingEntrants: Entrant[],
  existingJudges: Judge[],
  importedEntrants: Entrant[] = []
): ImportResult<EvalPreferencesImportData> => {
  try {
    console.log('=== PREFERENCES IMPORT: Starting ===');
    
    const rows = parseSimpleCSV(csvText);
    
    if (rows.length === 0) {
      return {
        success: false,
        message: 'CSV file is empty or could not be parsed'
      };
    }

    console.log('PREFERENCES IMPORT: Available columns:', Object.keys(rows[0] || {}));

    // Validate required columns
    const firstRow = rows[0];
    if (!('Group Name' in firstRow)) {
      return {
        success: false,
        message: 'Missing required column: "Group Name"',
        errors: ['Group Name column not found']
      };
    }

    // Create maps for quick lookup
    const entrantMap = new Map<string, Entrant>();
    const entrantNames = new Set<string>();
    existingEntrants.forEach(entrant => {
      entrantMap.set(entrant.name.toLowerCase().trim(), entrant);
      entrantNames.add(entrant.name.toLowerCase().trim());
    });

    const judgeMap = new Map<string, Judge>();
    existingJudges.forEach(judge => {
      judgeMap.set(judge.name.toLowerCase().trim(), judge);
    });

    // Create robust name-to-ID mapper (includes both existing and imported entrants)
    const nameToIdMapper = createNameToIdMapper(existingEntrants, importedEntrants);

    // Process rows and update entrants
    const warnings: string[] = [];
    let rowsSkipped = 0;
    let entrantsUpdated = 0;
    let entrantsNotFound = 0;

    rows.forEach((row, index) => {
      const groupName = row['Group Name']?.trim();
      
      // Skip rows with no group name
      if (!groupName) {
        rowsSkipped++;
        warnings.push(`Row ${index + 2}: Skipped - no group name provided`);
        return;
      }

      // Find existing entrant
      const existingEntrant = entrantMap.get(groupName.toLowerCase());
      if (!existingEntrant) {
        entrantsNotFound++;
        warnings.push(`Row ${index + 2}: Group "${groupName}" not found in existing entrants`);
        return;
      }

      console.log(`PREFERENCES IMPORT: Row ${index + 2} - Processing "${groupName}"`);
      console.log(`  CSV Data:`, {
        'Eval Type Finals': row['Eval Type Finals'],
        'Eval Type Semifinals': row['Eval Type Semifinals'],
        '1st Choice': row['1st Choice'],
        '2nd Choice': row['2nd Choice'],
        '3rd Choice': row['3rd Choice'],
        'Group To Avoid': row['Group To Avoid']
      });
      console.log(`  Before: preference = "${existingEntrant.preference}"`);

      // Process Groups to Avoid
      const groupToAvoid = row['Group To Avoid']?.trim();
      if (groupToAvoid) {
        // Use robust name-to-ID mapping
        const groupToAvoidId = nameToIdMapper.findIdByName(groupToAvoid);
        
        if (groupToAvoidId && groupToAvoidId !== existingEntrant.id) {
          // Initialize groupsToAvoid as array if it's not already
          if (!Array.isArray(existingEntrant.groupsToAvoid)) {
            existingEntrant.groupsToAvoid = [];
          }
          // Add the ID if not already present
          if (!existingEntrant.groupsToAvoid.includes(groupToAvoidId)) {
            existingEntrant.groupsToAvoid.push(groupToAvoidId);
            console.log(`PREFERENCES IMPORT: Row ${index + 2} - Added group to avoid: "${groupToAvoid}" (ID: ${groupToAvoidId})`);
          }
        } else if (!groupToAvoidId) {
          console.warn(`PREFERENCES IMPORT: Row ${index + 2} - Group to avoid "${groupToAvoid}" not found in existing entrants`);
          warnings.push(`Row ${index + 2}: Group to avoid "${groupToAvoid}" not found`);
        } else {
          console.log(`PREFERENCES IMPORT: Row ${index + 2} - Skipped self-reference: "${groupToAvoid}"`);
        }
      }

      // Process preference (first non-blank Eval Type column)
      // Since there can be multiple columns with the same name, we need to check all columns
      // and find the first one that contains "eval type" and has a non-blank value
      console.log(`  All available columns:`, Object.keys(row));
      
      // Collect all eval type preferences to check for mismatches
      const evalTypePreferences: { [key: string]: string } = {};
      for (const [columnName, value] of Object.entries(row)) {
        const isEvalTypeColumn = columnName.toLowerCase().includes('eval type');
        if (isEvalTypeColumn && value?.trim()) {
          evalTypePreferences[columnName] = value.trim();
        }
      }
      
      // Check for mismatches between semifinals and finals
      const semifinalsPref = evalTypePreferences['Eval Type Semifinals'];
      const finalsPref = evalTypePreferences['Eval Type Finals'];
      
      if (semifinalsPref && finalsPref && semifinalsPref !== finalsPref) {
        warnings.push(`Row ${index + 2}: Group "${groupName}" has mismatched preferences - Semifinals: "${semifinalsPref}", Finals: "${finalsPref}"`);
      }
      
      // Find first non-blank preference by checking all columns in order
      let preferenceSet = false;
      for (const [columnName, value] of Object.entries(row)) {
        // Check if this column is an eval type column (including numbered duplicates)
        const isEvalTypeColumn = columnName.toLowerCase().includes('eval type');
        if (isEvalTypeColumn) {
          const prefValue = value?.trim();
          console.log(`  Checking column "${columnName}": "${prefValue}"`);
          
          if (prefValue && prefValue !== '' ) {
            console.log(`  Found preference value: "${prefValue}"`);
            // Map the preference values
            if (prefValue.includes('3x20')) {
              existingEntrant.preference = '3x20';
              console.log(`  Set preference to: "3x20"`);
            } else if (prefValue.includes('3x10')) {
              existingEntrant.preference = '3x10';
              console.log(`  Set preference to: "3x10"`);
            } else if (prefValue.includes('1xLong')) {
              existingEntrant.preference = '1xLong';
              console.log(`  Set preference to: "1xLong"`);
            } else if (prefValue.includes('None')) {
              existingEntrant.preference = 'None';
              console.log(`  Set preference to: "None"`);
            } else {
              console.log(`  Preference value "${prefValue}" did not match any known patterns`);
            }
            preferenceSet = true;
            break; // Take the first non-blank preference and ignore everything after
          }
        }
      }
      
      if (!preferenceSet) {
        console.log(`  No preference value found in eval type columns`);
      }

      // Process judge preferences (1st, 2nd, 3rd Choice)
      const processJudgePreference = (judgeNameWithCategory: string, preferenceNumber: number) => {
        if (!judgeNameWithCategory?.trim()) {
          return;
        }
        
        // Remove category in brackets at the end (e.g., "Judge Name (MUS)" -> "Judge Name")
        const judgeName = judgeNameWithCategory.replace(/\s*\([^)]*\)\s*$/, '').trim();
        
        // Convert the judge name from CSV to first initial + last name format
        const normalizedJudgeName = normalizeJudgeName(judgeName);
        
        // Try to find a matching judge using the normalized name
        let matchingJudge: Judge | undefined;
        
        // Strategy 1: Direct match with normalized name
        if (judgeMap.has(normalizedJudgeName.toLowerCase())) {
          matchingJudge = judgeMap.get(normalizedJudgeName.toLowerCase());
        }
        
        // Strategy 2: Fallback to exact match with original name
        if (!matchingJudge && judgeMap.has(judgeName.toLowerCase())) {
          matchingJudge = judgeMap.get(judgeName.toLowerCase());
        }
        
        if (matchingJudge) {
          if (preferenceNumber === 1) {
            existingEntrant.judgePreference1 = matchingJudge.id;
          } else if (preferenceNumber === 2) {
            existingEntrant.judgePreference2 = matchingJudge.id;
          } else if (preferenceNumber === 3) {
            existingEntrant.judgePreference3 = matchingJudge.id;
          }
        }
      };

      processJudgePreference(row['1st Choice'], 1);
      processJudgePreference(row['2nd Choice'], 2);
      processJudgePreference(row['3rd Choice'], 3);

      entrantsUpdated++;
      
      console.log(`  After: preference = "${existingEntrant.preference}"`);
      console.log(`  Final preferences:`, {
        preference: existingEntrant.preference,
        judgePreference1: existingEntrant.judgePreference1,
        judgePreference2: existingEntrant.judgePreference2,
        judgePreference3: existingEntrant.judgePreference3,
        groupsToAvoid: existingEntrant.groupsToAvoid
      });
      console.log('---');
    });

    console.log('PREFERENCES IMPORT: Final results:', {
      totalRows: rows.length,
      entrantsUpdated,
      entrantsNotFound,
      rowsSkipped,
      warnings: warnings.length
    });

    return {
      success: true,
      message: `Successfully updated ${entrantsUpdated} entrants. ${entrantsNotFound} not found.`,
      data: {
        entrantsUpdated,
        entrantsNotFound,
        rowsProcessed: rows.length,
        rowsSkipped
      },
      warnings: warnings.length > 0 ? warnings : undefined
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to import preferences: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
};
