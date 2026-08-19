import { useState, useEffect, useRef } from 'react';
import type { Entrant } from '../types';
import { getSessionHeightCSS } from '../config/timeConfig';
import { useEntrant } from '../contexts/useEntrant.ts';
import { useSettings } from '../contexts/useSettings';

interface SessionBlockProps {
  entrant: Entrant;
  type: '1xLong' | '3x20' | '3x10';
  index?: number; // For 3X blocks to show which one of the three
  sessionId?: string;
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
  conflictSeverity?: 'red' | 'yellow';
  isMultiSelected?: boolean;
  suppressEntrantSelectionOnDrag?: boolean;
}

type SessionBlockAppearance = {
  background: string;
  text: string;
  indicator: string;
  indicatorText: string;
};

const SESSION_BLOCK_APPEARANCE = {
  conflictRed: {
    background: 'bg-red-600 dark:bg-red-800',
    text: 'text-white dark:text-red-50',
    indicator: 'bg-red-500 dark:bg-red-700',
    indicatorText: 'text-white',
  },
  conflictYellow: {
    background: 'bg-yellow-400 dark:bg-yellow-600',
    text: 'text-gray-900',
    indicator: 'bg-yellow-500 dark:bg-yellow-500',
    indicatorText: 'text-gray-900',
  },
  selected: {
    background: 'bg-blue-700 dark:bg-blue-600',
    text: 'text-white',
    indicator: 'bg-blue-500 dark:bg-blue-400',
    indicatorText: 'text-gray-900',
  },
  avoidGroup: {
    background: 'bg-blue-400 dark:bg-blue-300',
    text: 'text-gray-900',
    indicator: 'bg-gray-500 dark:bg-gray-600',
    indicatorText: 'text-white',
  },
  default: {
    background: 'bg-gray-500 dark:bg-gray-700',
    text: 'text-white dark:text-gray-100',
    indicator: 'bg-gray-500 dark:bg-gray-600',
    indicatorText: 'text-white',
  },
} as const satisfies Record<string, SessionBlockAppearance>;

function getSessionBlockAppearance({
  conflictSeverity,
  isSelected,
  isAvoidGroup,
}: {
  conflictSeverity: 'red' | 'yellow' | null;
  isSelected: boolean;
  isAvoidGroup: boolean;
}): SessionBlockAppearance {
  if (conflictSeverity === 'red') return SESSION_BLOCK_APPEARANCE.conflictRed;
  if (conflictSeverity === 'yellow') return SESSION_BLOCK_APPEARANCE.conflictYellow;
  if (isSelected) return SESSION_BLOCK_APPEARANCE.selected;
  if (isAvoidGroup) return SESSION_BLOCK_APPEARANCE.avoidGroup;
  return SESSION_BLOCK_APPEARANCE.default;
}

export default function SessionBlock({ 
  entrant, 
  type, 
  index, 
  sessionId,
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
  conflictSeverity,
  isMultiSelected = false,
  suppressEntrantSelectionOnDrag = false,

}: SessionBlockProps) {
  const [isDragged, setIsDragged] = useState(false);
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const { selectedEntrant, setSelectedEntrant, selectedGroupsToAvoid } = useEntrant();
  const { settings } = useSettings();
  const [isHiddenDuringDrag, setIsHiddenDuringDrag] = useState(false);
  const resolvedConflictSeverity = conflictSeverity ?? (hasConflict ? 'red' : null);
  const isSelected = selectedEntrant === entrant.id;
  const appearance = getSessionBlockAppearance({
    conflictSeverity: resolvedConflictSeverity,
    isSelected,
    isAvoidGroup: selectedGroupsToAvoid.includes(entrant.id),
  });

  const handleToggleSessionSelection = (entrant: Entrant) => {
    if (entrant.id === selectedEntrant) {
      setSelectedEntrant(null);
    } else {
      setSelectedEntrant(entrant.id);
    }
  };

  const handleDragStart = (e: React.DragEvent) => {
    setIsDragged(true);
    if (!suppressEntrantSelectionOnDrag) {
      setSelectedEntrant(entrant.id);
    }
    // Set drag data for the session block
    const sessionData = {
      entrantId: entrant.id,
      entrantName: entrant.name,
      type,
      sessionIndex: index,
      sessionId,
      isRemoving: useAbsolutePositioning // If useAbsolutePositioning is true, this session is in the grid and can be removed
    };
    e.dataTransfer.setData('application/json', JSON.stringify(sessionData));
    if (useAbsolutePositioning) {
      // Defer hiding until after drag image is created
      requestAnimationFrame(() => setIsHiddenDuringDrag(true));
    }
    if (onDragStart) onDragStart(e);
  };

  const handleDragEnd = (e: React.DragEvent) => {
    setIsDragged(false);
    if (useAbsolutePositioning) {
      setIsHiddenDuringDrag(false);
    }
    if (!suppressEntrantSelectionOnDrag) {
      setSelectedEntrant(null);
    }
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
    ${appearance.background} ${appearance.text} p-1 rounded-lg shadow-md
    cursor-move transition-all duration-200 hover:shadow-lg
    ${isDragging || isDragged ? 'opacity-50 scale-95' : ''}
    ${isDragOverProp ? 'ring-4 ring-amber-300 dark:ring-amber-500 ring-opacity-80 animate-pulse shadow-xl' : ''}
    ${isMultiSelected ? 'ring-4 ring-sky-300 dark:ring-sky-500 ring-opacity-90' : ''}
    ${useAbsolutePositioning ? 'border border-white dark:border-gray-400' : ''}
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
          ...(isHiddenDuringDrag && useAbsolutePositioning ? { visibility: 'hidden' } : {}),
          ...(useAbsolutePositioning && {
            position: 'absolute',
            top: '0',
            left: '0',
            right: '0',
            zIndex: 10,
          })
        }}
        data-session-id={sessionId}
        data-entrant-id={entrant.id}
        data-session-type={type}
        data-session-index={index}
        className={className}
      >
      <div className="text-center relative h-full">
      <button
            onClick={(e) => {
              e.stopPropagation();
              handleToggleSessionSelection(entrant);
            }}
          className={`absolute -bottom-1 -left-1 w-3 h-3 rounded-full text-xs flex items-center justify-center ${appearance.indicator} ${appearance.indicatorText}`}
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
          className="fixed bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg shadow-lg py-1 z-50 min-w-[160px]"
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
                className="w-full px-3 py-2 text-left text-sm text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center"
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
