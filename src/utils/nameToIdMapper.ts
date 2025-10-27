import type { Entrant } from '../types';

/**
 * Utility class for robust name-to-ID mapping during CSV imports
 * Handles both existing entrants and entrants being imported in the same batch
 */
export class NameToIdMapper {
  private nameToIdMap = new Map<string, string>();
  private idToEntrantMap = new Map<string, Entrant>();

  constructor(existingEntrants: Entrant[] = [], newEntrants: Entrant[] = []) {
    // Build maps from existing entrants
    existingEntrants.forEach(entrant => {
      this.addEntrant(entrant);
    });

    // Build maps from new entrants (being imported)
    newEntrants.forEach(entrant => {
      this.addEntrant(entrant);
    });
  }

  /**
   * Add an entrant to the mapping
   */
  private addEntrant(entrant: Entrant): void {
    const normalizedName = entrant.name.toLowerCase().trim();
    this.nameToIdMap.set(normalizedName, entrant.id);
    this.idToEntrantMap.set(entrant.id, entrant);
  }

  /**
   * Find an entrant ID by name (case-insensitive)
   * Returns the ID if found, undefined otherwise
   */
  findIdByName(name: string): string | undefined {
    if (!name) return undefined;
    const normalizedName = name.toLowerCase().trim();
    return this.nameToIdMap.get(normalizedName);
  }

  /**
   * Find an entrant by name (case-insensitive)
   * Returns the entrant if found, undefined otherwise
   */
  findEntrantByName(name: string): Entrant | undefined {
    const id = this.findIdByName(name);
    return id ? this.idToEntrantMap.get(id) : undefined;
  }

  /**
   * Get all entrant names (for debugging/logging)
   */
  getAllNames(): string[] {
    return Array.from(this.nameToIdMap.keys());
  }

  /**
   * Check if a name exists in the mapping
   */
  hasName(name: string): boolean {
    return this.findIdByName(name) !== undefined;
  }

  /**
   * Resolve multiple names to IDs
   * Returns an array of IDs for names that were found
   */
  resolveNamesToIds(names: string[]): string[] {
    const ids: string[] = [];
    names.forEach(name => {
      const id = this.findIdByName(name);
      if (id) {
        ids.push(id);
      }
    });
    return ids;
  }

  /**
   * Get statistics about the mapping (for debugging)
   */
  getStats(): { totalNames: number; totalIds: number } {
    return {
      totalNames: this.nameToIdMap.size,
      totalIds: this.idToEntrantMap.size
    };
  }
}

/**
 * Helper function to create a NameToIdMapper for CSV imports
 * @param existingEntrants - Entrants already in the system
 * @param newEntrants - Entrants being imported in this batch
 * @returns NameToIdMapper instance
 */
export function createNameToIdMapper(existingEntrants: Entrant[], newEntrants: Entrant[] = []): NameToIdMapper {
  return new NameToIdMapper(existingEntrants, newEntrants);
}

/**
 * Enhanced helper for complex import scenarios
 * Creates a mapper that can handle cross-references between existing and new entrants
 * @param existingEntrants - Entrants already in the system
 * @param newEntrants - Entrants being imported in this batch
 * @param additionalEntrants - Additional entrants to consider (e.g., from other import batches)
 * @returns NameToIdMapper instance
 */
export function createEnhancedNameToIdMapper(
  existingEntrants: Entrant[], 
  newEntrants: Entrant[] = [], 
  additionalEntrants: Entrant[] = []
): NameToIdMapper {
  const allEntrants = [...existingEntrants, ...newEntrants, ...additionalEntrants];
  return new NameToIdMapper([], allEntrants);
}
