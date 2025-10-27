import { useState, useEffect } from 'react';
import type { Entrant, Judge, EntrantJudgeAssignments, SessionBlock } from '../types';
import { getEntrants, saveEntrants, getSessionBlocks, saveSessionBlocks, reorderSessionBlocksByEntrants } from '../utils/localStorage';
import { useEntrant } from '../contexts/useEntrant.ts';
import { getCategoryColor } from '../config/categoryConfig';


interface PreferencesPanelProps {
  judges: Judge[];
  refreshKey?: string;
  entrantJudgeAssignments?: EntrantJudgeAssignments;
  allSessionBlocks?: SessionBlock[];
  scheduleConflicts?: Array<{
    entrantId: string;
    entrantName: string;
    conflictingGroup: string;
    conflictingEntrantId: string;
    conflictingEntrantName: string;
    timeSlot: string;
  }>;
  onSessionBlocksChange?: () => void; // Callback to notify parent that session blocks have changed
}



export default function PreferencesPanel({ judges, refreshKey, entrantJudgeAssignments, allSessionBlocks, scheduleConflicts, onSessionBlocksChange }: PreferencesPanelProps) {
  const [entrants, setEntrants] = useState<Entrant[]>([]);
  const [includedEntrants, setIncludedEntrants] = useState<Entrant[]>([]);
  const [draggedEntrantId, setDraggedEntrantId] = useState<string | null>(null);
  const [dragOverEntrantId, setDragOverEntrantId] = useState<string | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const { selectedEntrant } = useEntrant();

  useEffect(() => {
    const storedEntrants = getEntrants();
    setEntrants(storedEntrants);
    
    // Filter included entrants and maintain array order
    const included = storedEntrants.filter(e => e.includeInSchedule);
    setIncludedEntrants(included);
  }, []);

  // Update included entrants when entrants change
  useEffect(() => {
    const included = entrants.filter(e => e.includeInSchedule);
    setIncludedEntrants(included);
  }, [entrants]);

  // Refresh entrants when refreshKey changes (modal closes)
  useEffect(() => {
    if (refreshKey === 'closed') {
      const storedEntrants = getEntrants();
      setEntrants(storedEntrants);
    }
  }, [refreshKey]);


  // Add keyboard shortcut for toggling preferences panel
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === 'p') {
        setIsPanelOpen(prev => !prev);
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    
    return () => {
      document.removeEventListener('keydown', handleKeyPress);
    };
  }, []);

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

    const draggedIndex = includedEntrants.findIndex(e => e.id === draggedEntrantId);
    const targetIndex = includedEntrants.findIndex(e => e.id === targetEntrantId);
    
    if (draggedIndex === -1 || targetIndex === -1) return;

    // Get all entrants and reorder them
    const allEntrants = getEntrants();
    const draggedEntrant = allEntrants.find(e => e.id === draggedEntrantId);
    const targetEntrant = allEntrants.find(e => e.id === targetEntrantId);
    
    if (!draggedEntrant || !targetEntrant) return;

    const draggedAllIndex = allEntrants.findIndex(e => e.id === draggedEntrantId);
    const targetAllIndex = allEntrants.findIndex(e => e.id === targetEntrantId);
    
    const newAllEntrants = [...allEntrants];
    const [movedEntrant] = newAllEntrants.splice(draggedAllIndex, 1);
    newAllEntrants.splice(targetAllIndex, 0, movedEntrant);

    // Update localStorage with new entrant order
    saveEntrants(newAllEntrants);

    // Get current session blocks and reorder them based on new entrant order
    const currentSessionBlocks = getSessionBlocks();
    const reorderedSessionBlocks = reorderSessionBlocksByEntrants(currentSessionBlocks, newAllEntrants);
    
    // Save reordered session blocks to localStorage
    saveSessionBlocks(reorderedSessionBlocks);

    // Update local state
    setEntrants(newAllEntrants);
    setIncludedEntrants(newAllEntrants.filter(e => e.includeInSchedule));
    
    // Notify parent component that session blocks have changed
    if (onSessionBlocksChange) {
      onSessionBlocksChange();
    }
    
    setDraggedEntrantId(null);
    setDragOverEntrantId(null);
  };

  const handleDragEnd = () => {
    setDraggedEntrantId(null);
    setDragOverEntrantId(null);
  };

  // Helper function to check if a group has conflicts for a specific entrant
  const hasGroupConflict = (entrantId: string, groupId: string): boolean => {
    if (!scheduleConflicts) return false;
    return scheduleConflicts.some(conflict => 
      conflict.entrantId === entrantId && conflict.conflictingEntrantId === groupId
    );
  };

  // Function to count different types of pills
  const getPillCounts = () => {
    let greenCount = 0;
    let redCount = 0;
    let grayCount = 0;

    includedEntrants.forEach(entrant => {
      // Count group pills
      if (entrant.groupsToAvoid && Array.isArray(entrant.groupsToAvoid) && entrant.groupsToAvoid.length > 0) {
        entrant.groupsToAvoid.forEach(groupId => {
          if (hasGroupConflict(entrant.id, groupId)) {
            redCount++;
          } else {
            greenCount++;
          }
        });
      }

      // Count preference pills
      if (entrant.preference) {
        // Check if any session blocks (scheduled or unscheduled) match their preference
        const entrantSessionBlocks = allSessionBlocks?.filter(block => block.entrantId === entrant.id) || [];
        const hasMatchingSessionType = entrantSessionBlocks.some(block => block.type === entrant.preference);
        
        if (hasMatchingSessionType) {
          greenCount++;
        } else {
          redCount++;
        }
      }

      // Count judge preference pills
      [entrant.judgePreference1, entrant.judgePreference2, entrant.judgePreference3].forEach(judgeId => {
        if (judgeId && judges.find(j => j.id === judgeId)) {
          if (entrantJudgeAssignments?.[entrant.id]?.includes(judgeId)) {
            greenCount++;
          } else {
            grayCount++;
          }
        }
      });
    });

    return { greenCount, redCount, grayCount };
  };

  const pillCounts = getPillCounts();

  const togglePanel = () => {
    setIsPanelOpen(!isPanelOpen);
  };

  if (includedEntrants.length === 0) {
    return (
      <>
        {/* Flyout Toggle Tab */}
        <button
          onClick={togglePanel}
          className={`fixed right-0 top-1/2 w-8 transform -translate-y-1/2 z-40 bg-blue-600 hover:bg-blue-700 text-white px-2 py-6 rounded-l-lg shadow-lg transition-all duration-300 ease-in-out`}
          aria-label="Toggle preference panel"
        >
          <div className="flyout-toggle-tab whitespace-nowrap">
          <span className="font-bold text-xs">P</span>
          </div>
        </button>

        {/* Flyout Side Panel */}
        <div 
          className={`fixed right-0 top-0 h-full w-full max-w-6xl md:w-auto md:max-w-6xl bg-white shadow-2xl transform transition-transform duration-300 ease-in-out z-41 ${
            isPanelOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          <div className="h-full flex flex-col">
            {/* Panel Header */}
            <div className="bg-[var(--primary-color)] text-white px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Evaluation Preferences</h2>
              <button
                onClick={togglePanel}
                className="text-white hover:text-blue-200 transition-colors"
                aria-label="Close preference panel"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {/* Panel Content */}
            <div className="flex-1 overflow-y-auto p-6 flyout-panel">
              <div className="text-center text-gray-500 py-8">
                <p>No entrants included in schedule yet.</p>
                <p className="text-sm mt-2">Check the "Include" checkbox for entrants in the Manage Entrants modal.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Dark overlay - only show when panel is open */}
        {isPanelOpen && (
          <div 
            className="fixed inset-0 bg-black/70 z-40 transition-opacity duration-300"
            onClick={togglePanel}
            aria-label="Close preference panel"
          />
        )}
      </>
    );
  }

  return (
    <>
      {/* Flyout Toggle Tab */}
        <button
          onClick={togglePanel}
          className={`border border-gray-800 w-12 border-2 border-r-0 fixed right-0 top-1/3 transform -translate-y-1/2 z-40 bg-white hover:bg-grey-300 text-white px-2 py-6 rounded-l-lg shadow-lg transition-all duration-300 ease-in-out`}
          aria-label="Toggle preference panel"
        >
        <div className="flyout-toggle-tab whitespace-nowrap text-gray-600">
          <div className="text-xs flex flex-col gap-1">
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 bg-green-400 rounded-full"></span>
              <span className="text-xs">{pillCounts.greenCount}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 bg-red-400 rounded-full"></span>
              <span className="text-xs">{pillCounts.redCount}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 bg-gray-400 rounded-full"></span>
              <span className="text-xs">{pillCounts.grayCount}</span>
            </div>
          </div>
        </div>
      </button>

      {/* Flyout Side Panel */}
      <div 
        className={`fixed right-0 top-0 h-full w-full max-w-6xl md:w-auto md:max-w-6xl bg-white shadow-2xl transform transition-transform duration-300 ease-in-out z-41 ${
          isPanelOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="h-full flex flex-col">
          {/* Panel Header */}
          <div className="bg-[var(--primary-color)] text-white px-6 py-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Evaluation Preferences</h2>
            <button
              onClick={togglePanel}
              className="text-white hover:text-blue-200 transition-colors"
              aria-label="Close preference panel"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          {/* Panel Content */}
          <div className="flex-1 overflow-y-auto overflow-x-auto p-6 flyout-panel">
            <div className="space-y-4 min-w-max">
              {/* Pill Count Summary */}
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Summary</h3>
                <div className="flex flex-wrap gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 bg-green-200 rounded-full"></span>
                    <span className="text-green-800 font-medium">{pillCounts.greenCount}</span>
                    <span className="text-gray-600">Good/Assigned</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 bg-red-200 rounded-full"></span>
                    <span className="text-red-800 font-medium">{pillCounts.redCount}</span>
                    <span className="text-gray-600">Conflicts</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 bg-gray-200 rounded-full"></span>
                    <span className="text-gray-800 font-medium">{pillCounts.grayCount}</span>
                    <span className="text-gray-600">Unassigned/Mismatched</span>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full bg-white border border-gray-200 rounded-lg" style={{ minWidth: '800px' }}>
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                        #
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                        Name
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                        Groups to Avoid
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                        Preference
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                        Judge 1
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                        Judge 2
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                        Judge 3
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {includedEntrants.map((entrant, index) => (
                      <tr 
                        key={entrant.id} 
                        className={`transition-all duration-200 ${
                          draggedEntrantId === entrant.id ? 'opacity-50 scale-95' : ''
                        } ${
                          dragOverEntrantId === entrant.id ? 'ring-2 ring-blue-500 ring-opacity-50' : ''
                        } ${
                          selectedEntrant === entrant.id ? 'bg-[var(--primary-color)] text-white' : 'text-gray-600'
                        }`}
                        draggable
                        onDragStart={(e) => handleDragStart(e, entrant.id)}
                        onDragOver={(e) => handleDragOver(e, entrant.id)}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDrop(e, entrant.id)}
                        onDragEnd={handleDragEnd}
                      >
                        <td className="px-3 py-2 border-b text-sm cursor-move">
                          {index + 1}
                        </td>
                        <td className="px-3 py-2 border-b">
                          <span className="font-medium text-sm">{entrant.name}</span>
                        </td>
                        <td className="px-3 py-2 border-b">
                          {entrant.groupsToAvoid && Array.isArray(entrant.groupsToAvoid) && entrant.groupsToAvoid.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {entrant.groupsToAvoid.map((groupId, groupIndex) => {
                                const groupEntrant = entrants.find(e => e.id === groupId);
                                const groupName = groupEntrant?.name || 'Unknown Group';
                                return (
                                  <span
                                    key={groupIndex}
                                    className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs ${
                                      hasGroupConflict(entrant.id, groupId)
                                        ? 'bg-red-200 text-red-800'
                                        : 'bg-green-200 text-green-800'
                                    }`}
                                  >
                                    {groupName}
                                  </span>
                                );
                              })}
                            </div>
                          )}
                        </td>
                    
                        <td className="px-3 py-2 border-b">
                            {entrant.preference && (
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs ${
                            (() => {
                              // Check if any session blocks (scheduled or unscheduled) match their preference
                              const entrantSessionBlocks = allSessionBlocks?.filter(block => block.entrantId === entrant.id) || [];
                              const hasMatchingSessionType = entrantSessionBlocks.some(block => block.type === entrant.preference);
                              return hasMatchingSessionType ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800';
                            })()
                          }`}>
                            {entrant.preference}
                          </span>
                          )}
                        </td>
                        <td className="px-3 py-2 border-b">
                          {judges.find(j => j.id === entrant.judgePreference1) && (
                          <span className={`text-xs px-1.5 py-0.5 rounded-full flex items-center gap-1 ${
                            entrantJudgeAssignments?.[entrant.id]?.includes(entrant.judgePreference1)
                              ? 'bg-green-200 text-green-800'
                              : 'bg-gray-200 text-gray-600'
                          }`}>
                            {(() => {
                              const judge = judges.find(j => j.id === entrant.judgePreference1);
                              return judge?.category ? (
                                <span 
                                  className="w-2 h-2 rounded-full"
                                  style={{ backgroundColor: getCategoryColor(judge.category) }}
                                />
                              ) : null;
                            })()}
                            {judges.find(j => j.id === entrant.judgePreference1)?.name}
                          </span>
                          )}
                        </td>
                        <td className="px-3 py-2 border-b">
                          {judges.find(j => j.id === entrant.judgePreference2) && (
                          <span className={`text-xs px-1.5 py-0.5 rounded-full flex items-center gap-1 ${
                            entrantJudgeAssignments?.[entrant.id]?.includes(entrant.judgePreference2)
                              ? 'bg-green-200 text-green-800'
                              : 'bg-gray-200 text-gray-600'
                          }`}>
                            {(() => {
                              const judge = judges.find(j => j.id === entrant.judgePreference2);
                              return judge?.category ? (
                                <span 
                                  className="w-2 h-2 rounded-full"
                                  style={{ backgroundColor: getCategoryColor(judge.category) }}
                                />
                              ) : null;
                            })()}
                            {judges.find(j => j.id === entrant.judgePreference2)?.name}
                          </span>
                          )}
                        </td>
                        <td className="px-3 py-2 border-b">
                        {judges.find(j => j.id === entrant.judgePreference3) && (
                          <span className={`text-xs px-1.5 py-0.5 rounded-full flex items-center gap-1 ${
                            entrantJudgeAssignments?.[entrant.id]?.includes(entrant.judgePreference3)
                              ? 'bg-green-200 text-green-800'
                              : 'bg-gray-200 text-gray-600'
                          }`}>
                            {(() => {
                              const judge = judges.find(j => j.id === entrant.judgePreference3);
                              return judge?.category ? (
                                <span 
                                  className="w-2 h-2 rounded-full"
                                  style={{ backgroundColor: getCategoryColor(judge.category) }}
                                />
                              ) : null;
                            })()}
                            {judges.find(j => j.id === entrant.judgePreference3)?.name}
                          </span>
                        )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-gray-600 text-xs text-center">Drag rows to reorder entrants to more easily visualize preferences by group priority</p>
              <div className="flex justify-center">
              <p className="text-gray-600 text-xs text-center bg-yellow-100 p-2 rounded-lg">Tip: Toggle this panel using the "P" key.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Dark overlay - only show when panel is open */}
      {isPanelOpen && (
        <div 
          className="fixed inset-0 bg-black/70 z-40 transition-opacity duration-300"
          onClick={togglePanel}
          aria-label="Close preference panel"
        />
      )}
    </>
  );
}
