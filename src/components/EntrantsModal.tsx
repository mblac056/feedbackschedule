import { useState, useEffect } from 'react';
import type { Entrant, Judge } from '../types';
import { getEntrants, getJudges, saveEntrants, getSessionBlocks, saveSessionBlocks, reorderSessionBlocksByEntrants } from '../utils/localStorage';
import { SessionService } from '../services/SessionService';
import CSVImport from './CSVImport';
import PreferencesImport from './PreferencesImport';
import EntrantRow from './EntrantRow';

interface SessionConflict {
  entrantId: string;
  entrantName: string;
  conflictingGroup: string;
  conflictingEntrantId: string;
  conflictingEntrantName: string;
  timeSlot: string;
}

interface EntrantsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onModalClose?: () => void;
  onSessionBlocksChange?: () => void;
  scheduleConflicts?: SessionConflict[];
}

export default function EntrantsModal({ isOpen, onClose, onModalClose, onSessionBlocksChange, scheduleConflicts = [] }: EntrantsModalProps) {
  const [entrants, setEntrants] = useState<Entrant[]>([]);
  const [judges, setJudges] = useState<Judge[]>([]);
  const [draggedEntrantId, setDraggedEntrantId] = useState<string | null>(null);
  const [dragOverEntrantId, setDragOverEntrantId] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [showPreferencesImport, setShowPreferencesImport] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const storedEntrants = getEntrants();
      const storedJudges = getJudges();
      setEntrants(storedEntrants);
      setJudges(storedJudges);
      setShowImport(false); // Reset import state when modal opens
      setShowPreferencesImport(false); // Reset preferences import state when modal opens
      
    }
  }, [isOpen]);

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

  const handleClose = () => {
    // Get current session blocks
    const currentSessionBlocks = getSessionBlocks();
    let updatedSessionBlocks = [...currentSessionBlocks];
    
    // Process each entrant
    entrants.forEach(entrant => {
      if (entrant.includeInSchedule) {
        // Check if this entrant already has session blocks
        const existingBlocks = currentSessionBlocks.filter(block => block.entrantId === entrant.id);
        
        if (existingBlocks.length === 0) {
          // Create new session blocks for this entrant using SessionService
          const newSessionBlocks = SessionService.generateSessionBlocks([entrant]);
          updatedSessionBlocks.push(...newSessionBlocks);
        }
      } else {
        // Remove all session blocks for this entrant
        updatedSessionBlocks = updatedSessionBlocks.filter(block => block.entrantId !== entrant.id);
      }
    });
    
    // Save updated session blocks
    saveSessionBlocks(updatedSessionBlocks);
    
    // Save all local changes to localStorage before closing
    saveEntrants(entrants);
    
    // Notify parent component that session blocks may have changed
    if (onSessionBlocksChange) {
      onSessionBlocksChange();
    }
    
    onClose();
    // Notify parent component that modal has closed
    if (onModalClose) {
      onModalClose();
    }
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

    const draggedIndex = entrants.findIndex(e => e.id === draggedEntrantId);
    const targetIndex = entrants.findIndex(e => e.id === targetEntrantId);
    
    if (draggedIndex === -1 || targetIndex === -1) return;

    const newEntrants = [...entrants];
    const [draggedEntrant] = newEntrants.splice(draggedIndex, 1);
    newEntrants.splice(targetIndex, 0, draggedEntrant);

    setEntrants(newEntrants);
    
    // Save the reordered entrants to localStorage
    saveEntrants(newEntrants);
    
    // Get current session blocks and reorder them based on new entrant order
    const currentSessionBlocks = getSessionBlocks();
    const reorderedSessionBlocks = reorderSessionBlocksByEntrants(currentSessionBlocks, newEntrants);
    
    // Save reordered session blocks to localStorage
    saveSessionBlocks(reorderedSessionBlocks);
    
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
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-h-[90vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="bg-gray-600 text-white p-6 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold">Manage Entrants</h2>
            <p className="text-green-100">Add, edit, and remove competition entrants</p>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={handleClose}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors"
            >
              Save & Close
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
        
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-semibold text-gray-800">
              Entrants ({entrants.filter(e => e.includeInSchedule).length > 0 
                ? `${entrants.filter(e => e.includeInSchedule).length}/${entrants.length}` 
                : entrants.length})
            </h3>
            <div className="flex gap-2">
              {entrants.length > 0 && (
                <>
                  <button
                    onClick={() => setShowImport(true)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
                  >
                    Import Entrants
                  </button>
                  <button
                    onClick={() => setShowPreferencesImport(true)}
                    disabled={judges.length === 0}
                    className={`px-4 py-2 rounded-lg focus:ring-2 focus:ring-offset-2 transition-colors ${
                      judges.length === 0 
                        ? 'bg-gray-400 text-gray-600 cursor-not-allowed' 
                        : 'bg-purple-600 text-white hover:bg-purple-700 focus:ring-purple-500'
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
                <h4 className="text-lg font-medium text-gray-800">Import Entrants from CSV</h4>
                <button
                  onClick={() => setShowImport(false)}
                  className="text-gray-500 hover:text-gray-700"
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
            <div className="overflow-x-auto">
              <table className="min-w-full bg-white border border-gray-200 rounded-lg">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b sticky left-0 bg-gray-50 z-10">
                      
                    </th>
                     <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b sticky left-[60px] bg-gray-50 z-10 w-48">Name</th>
                    <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">Groups to Avoid</th>
                    <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">Preference</th>
                    <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">Judge 1</th>
                    <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">Judge 2</th>
                    <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">Judge 3</th>
                    <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">Room</th>
                    <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">O/A SF</th>
                    <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">O/A F</th>
                    <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {entrants.map((entrant) => (
                    <EntrantRow
                      key={entrant.id}
                      entrant={entrant}
                      judges={judges}
                      allEntrants={entrants}
                      draggedEntrantId={draggedEntrantId}
                      dragOverEntrantId={dragOverEntrantId}
                      scheduleConflicts={scheduleConflicts}
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
  );
}
