import { useState } from 'react';
import type { Entrant, Judge } from '../types';

interface SessionConflict {
  entrantId: string;
  entrantName: string;
  conflictingGroup: string;
  conflictingEntrantId: string;
  conflictingEntrantName: string;
  timeSlot: string;
}

interface EntrantRowProps {
  entrant: Entrant;
  judges: Judge[];
  allEntrants: Entrant[];
  draggedEntrantId: string | null;
  dragOverEntrantId: string | null;
  scheduleConflicts?: SessionConflict[];
  onFieldUpdate: (entrantId: string, field: keyof Entrant, value: string | boolean | number | null | undefined | string[]) => void;
  onRemove: (entrantId: string) => void;
  onDragStart: (e: React.DragEvent, entrantId: string) => void;
  onDragOver: (e: React.DragEvent, entrantId: string) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent, targetEntrantId: string) => void;
  onDragEnd: () => void;
}

export default function EntrantRow({
  entrant,
  judges,
  allEntrants,
  draggedEntrantId,
  dragOverEntrantId,
  scheduleConflicts = [],
  onFieldUpdate,
  onRemove,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd
}: EntrantRowProps) {
  const [groupsInput, setGroupsInput] = useState('');

  const handleGroupsInputChange = (value: string) => {
    setGroupsInput(value);
  };

  const handleGroupsInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && groupsInput.trim()) {
      const currentGroups = entrant.groupsToAvoid || [];
      const newGroupName = groupsInput.trim();

      // Find the entrant by name
      const otherEntrant = allEntrants.find(e => e.name === newGroupName);
      if (otherEntrant && otherEntrant.id !== entrant.id && !currentGroups.includes(otherEntrant.id)) {
        // Add to current entrant
        const updatedGroups = [...currentGroups, otherEntrant.id];
        onFieldUpdate(entrant.id, 'groupsToAvoid', updatedGroups);

        // Add this entrant to the other entrant's avoidance list
        const otherGroups = otherEntrant.groupsToAvoid || [];
        if (!otherGroups.includes(entrant.id)) {
          const updatedOtherGroups = [...otherGroups, entrant.id];
          onFieldUpdate(otherEntrant.id, 'groupsToAvoid', updatedOtherGroups);
        }

        setGroupsInput('');
      }
    }
  };

  const removeGroup = (groupIdToRemove: string) => {
    const currentGroups = entrant.groupsToAvoid || [];
    const updatedGroups = currentGroups.filter(id => id !== groupIdToRemove);
    onFieldUpdate(entrant.id, 'groupsToAvoid', updatedGroups);

    // Also remove the current entrant's ID from the other entrant's avoidance list
    const otherEntrant = allEntrants.find(e => e.id === groupIdToRemove);
    if (otherEntrant && otherEntrant.id !== entrant.id) {
      const otherGroups = otherEntrant.groupsToAvoid || [];
      const updatedOtherGroups = otherGroups.filter(id => id !== entrant.id);
      onFieldUpdate(otherEntrant.id, 'groupsToAvoid', updatedOtherGroups);
    }
  };

  const getAutocompleteSuggestions = (currentInput: string) => {
    if (!currentInput.trim()) return [];

    return allEntrants
      .filter(otherEntrant =>
        otherEntrant.id !== entrant.id &&
        otherEntrant.name.toLowerCase().includes(currentInput.toLowerCase())
      )
      .map(otherEntrant => otherEntrant.name)
      .slice(0, 5); // Limit to 5 suggestions
  };

  // Helper function to check if a group has conflicts
  const hasGroupConflict = (groupId: string): boolean => {
    return scheduleConflicts.some(conflict =>
      conflict.entrantId === entrant.id && conflict.conflictingEntrantId === groupId
    );
  };

  return (
    <tr
      className={`text-gray-600 hover:bg-gray-50 transition-all duration-200 group ${
        draggedEntrantId === entrant.id ? 'opacity-50 scale-95' : ''
      } ${
        dragOverEntrantId === entrant.id ? 'ring-2 ring-blue-500 ring-opacity-50' : ''
      }`}
      draggable
      onDragStart={(e) => onDragStart(e, entrant.id)}
      onDragOver={(e) => onDragOver(e, entrant.id)}
      onDragLeave={onDragLeave}
      onDrop={(e) => onDrop(e, entrant.id)}
      onDragEnd={onDragEnd}
    >
      {/* Include Checkbox */}
      <td className="px-2 py-2 border-b sticky left-0 bg-white group-hover:bg-gray-50 z-10">
        <div className="flex items-center gap-2">
          <div className="cursor-move text-gray-400 hover:text-gray-600">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M7 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4z"/>
            </svg>
          </div>
          <input
            type="checkbox"
            checked={entrant.includeInSchedule || false}
            onChange={(e) => onFieldUpdate(entrant.id, 'includeInSchedule', e.target.checked)}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
        </div>
      </td>

      {/* Score */}
      <td className="px-2 py-2 border-b">
        <input
          type="number"
          min="0"
          step="1"
          value={entrant.score ?? ''}
          onChange={(e) => onFieldUpdate(entrant.id, 'score', e.target.value === '' ? undefined : Number(e.target.value))}
          className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="0"
        />
      </td>

       {/* Name */}
       <td className="px-2 py-2 border-b sticky left-[60px] bg-white group-hover:bg-gray-50 z-10 w-48">
        <input
          type="text"
          value={entrant.name}
          onChange={(e) => onFieldUpdate(entrant.id, 'name', e.target.value)}
          onBlur={(e) => onFieldUpdate(entrant.id, 'name', e.target.value.trim())}
          className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="Enter name"
        />
      </td>

      {/* Group Type */}
      <td className="px-2 py-2 border-b">
        <select
          value={entrant.groupType || ''}
          onChange={(e) => onFieldUpdate(entrant.id, 'groupType', e.target.value || null)}
          className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="">Select Type</option>
          <option value="Chorus">Chorus</option>
          <option value="Quartet">Quartet</option>
        </select>
      </td>

      {/* Groups to Avoid */}
      <td className="px-2 py-2 border-b">
        <div className="space-y-2">
          {/* Input with Autocomplete */}
          <div className="relative">
            <input
              type="text"
              value={groupsInput}
              onChange={(e) => handleGroupsInputChange(e.target.value)}
              onKeyDown={handleGroupsInputKeyDown}
              placeholder="Type to add groups to avoid..."
              className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            />

            {/* Autocomplete Suggestions */}
            {groupsInput && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg">
                {getAutocompleteSuggestions(groupsInput).length > 0 ? (
                  getAutocompleteSuggestions(groupsInput).map((suggestion, index) => (
                    <button
                      key={index}
                      onClick={() => {
                        const currentGroups = entrant.groupsToAvoid || [];
                        const otherEntrant = allEntrants.find(e => e.name === suggestion);
                        if (otherEntrant && otherEntrant.id !== entrant.id && !currentGroups.includes(otherEntrant.id)) {
                          // Add to current entrant
                          const updatedGroups = [...currentGroups, otherEntrant.id];
                          onFieldUpdate(entrant.id, 'groupsToAvoid', updatedGroups);

                          // Add this entrant to the other entrant's avoidance list
                          const otherGroups = otherEntrant.groupsToAvoid || [];
                          if (!otherGroups.includes(entrant.id)) {
                            const updatedOtherGroups = [...otherGroups, entrant.id];
                            onFieldUpdate(otherEntrant.id, 'groupsToAvoid', updatedOtherGroups);
                          }
                        }

                        setGroupsInput('');
                      }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 focus:bg-gray-100"
                    >
                      {suggestion}
                    </button>
                  ))
                ) : (
                  <div className="px-3 py-2 text-sm text-gray-500">
                    No matching entrants found
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Existing Groups as Pills */}
          {entrant.groupsToAvoid && Array.isArray(entrant.groupsToAvoid) && entrant.groupsToAvoid.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {entrant.groupsToAvoid.map((groupId, index) => {
                const groupEntrant = allEntrants.find(e => e.id === groupId);
                const groupName = groupEntrant?.name || 'Unknown Group';
                return (
                  <span
                    key={index}
                    className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      hasGroupConflict(groupId)
                        ? 'bg-red-200 text-red-800'
                        : 'bg-green-200 text-green-800'
                    }`}
                  >
                    {groupName}
                    <button
                      onClick={() => removeGroup(groupId)}
                      className="ml-1 text-red-600 hover:text-red-800"
                    >
                      ×
                    </button>
                  </span>
                );
              })}
            </div>
          )}
        </div>
      </td>

      {/* Preference */}
      <td className="px-2 py-2 border-b">
        <select
          value={entrant.preference || ''}
          onChange={(e) => onFieldUpdate(entrant.id, 'preference', e.target.value || null)}
          className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="">Select Preference</option>
          <option value="1xLong">1xLong</option>
          <option value="3x20">3x20</option>
          <option value="3x10">3x10</option>
        </select>
      </td>

      {/* Judge 1 */}
      <td className="px-2 py-2 border-b">
        <select
          value={entrant.judgePreference1}
          onChange={(e) => onFieldUpdate(entrant.id, 'judgePreference1', e.target.value)}
          className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="">Select Judge</option>
          {judges.map(judge => (
            <option key={judge.id} value={judge.id}>{judge.name}</option>
          ))}
        </select>
      </td>

      {/* Judge 2 */}
      <td className="px-2 py-2 border-b">
        <select
          value={entrant.judgePreference2}
          onChange={(e) => onFieldUpdate(entrant.id, 'judgePreference2', e.target.value)}
          className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="">Select Judge</option>
          {judges.map(judge => (
            <option key={judge.id} value={judge.id}>{judge.name}</option>
          ))}
        </select>
      </td>

      {/* Judge 3 */}
      <td className="px-2 py-2 border-b">
        <select
          value={entrant.judgePreference3}
          onChange={(e) => onFieldUpdate(entrant.id, 'judgePreference3', e.target.value)}
          className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="">Select Judge</option>
          {judges.map(judge => (
            <option key={judge.id} value={judge.id}>{judge.name}</option>
          ))}
        </select>
      </td>

      {/* Room */}
      <td className="px-2 py-2 border-b">
        <input
          type="text"
          value={entrant.roomNumber || ''}
          onChange={(e) => onFieldUpdate(entrant.id, 'roomNumber', e.target.value)}
          onBlur={(e) => onFieldUpdate(entrant.id, 'roomNumber', e.target.value.trim() || '')}
          className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </td>

      {/* O/A SF */}
      <td className="px-2 py-2 border-b">
        <input
          type="number"
          min="0"
          step="1"
          value={entrant.overallSF ?? ''}
          onChange={(e) => onFieldUpdate(entrant.id, 'overallSF', e.target.value === '' ? undefined : Number(e.target.value))}
          className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="0"
        />
      </td>

      {/* O/A F */}
      <td className="px-2 py-2 border-b">
        <input
          type="number"
          min="0"
          step="1"
          value={entrant.overallF ?? ''}
          onChange={(e) => onFieldUpdate(entrant.id, 'overallF', e.target.value === '' ? undefined : Number(e.target.value))}
          className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="0"
        />
      </td>

      {/* Actions */}
      <td className="px-2 py-2 border-b text-right">
        <button
          onClick={() => onRemove(entrant.id)}
          className="text-red-600 hover:text-red-800 hover:bg-red-50 rounded-md transition-colors font-bold text-lg"
          title="Remove entrant"
        >
          ×
        </button>
      </td>
    </tr>
  );
}
