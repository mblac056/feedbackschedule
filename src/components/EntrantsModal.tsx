import { useState, useEffect, useRef } from 'react';
import type { Entrant, Judge, SessionBlock } from '../types';
import { saveEntrants, reorderSessionBlocksByEntrants } from '../utils/localStorage';
import { reorderEntrantsByIds } from '../utils/entrantOrder';
import { buildBlocksAfterEntrantEdits } from '../utils/entrantSessionBlocks';
import { useEntrant } from '../contexts/useEntrant';
import CSVImport from './CSVImport';
import PreferencesImport from './PreferencesImport';
import EntrantRow from './EntrantRow';
import { useSettings } from '../contexts/useSettings';

interface EntrantsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onModalClose?: () => void;
  judges: Judge[];
  sessionBlocks: SessionBlock[];
  onSessionBlocksReplace: (blocks: SessionBlock[], options?: { resetHistory?: boolean }) => void;
}

type SortColumn = 'score' | 'name' | 'include' | 'overallSF' | 'overallF' | 'evalOnly';

export default function EntrantsModal({
  isOpen,
  onClose,
  onModalClose,
  judges,
  sessionBlocks,
  onSessionBlocksReplace,
}: EntrantsModalProps) {
  const { entrants: storedEntrants } = useEntrant();
  const [entrants, setEntrants] = useState<Entrant[]>(storedEntrants);
  const [draggedEntrantId, setDraggedEntrantId] = useState<string | null>(null);
  const [dragOverEntrantId, setDragOverEntrantId] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [showPreferencesImport, setShowPreferencesImport] = useState(false);
  const [originalEntrants, setOriginalEntrants] = useState<Entrant[]>([]);
  const [showConfirmClose, setShowConfirmClose] = useState(false);
  const [sortColumn, setSortColumn] = useState<SortColumn | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [groupFilter, setGroupFilter] = useState('All');
  const [movementPrompt, setMovementPrompt] = useState<'chorusToJudges' | 'quartetToGroups' | null>(null);
  const { settings, setSettings } = useSettings();
  

  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      setEntrants(storedEntrants);
      setOriginalEntrants(JSON.parse(JSON.stringify(storedEntrants)));
      setShowImport(false);
      setShowPreferencesImport(false);
      setShowConfirmClose(false);
      setSortColumn(null);
      setSortDirection('asc');
    }
    wasOpenRef.current = isOpen;
  }, [isOpen, storedEntrants]);

  const handleAddEntrant = () => {
    const newEntrant: Entrant = {
      id: Date.now().toString(),
      name: '',
      groupsToAvoid: [],
      preference: null,
      judgePreference1: '',
      judgePreference2: '',
      judgePreference3: '',
      includeInSchedule: false,
    };

    setEntrants(prev => [...prev, newEntrant]);
  };

  const handleRemove = (entrantId: string) => {
    setEntrants(prev => prev.filter(entrant => entrant.id !== entrantId));
  };

  const performSaveAndClose = () => {
    if (!saveEntrants(entrants)) return;

    onSessionBlocksReplace(buildBlocksAfterEntrantEdits(sessionBlocks, entrants), { resetHistory: true });

    setOriginalEntrants(JSON.parse(JSON.stringify(entrants)));
    onClose();
    onModalClose?.();
  };

  const handleSaveAndClose = () => {
    const selectedEntrants = entrants.filter(entrant => entrant.includeInSchedule);

    if (selectedEntrants.length > 0) {
      const chorusCount = selectedEntrants.filter(entrant => entrant.groupType === 'Chorus').length;
      const quartetCount = selectedEntrants.filter(entrant => entrant.groupType === 'Quartet').length;

      if (chorusCount > quartetCount && settings.moving === 'groups') {
        setMovementPrompt('chorusToJudges');
        return;
      }

      if (quartetCount > chorusCount && settings.moving === 'judges') {
        setMovementPrompt('quartetToGroups');
        return;
      }
    }

    performSaveAndClose();
  };

  const handleMovementPromptConfirm = () => {
    if (movementPrompt === 'chorusToJudges' && settings.moving !== 'judges') {
      setSettings({ ...settings, moving: 'judges' });
    } else if (movementPrompt === 'quartetToGroups' && settings.moving !== 'groups') {
      setSettings({ ...settings, moving: 'groups' });
    }

    setMovementPrompt(null);
    performSaveAndClose();
  };

  const handleMovementPromptDecline = () => {
    setMovementPrompt(null);
    performSaveAndClose();
  };

  const handleFieldUpdate = (entrantId: string, field: keyof Entrant, value: string | boolean | number | null | undefined | string[]) => {

      setEntrants(prev => prev.map(entrant =>
        entrant.id === entrantId
          ? { ...entrant, [field]: value }
          : entrant
      ));
  };


  // Drag and drop handlers for reordering entrants
  const handleDragStart = (e: React.DragEvent, entrantId: string) => {
    setDraggedEntrantId(entrantId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', entrantId);
  };

  const handleDragOver = (e: React.DragEvent, entrantId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggedEntrantId && draggedEntrantId !== entrantId) {
      setDragOverEntrantId(entrantId);
    }
  };

  const handleDragLeave = () => {
    setDragOverEntrantId(null);
  };

  const handleDrop = (e: React.DragEvent, targetEntrantId: string) => {
    e.preventDefault();
    if (!draggedEntrantId || draggedEntrantId === targetEntrantId) return;

    const reordered = reorderEntrantsByIds(entrants, draggedEntrantId, targetEntrantId);
    if (!reordered) return;

    setEntrants(reordered);
    if (saveEntrants(reordered)) {
      onSessionBlocksReplace(reorderSessionBlocksByEntrants(sessionBlocks, reordered));
    }

    setDraggedEntrantId(null);
    setDragOverEntrantId(null);
  };

  const handleDragEnd = () => {
    setDraggedEntrantId(null);
    setDragOverEntrantId(null);
  };

  const handleImportComplete = (importedEntrants: Entrant[]) => {
    // The CSVImport component already handles appending to existing entrants
    // So we just need to update the local state with the combined list
    setEntrants(importedEntrants);
    setShowImport(false);
  };

  const handlePreferencesImportComplete = (updatedEntrants: Entrant[]) => {
    // Save updated entrants to localStorage
    saveEntrants(updatedEntrants);
    // Refresh the entrants state
    setEntrants(updatedEntrants);
    // Update original to reflect saved state
    setOriginalEntrants(JSON.parse(JSON.stringify(updatedEntrants)));
  };

  // Check if there are unsaved changes
  const hasUnsavedChanges = () => {
    return JSON.stringify(entrants) !== JSON.stringify(originalEntrants);
  };

  const handleCloseWithoutSave = () => {
    setShowConfirmClose(false);
    onClose();
    if (onModalClose) {
      onModalClose();
    }
  };

  const handleCloseClick = () => {
    if (hasUnsavedChanges()) {
      setShowConfirmClose(true);
    } else {
      onClose();
      if (onModalClose) {
        onModalClose();
      }
    }
  };

  const reorderEntrantsByScore = (direction: 'asc' | 'desc') => {
    setEntrants(prevEntrants => {
      const sortedEntrants = [...prevEntrants].sort((a, b) => {
        const aScore = a.score ?? -Infinity;
        const bScore = b.score ?? -Infinity;

        if (aScore === bScore) {
          return 0;
        }

        return direction === 'asc' ? aScore - bScore : bScore - aScore;
      });

      saveEntrants(sortedEntrants);
      onSessionBlocksReplace(reorderSessionBlocksByEntrants(sessionBlocks, sortedEntrants));

      return sortedEntrants;
    });
  };


  // Helper function to check the status of checkbox
  const getEligibleEntrants = () => {
    return entrants.filter(entrant => {
      if (entrant.preference === 'None') return false;
      if (groupFilter === 'Chorus') return entrant.groupType === 'Chorus';
      if (groupFilter === 'Quartet') return entrant.groupType === 'Quartet';
      return true;
    });
  };

  const areAllChecked = () => {
    const eligibleEntrants = getEligibleEntrants();
    if (eligibleEntrants.length === 0) return false;
    return eligibleEntrants.every(entrant => entrant.includeInSchedule);
  };

  // Helper function to check all filtered entrants
  const onCheckboxUpdate = (value: boolean) => {
    setEntrants(prev =>
      prev.map(entrant => {
        const matchesFilter =
          groupFilter === 'All' ||
          (groupFilter === 'Chorus' && entrant.groupType === 'Chorus') ||
          (groupFilter === 'Quartet' && entrant.groupType === 'Quartet');

        if (!matchesFilter) {
          return value ? entrant : { ...entrant, includeInSchedule: false };
        }

        if (entrant.preference === 'None') {
          return { ...entrant, includeInSchedule: false };
        }

        return { ...entrant, includeInSchedule: value };
      })
    );
  };

  // Handle column header click for sorting
  const handleSort = (column: SortColumn) => {
    const isSameColumn = sortColumn === column;
    const newDirection = isSameColumn ? (sortDirection === 'asc' ? 'desc' : 'asc') : 'asc';

    setSortColumn(column);
    setSortDirection(newDirection);

    if (column === 'score') {
      reorderEntrantsByScore(newDirection);
    }
  };

  // Sort entrants based on current sort settings
  const getSortedEntrants = (): Entrant[] => {
    if (!sortColumn) {
      return entrants;
    }

    const sorted = [...entrants].sort((a, b) => {
      let aValue: string | number | boolean | undefined;
      let bValue: string | number | boolean | undefined;

      switch (sortColumn) {
        case 'score':
          aValue = a.score ?? -Infinity;
          bValue = b.score ?? -Infinity;
          break;
        case 'name':
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case 'include':
          aValue = a.includeInSchedule;
          bValue = b.includeInSchedule;
          break;
        case 'overallSF':
          aValue = a.overallSF ?? -Infinity; // Treat undefined as lowest
          bValue = b.overallSF ?? -Infinity;
          break;
        case 'overallF':
          aValue = a.overallF ?? -Infinity; // Treat undefined as lowest
          bValue = b.overallF ?? -Infinity;
          break;
        case 'evalOnly':
          aValue = a.evalOnly ?? false;
          bValue = b.evalOnly ?? false;
          break;
      }

      // Compare values
      let comparison = 0;
      if (aValue < bValue) {
        comparison = -1;
      } else if (aValue > bValue) {
        comparison = 1;
      }

      // Apply direction
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return sorted;
  };

  const sortedEntrants = getSortedEntrants();

  const visibleEntrants = sortedEntrants.filter(entrant => {
    if (groupFilter === 'All') return true;
    return entrant.groupType === groupFilter;
  });

  const eligibleVisibleEntrants = visibleEntrants.filter(entrant => entrant.preference !== 'None');
  const selectedVisibleCount = eligibleVisibleEntrants.filter(entrant => entrant.includeInSchedule).length;
  const totalVisibleEligible = eligibleVisibleEntrants.length;
  const judgesSortedByLastName = [...judges].sort((a, b) => {
    const aParts = a.name.trim().split(/\s+/);
    const bParts = b.name.trim().split(/\s+/);
    const aLastName = aParts[aParts.length - 1]?.toLowerCase() ?? '';
    const bLastName = bParts[bParts.length - 1]?.toLowerCase() ?? '';

    const lastNameComparison = aLastName.localeCompare(bLastName);
    if (lastNameComparison !== 0) return lastNameComparison;

    return a.name.localeCompare(b.name);
  });

  if (!isOpen) return null;

  return (
    <>
      {/* Confirmation Dialog */}
      {showConfirmClose && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[61] p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-md w-full border border-transparent dark:border-gray-700" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">Unsaved Changes</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Are you sure you want to close without saving? Your changes will be lost.
              </p>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setShowConfirmClose(false)}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-100 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCloseWithoutSave}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  Yes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {movementPrompt && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[62] p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-md w-full border border-transparent dark:border-gray-700" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                {movementPrompt === 'chorusToJudges' ? 'Switch to Judges Move?' : 'Switch to Groups Move?'}
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                {movementPrompt === 'chorusToJudges'
                  ? 'Most of the selected entrants are choruses. Switching to judges move can improve the flow of the schedule. Would you like to switch before saving?'
                  : 'Most of the selected entrants are quartets. Switching to groups move can improve the flow of the schedule. Would you like to switch before saving?'}
              </p>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={handleMovementPromptDecline}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-100 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                >
                  Keep Current
                </button>
                <button
                  onClick={handleMovementPromptConfirm}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Switch Movement
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60] p-4" onClick={handleCloseClick}>
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-h-[95vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="bg-gray-600 text-white p-6 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold">Manage Entrants</h2>
            <p className="text-green-100">Add, edit, and remove competition entrants</p>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={handleSaveAndClose}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 focus:ring-2 focus:ring-green-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 transition-colors"
            >
              Save & Close
            </button>
            <button
              onClick={handleCloseClick}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Close
            </button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto overflow-x-auto max-h-[calc(95vh-200px)]">
          <div className="flex justify-between items-center mb-6 text-gray-900 dark:text-gray-100">
            <h3 className="text-lg font-semibold">
              {selectedVisibleCount > 0
                ? `Selected Entrants (${selectedVisibleCount}/${totalVisibleEligible})`
                : `Entrants (${totalVisibleEligible})`}
            </h3>
            <h3 className="text-lg font-semibold">
              Entrants to Display:
              <select
                value={groupFilter}
                onChange={(e) => setGroupFilter(e.target.value)}
                className=" dark:bg-gray-900 mx-2 px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="All">All</option>
                <option value="Chorus">Choruses</option>
                <option value="Quartet">Quartets</option>
              </select>
            </h3>
            <div className="flex gap-2">
              {entrants.length > 0 && (
                <>
                  <button
                    onClick={() => setShowImport(true)}
                    className="px-4 py-2 bg-[var(--primary-color)] text-white rounded-lg hover:bg-[var(--primary-color-dark)] focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 transition-colors"
                  >
                    Import Entrants
                  </button>
                  <button
                    onClick={() => setShowPreferencesImport(true)}
                    disabled={judges.length === 0}
                    className={`px-4 py-2 rounded-lg focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-900 transition-colors ${
                      judges.length === 0
                        ? 'bg-gray-400 dark:bg-gray-700 text-gray-600 dark:text-gray-500 cursor-not-allowed'
                        : 'bg-[var(--primary-color)] text-white hover:bg-[var(--primary-color-dark)] focus:ring-[var(--primary-color)]'
                    }`}
                    title={judges.length === 0 ? 'No judges in the system yet' : ''}
                  >
                    Import Preferences
                  </button>
                </>
              )}
            <button
              onClick={handleAddEntrant}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors"
            >
              Add Entrant
            </button>
            </div>
          </div>

          {showImport ? (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-lg font-medium text-gray-800 dark:text-gray-100">Import Entrants from CSV</h4>
                <button
                  onClick={() => setShowImport(false)}
                  className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <CSVImport
                onEntrantsImportComplete={handleImportComplete}
                existingEntrants={entrants}
              />
            </div>
          ) : showPreferencesImport ? (
            <PreferencesImport
              entrants={entrants}
              judges={judges}
              onImportComplete={handlePreferencesImportComplete}
              onClose={() => setShowPreferencesImport(false)}
            />
          ) : entrants.length === 0 ? (
            <div className="max-w-md mx-auto">
              <CSVImport
                onEntrantsImportComplete={handleImportComplete}
                existingEntrants={entrants}
              />
            </div>
          ) : (
            <div>
              <table className="min-w-max bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg">
                <thead className="bg-gray-50 dark:bg-gray-800/80">
                  <tr>
                    <th
                      className={`px-2 py-1.5 min-w-[6rem] w-24 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b dark:border-gray-700 sticky left-0 bg-gray-50 dark:bg-gray-800 z-10 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 select-none ${
                        sortColumn === 'include' ? 'bg-gray-100 dark:bg-gray-700' : ''
                      }`}
                      onClick={() => handleSort('include')}
                    >
                      <div className="flex items-center space-x-1">

                      <input
                        type="checkbox"
                        checked={areAllChecked()}
                        onChange={(e) => onCheckboxUpdate(e.target.checked)}  
                        onClick={(e) => e.stopPropagation()}
                        className="rounded border-gray-300 dark:border-gray-600 dark:bg-gray-950 text-blue-600 focus:ring-blue-500"
                        />

                        <span>Include</span>
                        {sortColumn === 'include' && (
                          <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </div>
                    </th>

                    <th
                      className={`px-2 py-1.5 min-w-[12rem] text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b dark:border-gray-700 sticky left-24 bg-gray-50 dark:bg-gray-800 z-10 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 select-none ${
                        sortColumn === 'name' ? 'bg-gray-100 dark:bg-gray-700' : ''
                      }`}
                      onClick={() => handleSort('name')}
                    >
                      <div className="flex items-center space-x-1">
                        <span>Name</span>
                        {sortColumn === 'name' && (
                          <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </div>
                    </th>
                    <th className="px-2 py-1.5 min-w-[6rem] text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b dark:border-gray-700">Group Type</th>
                    <th
                      className={`px-2 py-1.5 w-24 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b dark:border-gray-700 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 select-none ${
                        sortColumn === 'score' ? 'bg-gray-100 dark:bg-gray-700' : ''
                      }`}
                      onClick={() => handleSort('score')}
                    >
                      <div className="flex items-center space-x-1">
                        <span>Score</span>
                        {sortColumn === 'score' && (
                          <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </div>
                    </th>
                    <th className="px-2 py-1.5 min-w-[14rem] text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b dark:border-gray-700">Groups to Avoid</th>
                    <th className="px-2 py-1.5 w-26 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b dark:border-gray-700">Preference</th>
                    <th className="px-2 py-1.5 w-36 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b dark:border-gray-700">Judge 1</th>
                    <th className="px-2 py-1.5 w-36 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b dark:border-gray-700">Judge 2</th>
                    <th className="px-2 py-1.5 w-36 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b dark:border-gray-700">Judge 3</th>
                    <th
                      className={`px-2 py-1.5 w-28 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b dark:border-gray-700 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 select-none ${
                        sortColumn === 'evalOnly' ? 'bg-gray-100 dark:bg-gray-700' : ''
                      }`}
                      onClick={() => handleSort('evalOnly')}
                    >
                      <div className="flex items-center space-x-1">
                        <span>Eval Only</span>
                        {sortColumn === 'evalOnly' && (
                          <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </div>
                    </th>
                    <th className="px-2 py-1.5 w-36 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b dark:border-gray-700">Room</th>
                    <th className="px-2 py-1.5 w-32 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b dark:border-gray-700">Performers</th>

                    <th
                      className={`px-2 py-1.5 w-24 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b dark:border-gray-700 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 select-none ${
                        sortColumn === 'overallSF' ? 'bg-gray-100 dark:bg-gray-700' : ''
                      }`}
                      onClick={() => handleSort('overallSF')}
                    >
                      <div className="flex items-center space-x-1">
                        <span>O/A Semi-Final</span>
                        {sortColumn === 'overallSF' && (
                          <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </div>
                    </th>
                    <th
                      className={`px-2 py-1.5 w-24 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b dark:border-gray-700 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 select-none ${
                        sortColumn === 'overallF' ? 'bg-gray-100 dark:bg-gray-700' : ''
                      }`}
                      onClick={() => handleSort('overallF')}
                    >
                      <div className="flex items-center space-x-1">
                        <span>O/A Final</span>
                        {sortColumn === 'overallF' && (
                          <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </div>
                    </th>
                    <th className="px-2 py-1.5 w-10 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b dark:border-gray-700"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {visibleEntrants.map((entrant) => (
                      <EntrantRow
                        key={entrant.id}
                        entrant={entrant}
                        judges={judgesSortedByLastName}
                        allEntrants={entrants}
                        draggedEntrantId={draggedEntrantId}
                        dragOverEntrantId={dragOverEntrantId}
                        onFieldUpdate={handleFieldUpdate}
                        onRemove={handleRemove}
                        onDragStart={handleDragStart}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        onDragEnd={handleDragEnd}
                      />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
    </>
  );
}
