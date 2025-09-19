import { useState, useEffect } from 'react';
import type { Entrant, SessionBlock } from '../types';
import { getEntrants } from '../utils/localStorage';
import SessionBlockComponent from './SessionBlock';

interface UnassignedSessionsProps {
  refreshKey?: string;
  allSessionBlocks: SessionBlock[];
  onSessionUnscheduled?: (sessionData: { entrantId: string; type: string; sessionIndex?: number }) => void;
  onSessionBlockUpdate?: (sessionBlock: SessionBlock) => void; // Callback to update individual session blocks
  onSessionBlockRemove?: (sessionBlockId: string) => void; // Callback to remove session blocks
}

export default function UnassignedSessions({ refreshKey, allSessionBlocks, onSessionUnscheduled, onSessionBlockUpdate, onSessionBlockRemove }: UnassignedSessionsProps) {
  const [entrants, setEntrants] = useState<Entrant[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleSessionTypeChange = (entrantId: string, oldType: '1xLong' | '3x20' | '3x10', newType: '1xLong' | '3x20' | '3x10') => {
    // Find all session blocks for this entrant with the old type
    const entrantSessionBlocks = allSessionBlocks.filter(block => 
      block.entrantId === entrantId && block.type === oldType
    );
    
    // Remove all old session blocks
    entrantSessionBlocks.forEach(block => {
      if (onSessionBlockRemove) {
        onSessionBlockRemove(block.id);
      }
    });
    
    // Create new session blocks with the new type
    const entrant = entrants.find(e => e.id === entrantId);
    if (entrant && onSessionBlockUpdate) {
      if (newType === '1xLong') {
        const newBlock: SessionBlock = {
          id: `${entrantId}-1xlong`,
          entrantId: entrantId,
          entrantName: entrant.name,
          type: '1xLong',
          isScheduled: false
        };
        onSessionBlockUpdate(newBlock);
      } else if (newType === '3x20') {
        for (let i = 0; i < 3; i++) {
          const newBlock: SessionBlock = {
            id: `${entrantId}-3x20-${i}`,
            entrantId: entrantId,
            entrantName: entrant.name,
            type: '3x20',
            sessionIndex: i,
            isScheduled: false
          };
          onSessionBlockUpdate(newBlock);
        }
      } else if (newType === '3x10') {
        for (let i = 0; i < 3; i++) {
          const newBlock: SessionBlock = {
            id: `${entrantId}-3x10-${i}`,
            entrantId: entrantId,
            entrantName: entrant.name,
            type: '3x10',
            sessionIndex: i,
            isScheduled: false
          };
          onSessionBlockUpdate(newBlock);
        }
      }
    }
    
    console.log(`Removed ${entrantSessionBlocks.length} old session blocks and created new ${newType} blocks for entrant ${entrantId}`);
  };

  // Refresh entrants when refreshKey changes (modal closes)
  useEffect(() => {
    if (refreshKey === 'closed') {
      const storedEntrants = getEntrants();
      setEntrants(storedEntrants);
    }
  }, [refreshKey]);

  // Also refresh entrants when allSessionBlocks change to catch type changes
  useEffect(() => {
    const storedEntrants = getEntrants();
    setEntrants(storedEntrants);
  }, [allSessionBlocks]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    // Only clear drag over if we're leaving the container, not entering a child
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    try {
      const sessionData = e.dataTransfer.getData('application/json');
      if (sessionData) {
        const draggedSession = JSON.parse(sessionData);
        
        // Check if this is a session being unscheduled from the grid
        if (draggedSession.isRemoving && onSessionUnscheduled) {
          onSessionUnscheduled({
            entrantId: draggedSession.entrantId,
            type: draggedSession.type,
            sessionIndex: draggedSession.sessionIndex
          });
        }
      }
    } catch (error) {
      console.error('Failed to parse session data:', error);
    }
  };

  const includedEntrants = entrants.filter(e => e.includeInSchedule);

  // Get unscheduled session blocks
  const unassignedSessions = allSessionBlocks.filter(block => !block.isScheduled);

  if (includedEntrants.length === 0) {
    return (
      <div className="mt-8">
        <div className="bg-gray-200 rounded-xl border border-gray-200 p-6">
          <div className="text-center text-gray-500">
            <p className="text-lg font-medium">Unassigned Sessions</p>
            <p className="text-sm">No entrants included in schedule yet</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-8">
      <div 
        className={`bg-gray-200 rounded-xl border-2 transition-all duration-200 p-6 ${
          isDragOver 
            ? 'border-blue-500 bg-blue-50 shadow-lg' 
            : 'border-gray-500'
        }`}
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {isDragOver && (
          <div className="text-center font-semibold mb-4 p-2 bg-gray-300 rounded-lg border-dashed border-2 border-gray-500">
            Drop here to unschedule session
          </div>
        )}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {unassignedSessions.map(sessionBlock => (
            <SessionBlockComponent 
              key={sessionBlock.id}
              entrant={{ 
                id: sessionBlock.entrantId, 
                name: sessionBlock.entrantName,
                groupsToAvoid: '',
                preference: null, // Don't set preference here - it should come from the actual entrant data
                judgePreference1: '',
                judgePreference2: '',
                judgePreference3: '',
                includeInSchedule: true
              } as Entrant}
              type={sessionBlock.type}
              index={sessionBlock.sessionIndex}
              useAbsolutePositioning={false}
              onSessionTypeChange={handleSessionTypeChange}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
