import { useState, useEffect, useRef } from 'react';
import type { Entrant } from '../types';
import { getSessionHeightCSS } from '../config/timeConfig';
import { useEntrant } from '../contexts/useEntrant.ts';
import { useSettings } from '../contexts/useSettings';

interface SessionBlockProps {
  entrant: Entrant;
  type: '1xLong' | '3x20' | '3x10';
  index?: number; // For 3X blocks to show which one of the three
  isDragging?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  useAbsolutePositioning?: boolean;
  onDragOver?: (e: React.DragEvent) => void;
  onDragEnter?: (e: React.DragEvent) => void;
  onDragLeave?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
  isDragOver?: boolean;
  hasConflict?: boolean; // Add this prop to indicate conflicts
  onSessionTypeChange?: (entrantId: string, oldType: '1xLong' | '3x20' | '3x10', newType: '1xLong' | '3x20' | '3x10') => void;
}

export default function SessionBlock({ 
  entrant, 
  type, 
  index, 
  isDragging, 
  onDragStart, 
  onDragEnd,
  useAbsolutePositioning = false,
  onDragOver,
  onDragEnter,
  onDragLeave,
  onDrop,
  isDragOver: isDragOverProp = false,
  hasConflict = false,
  onSessionTypeChange,

}: SessionBlockProps) {
  const [isDragged, setIsDragged] = useState(false);
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const { selectedEntrant, setSelectedEntrant, selectedGroupsToAvoid } = useEntrant();
  const { settings } = useSettings();

  const handleToggleSessionSelection = (entrant: Entrant) => {
    if (entrant.id === selectedEntrant) {
      setSelectedEntrant(null);
    } else {
      setSelectedEntrant(entrant.id);
    }
  };

  const handleDragStart = (e: React.DragEvent) => {
    setIsDragged(true);
    setSelectedEntrant(entrant.id);
    // Set drag data for the session block
    const sessionData = {
      entrantId: entrant.id,
      entrantName: entrant.name,
      type,
      sessionIndex: index,
      isRemoving: useAbsolutePositioning // If useAbsolutePositioning is true, this session is in the grid and can be removed
    };
    e.dataTransfer.setData('application/json', JSON.stringify(sessionData));
    if (onDragStart) onDragStart(e);
  };

  const handleDragEnd = (e: React.DragEvent) => {
    setIsDragged(false);
    setSelectedEntrant(null);
    if (onDragEnd) onDragEnd(e);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenuPosition({ x: e.clientX, y: e.clientY });
    setShowContextMenu(true);
  };

  const handleSessionTypeChange = (newType: '1xLong' | '3x20' | '3x10') => {
    console.log(`Changing session type from ${type} to ${newType} for entrant ${entrant.name}`);
    if (onSessionTypeChange) {
      onSessionTypeChange(entrant.id, type, newType);
    }
    setShowContextMenu(false);
  };

  // Close context menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(event.target as Node)) {
        setShowContextMenu(false);
      }
    };

    if (showContextMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showContextMenu]);

  const className = `
    ${hasConflict ? 'bg-red-600' : entrant.id === selectedEntrant ? 'bg-blue-800' : selectedGroupsToAvoid.includes(entrant.id) ? 'bg-blue-500' : 'bg-gray-500'} text-white p-1 rounded-lg shadow-md
    cursor-move transition-all duration-200 hover:shadow-lg
    ${isDragging || isDragged ? 'opacity-50 scale-95' : ''}
    ${isDragOverProp ? 'ring-2 ring-blue-400 ring-opacity-75' : ''}
    ${selectedEntrant === entrant.id ? 'bg-blue-200' : ''}
    relative z-10
  `;

  return (
    <>
      <div
        draggable
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragOver={onDragOver}
        onDragEnter={onDragEnter}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onContextMenu={handleContextMenu}
        style={{ 
          height: getSessionHeightCSS(type, settings),
          ...(useAbsolutePositioning && {
            position: 'absolute',
            top: '0',
            left: '0',
            right: '0',
            zIndex: 10,
            border: '1px solid #fff'
          })
        }}
        data-entrant-id={entrant.id}
        data-session-type={type}
        data-session-index={index}
        className={className}
      >
      <div className="text-center relative">
      <button
            onClick={(e) => {
              e.stopPropagation();
              handleToggleSessionSelection(entrant);
            }}
            className={`absolute -top-1 -left-1 w-4 h-4 rounded-full text-xs flex items-center justify-center ${hasConflict ? 'bg-red-500' : 'bg-gray-500'} text-white`}
          >
            •
          </button>
        {/* Removed the X button - sessions will now be removed by dragging back to UnassignedSessions */}
        <div className="font-semibold text-sm truncate">
          {entrant.name} {type === '3x10' && settings.moving === "judges" && entrant.roomNumber && `(${entrant.roomNumber})`}
        </div>
        {type !== '3x10' && (
          <>
          {settings.moving === "judges" && entrant.roomNumber &&<div className="text-xs opacity-90">
            {entrant.roomNumber}
          </div>}
        </>
        )}
      </div>
      </div>

      {/* Context Menu */}
      {showContextMenu && (
        <div
          ref={contextMenuRef}
          className="fixed bg-black border border-gray-300 rounded-lg shadow-lg py-1 z-50 min-w-[160px]"
          style={{
            left: contextMenuPosition.x,
            top: contextMenuPosition.y,
          }}
        >
          {(['1xLong', '3x20', '3x10'] as const)
            .filter(sessionType => sessionType !== type)
            .map(sessionType => (
              <button
                key={sessionType}
                className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center"
                onClick={() => handleSessionTypeChange(sessionType)}
              >
                Change to {sessionType}
              </button>
            ))}
        </div>
      )}
    </>
  );
}
