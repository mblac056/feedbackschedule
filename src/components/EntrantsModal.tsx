import { useState, useEffect } from 'react';
import type { Entrant, Judge, SessionBlock } from '../types';
import { getEntrants, getJudges, saveEntrants, getSessionBlocks, saveSessionBlocks } from '../utils/localStorage';
import { FaTrash } from 'react-icons/fa';

interface EntrantsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onModalClose?: () => void;
  onSessionBlocksChange?: () => void;
}

export default function EntrantsModal({ isOpen, onClose, onModalClose, onSessionBlocksChange }: EntrantsModalProps) {
  const [entrants, setEntrants] = useState<Entrant[]>([]);
  const [judges, setJudges] = useState<Judge[]>([]);
  const [groupsInputs, setGroupsInputs] = useState<{ [key: string]: string }>({});
  const [draggedEntrantId, setDraggedEntrantId] = useState<string | null>(null);
  const [dragOverEntrantId, setDragOverEntrantId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      const storedEntrants = getEntrants();
      const storedJudges = getJudges();
      setEntrants(storedEntrants);
      setJudges(storedJudges);
      
      // Initialize groups inputs
      const initialGroupsInputs: { [key: string]: string } = {};
      storedEntrants.forEach(entrant => {
        initialGroupsInputs[entrant.id] = '';
      });
      setGroupsInputs(initialGroupsInputs);
    }
  }, [isOpen]);

  const handleAddEntrant = () => {
    const newEntrant: Entrant = {
      id: Date.now().toString(),
      name: '',
      groupsToAvoid: '',
      preference: null,
      judgePreference1: '',
      judgePreference2: '',
      judgePreference3: '',
      includeInSchedule: false,
    };
    
    setEntrants(prev => [...prev, newEntrant]);
    setGroupsInputs(prev => ({ ...prev, [newEntrant.id]: '' }));
  };

  const handleRemove = (entrantId: string) => {
    setEntrants(prev => prev.filter(entrant => entrant.id !== entrantId));
    setGroupsInputs(prev => {
      const newInputs = { ...prev };
      delete newInputs[entrantId];
      return newInputs;
    });
  };

  const createSessionBlocksForEntrant = (entrant: Entrant): SessionBlock[] => {
    const sessionBlocks: SessionBlock[] = [];
    const sessionType = entrant.preference || '3x20';
    
    if (sessionType === '1xLong') {
      sessionBlocks.push({
        id: `${entrant.id}-1xlong`,
        entrantId: entrant.id,
        entrantName: entrant.name,
        type: '1xLong',
        isScheduled: false
      });
    } else if (sessionType === '3x20') {
      for (let i = 0; i < 3; i++) {
        sessionBlocks.push({
          id: `${entrant.id}-3x20-${i}`,
          entrantId: entrant.id,
          entrantName: entrant.name,
          type: '3x20',
          sessionIndex: i,
          isScheduled: false
        });
      }
    } else if (sessionType === '3x10') {
      for (let i = 0; i < 3; i++) {
        sessionBlocks.push({
          id: `${entrant.id}-3x10-${i}`,
          entrantId: entrant.id,
          entrantName: entrant.name,
          type: '3x10',
          sessionIndex: i,
          isScheduled: false
        });
      }
    }
    
    return sessionBlocks;
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
          // Create new session blocks for this entrant
          const newSessionBlocks = createSessionBlocksForEntrant(entrant);
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

  const handleFieldUpdate = (entrantId: string, field: keyof Entrant, value: string | boolean | number | null | undefined) => {

      setEntrants(prev => prev.map(entrant => 
        entrant.id === entrantId 
          ? { ...entrant, [field]: value }
          : entrant
      ));
  };

  const handleGroupsInputChange = (entrantId: string, value: string) => {
    setGroupsInputs(prev => ({ ...prev, [entrantId]: value }));
  };

  const handleGroupsInputKeyDown = (entrantId: string, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && groupsInputs[entrantId].trim()) {
      const currentGroups = entrants.find(e => e.id === entrantId)?.groupsToAvoid || '';
      const newGroup = groupsInputs[entrantId].trim();
      
      if (newGroup && !currentGroups.includes(newGroup)) {
        // Add to current entrant
        const updatedGroups = currentGroups ? `${currentGroups} | ${newGroup}` : newGroup;
        handleFieldUpdate(entrantId, 'groupsToAvoid', updatedGroups);
        
        // Find the other entrant by name (the one being avoided) and add this entrant to their avoidance list
        const otherEntrant = entrants.find(entrant => entrant.name === newGroup);
        if (otherEntrant && otherEntrant.id !== entrantId) {
          const otherGroups = otherEntrant.groupsToAvoid || '';
          const currentEntrantName = entrants.find(e => e.id === entrantId)?.name || '';
          if (currentEntrantName && !otherGroups.includes(currentEntrantName)) {
            const updatedOtherGroups = otherGroups ? `${otherGroups} | ${currentEntrantName}` : currentEntrantName;
            handleFieldUpdate(otherEntrant.id, 'groupsToAvoid', updatedOtherGroups);
          }
        }
        
        setGroupsInputs(prev => ({ ...prev, [entrantId]: '' }));
      }
    }
  };

  const removeGroup = (entrantId: string, groupToRemove: string) => {
    const currentGroups = entrants.find(e => e.id === entrantId)?.groupsToAvoid || '';
    const updatedGroups = currentGroups
      .split(' | ')
      .filter(group => group !== groupToRemove)
      .join(' | ');
    handleFieldUpdate(entrantId, 'groupsToAvoid', updatedGroups);
    
    // Also remove the current entrant's name from the other entrant's avoidance list
    const otherEntrant = entrants.find(entrant => entrant.name === groupToRemove);
    if (otherEntrant && otherEntrant.id !== entrantId) {
      const otherGroups = otherEntrant.groupsToAvoid || '';
      const currentEntrantName = entrants.find(e => e.id === entrantId)?.name || '';
      if (currentEntrantName) {
        const updatedOtherGroups = otherGroups
          .split(' | ')
          .filter(group => group !== currentEntrantName)
          .join(' | ');
        handleFieldUpdate(otherEntrant.id, 'groupsToAvoid', updatedOtherGroups);
      }
    }
  };

  const getAutocompleteSuggestions = (currentInput: string, currentEntrantId: string) => {
    if (!currentInput.trim()) return [];
    
    return entrants
      .filter(entrant => 
        entrant.id !== currentEntrantId && 
        entrant.name.toLowerCase().includes(currentInput.toLowerCase())
      )
      .map(entrant => entrant.name)
      .slice(0, 5); // Limit to 5 suggestions
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
    setDraggedEntrantId(null);
    setDragOverEntrantId(null);
  };

  const handleDragEnd = () => {
    setDraggedEntrantId(null);
    setDragOverEntrantId(null);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-7xl w-full max-h-[90vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
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
            <h3 className="text-lg font-semibold text-gray-800">Entrants ({entrants.length})</h3>
            <button
              onClick={handleAddEntrant}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors"
            >
              Add Entrant
            </button>
          </div>

          {entrants.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p>No entrants added yet. Click "Add Entrant" to get started.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full bg-white border border-gray-200 rounded-lg">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b sticky left-0 bg-gray-50 z-10">
                      Include
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b sticky left-[80px] bg-gray-50 z-10">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">Groups to Avoid</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">Preference</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">Judge 1</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">Judge 2</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">Judge 3</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">Room</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">O/A SF</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">O/A F</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {entrants.map((entrant) => (
                    <tr 
                      key={entrant.id} 
                      className={`text-gray-600 hover:bg-gray-50 transition-all duration-200 group ${
                        draggedEntrantId === entrant.id ? 'opacity-50 scale-95' : ''
                      } ${
                        dragOverEntrantId === entrant.id ? 'ring-2 ring-blue-500 ring-opacity-50' : ''
                      }`}
                      draggable
                      onDragStart={(e) => handleDragStart(e, entrant.id)}
                      onDragOver={(e) => handleDragOver(e, entrant.id)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, entrant.id)}
                      onDragEnd={handleDragEnd}
                    >
                      <td className="px-4 py-3 border-b sticky left-0 bg-white group-hover:bg-gray-50 z-10">
                        <div className="flex items-center gap-2">
                          <div className="cursor-move text-gray-400 hover:text-gray-600">
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M7 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4z"/>
                            </svg>
                          </div>
                          <input 
                            type="checkbox" 
                            checked={entrant.includeInSchedule || false}
                            onChange={(e) => handleFieldUpdate(entrant.id, 'includeInSchedule', e.target.checked)}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                        </div>
                      </td>
                      <td className="px-4 py-3 border-b sticky left-[80px] bg-white group-hover:bg-gray-50 z-10">
                        <input
                          type="text"
                          value={entrant.name}
                          onChange={(e) => handleFieldUpdate(entrant.id, 'name', e.target.value)}
                          onBlur={(e) => handleFieldUpdate(entrant.id, 'name', e.target.value.trim())}
                          className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="Enter name"
                        />
                      </td>
                      <td className="px-4 py-3 border-b">
                        <div className="space-y-2">
                          
                          {/* Input with Autocomplete */}
                          <div className="relative">
                            <input
                              type="text"
                              value={groupsInputs[entrant.id] || ''}
                              onChange={(e) => handleGroupsInputChange(entrant.id, e.target.value)}
                              onKeyDown={(e) => handleGroupsInputKeyDown(entrant.id, e)}
                              placeholder="Type to add groups to avoid..."
                              className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                            />
                            
                            {/* Autocomplete Suggestions */}
                            {groupsInputs[entrant.id] && (
                              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg">
                                {getAutocompleteSuggestions(groupsInputs[entrant.id], entrant.id).map((suggestion, index) => (
                                  <button
                                    key={index}
                                    onClick={() => {
                                      const currentGroups = entrant.groupsToAvoid || '';
                                      const updatedGroups = currentGroups ? `${currentGroups} | ${suggestion}` : suggestion;
                                      handleFieldUpdate(entrant.id, 'groupsToAvoid', updatedGroups);
                                      
                                      // Also add to the other entrant
                                      const otherEntrant = entrants.find(e => e.name === suggestion);
                                      if (otherEntrant && otherEntrant.id !== entrant.id) {
                                        const otherGroups = otherEntrant.groupsToAvoid || '';
                                        const currentEntrantName = entrant.name || '';
                                        if (currentEntrantName && !otherGroups.includes(currentEntrantName)) {
                                          const updatedOtherGroups = otherGroups ? `${otherGroups} | ${currentEntrantName}` : currentEntrantName;
                                          handleFieldUpdate(otherEntrant.id, 'groupsToAvoid', updatedOtherGroups);
                                        }
                                      }
                                      
                                      setGroupsInputs(prev => ({ ...prev, [entrant.id]: '' }));
                                    }}
                                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 focus:bg-gray-100"
                                  >
                                    {suggestion}
                                  </button>
                                ))}
                              </div>
                            )}
                                                      {/* Existing Groups as Pills */}
                            {entrant.groupsToAvoid && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {entrant.groupsToAvoid.split(' | ').map((group, index) => (
                                  <span
                                    key={index}
                                    className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                                  >
                                    {group}
                                    <button
                                      onClick={() => removeGroup(entrant.id, group)}
                                      className="ml-1 text-red-600 hover:text-red-800"
                                    >
                                      ×
                                    </button>
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 border-b">
                        <select
                          value={entrant.preference || ''}
                          onChange={(e) => handleFieldUpdate(entrant.id, 'preference', e.target.value || null)}
                          className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          <option value="">Select Preference</option>
                          <option value="1xLong">1xLong</option>
                          <option value="3x20">3x20</option>
                          <option value="3x10">3x10</option>
                        </select>
                      </td>
                      <td className="px-4 py-3 border-b">
                        <select
                          value={entrant.judgePreference1}
                          onChange={(e) => handleFieldUpdate(entrant.id, 'judgePreference1', e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          <option value="">Select Judge</option>
                          {judges.map(judge => (
                            <option key={judge.id} value={judge.id}>{judge.name}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3 border-b">
                        <select
                          value={entrant.judgePreference2}
                          onChange={(e) => handleFieldUpdate(entrant.id, 'judgePreference2', e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          <option value="">Select Judge</option>
                          {judges.map(judge => (
                            <option key={judge.id} value={judge.id}>{judge.name}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3 border-b">
                        <select
                          value={entrant.judgePreference3}
                          onChange={(e) => handleFieldUpdate(entrant.id, 'judgePreference3', e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          <option value="">Select Judge</option>
                          {judges.map(judge => (
                            <option key={judge.id} value={judge.id}>{judge.name}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3 border-b">
                        <input
                          type="text"
                          value={entrant.roomNumber || ''}
                          onChange={(e) => handleFieldUpdate(entrant.id, 'roomNumber', e.target.value)}
                          onBlur={(e) => handleFieldUpdate(entrant.id, 'roomNumber', e.target.value.trim() || '')}
                          className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </td>
                      <td className="px-4 py-3 border-b">
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={entrant.overallSF ?? ''}
                          onChange={(e) => handleFieldUpdate(entrant.id, 'overallSF', e.target.value === '' ? undefined : Number(e.target.value))}
                          className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="0"
                        />
                      </td>
                      <td className="px-4 py-3 border-b">
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={entrant.overallF ?? ''}
                          onChange={(e) => handleFieldUpdate(entrant.id, 'overallF', e.target.value === '' ? undefined : Number(e.target.value))}
                          className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="0"
                        />
                      </td>
                      <td className="px-4 py-3 border-b">
                        <button
                          onClick={() => handleRemove(entrant.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                          title="Remove entrant"
                        >
                          <FaTrash className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
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
