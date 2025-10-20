import { useState, useEffect } from 'react';
import type { Judge, Entrant, SessionBlock, DraggedSessionData } from '../types';
import { getEntrants } from '../utils/localStorage';
import SessionBlockComponent from './SessionBlock';
import { TIME_CONFIG, getSessionHeight } from '../config/timeConfig';
import { useSettings } from '../contexts/useSettings';
import { useEntrant } from '../contexts/useEntrant';
import { getCategoryColor } from '../config/categoryConfig';
interface GridScheduleProps {
  judges: Judge[];
  onJudgesReorder?: (reorderedJudges: Judge[]) => void;
  onSessionAssigned?: (sessionData: DraggedSessionData) => void;
  refreshKey?: string;
  draggedSessionData?: DraggedSessionData | null; 
  scheduledSessions: SessionBlock[];
  allSessionBlocks: SessionBlock[];
  onSessionBlockUpdate: (sessionBlock: SessionBlock) => void;
  onSessionBlockRemove: (sessionBlockId: string) => void;
  onSessionDragStart?: (sessionData: DraggedSessionData) => void; // Add callback for drag start
}


interface DragPreview {
  judgeId: string;
  timeSlot: number;
  sessionType: '1xLong' | '3x20' | '3x10';
  isValid: boolean;
}

export default function GridSchedule({ judges, onJudgesReorder, onSessionAssigned, refreshKey, draggedSessionData, scheduledSessions, allSessionBlocks, onSessionBlockUpdate, onSessionBlockRemove, onSessionDragStart }: GridScheduleProps) {
  const { settings } = useSettings();
  const { selectedEntrant, entrants: contextEntrants } = useEntrant();
  const [draggedJudgeId, setDraggedJudgeId] = useState<string | null>(null);
  const [dragOverJudgeId, setDragOverJudgeId] = useState<string | null>(null);
  const [entrants, setEntrants] = useState<Entrant[]>([]);
  const [dragPreview, setDragPreview] = useState<DragPreview | null>(null);

  useEffect(() => {
    const storedEntrants = getEntrants();
    setEntrants(storedEntrants);
  }, [refreshKey]);

  // Note: Session type validation is now handled at the App.tsx level when regenerating session blocks
  // The GridSchedule component now relies entirely on the SessionBlocks provided to it


  // Clear drag preview when drag ends
  useEffect(() => {
    if (!draggedSessionData) {
      setDragPreview(null);
    }
  }, [draggedSessionData]);

  const generateTimeSlots = () => {
    const slots = [];
    const startTime = settings.startTime;
    const startHour = parseInt(startTime.split(':')[0]);
    const startMinute = parseInt(startTime.split(':')[1]);
    
    for (let i = 0; i < TIME_CONFIG.TIME_SLOTS; i++) {
      const totalMinutes = startMinute + (i * TIME_CONFIG.MINUTES_PER_SLOT);
      const hour = (startHour + Math.floor(totalMinutes / 60)) % 24;
      const minute = totalMinutes % 60;
      const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
      
      slots.push({
        time: timeString,
        displayTime: i % TIME_CONFIG.HOUR_MARKER_INTERVAL === 0 ? timeString : '',
        isHour: i % TIME_CONFIG.HOUR_MARKER_INTERVAL === 0
      });
    }
    
    return slots;
  };

  // Judge column reordering
  const handleDragStart = (e: React.DragEvent, judgeId: string) => {
    setDraggedJudgeId(judgeId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', judgeId);
  };

  const handleDragOver = (e: React.DragEvent, judgeId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggedJudgeId && draggedJudgeId !== judgeId) {
      setDragOverJudgeId(judgeId);
    }
  };

  const handleDragLeave = () => {
    setDragOverJudgeId(null);
  };

  const handleDrop = (e: React.DragEvent, targetJudgeId: string) => {
    e.preventDefault();
    if (!draggedJudgeId || draggedJudgeId === targetJudgeId) return;

    const draggedIndex = judges.findIndex(judge => judge.id === draggedJudgeId);
    const targetIndex = judges.findIndex(judge => judge.id === targetJudgeId);
    
    if (draggedIndex === -1 || targetIndex === -1) return;

    const newJudges = [...judges];
    const [draggedJudge] = newJudges.splice(draggedIndex, 1);
    newJudges.splice(targetIndex, 0, draggedJudge);

    if (onJudgesReorder) {
      onJudgesReorder(newJudges);
    }
    
    setDraggedJudgeId(null);
    setDragOverJudgeId(null);
  };

  const handleDragEnd = () => {
    setDraggedJudgeId(null);
    setDragOverJudgeId(null);
  };

  // Session handling
  const handleSessionDrop = (e: React.DragEvent, judgeId: string, timeSlot: number) => {
    e.preventDefault();
    
    try {
      const sessionData = e.dataTransfer.getData('application/json');
      if (sessionData) {
        const draggedSession: DraggedSessionData = JSON.parse(sessionData);
        
        // Check for time conflicts before allowing the drop
        if (hasTimeConflict(judgeId, timeSlot, draggedSession.type, draggedSession)) {
          console.warn('Cannot drop session: time conflict detected');
          return; // Prevent the drop
        }
        
        // Update the session block to mark it as scheduled
        const sessionBlock = allSessionBlocks.find(block => 
          block.entrantId === draggedSession.entrantId && 
          block.type === draggedSession.type && 
          block.sessionIndex === draggedSession.sessionIndex
        );
        
        if (sessionBlock) {
          const updatedSessionBlock: SessionBlock = {
            ...sessionBlock,
            isScheduled: true,
            startRowIndex: timeSlot, // Use the row index directly
            judgeId
          };
          onSessionBlockUpdate(updatedSessionBlock);
        }
        
        // Notify parent to remove from unassigned sessions (only if dragging from unassigned)
        if (onSessionAssigned && draggedSession.isRemoving !== true) {
          onSessionAssigned(draggedSession);
        }
        setDragPreview(null); // Clear the preview
      }
    } catch (error) {
      console.error('Failed to parse session data:', error);
    }
  };

  // Handle drag enter to show preview
  const handleSessionDragEnter = (e: React.DragEvent, judgeId: string, timeSlot: number) => {
    // Always prevent default for drag operations and show preview
    if (draggedSessionData) {
      e.preventDefault();
      // Use the stored dragged session data instead of trying to get it from the event
      setDragPreview({
        judgeId,
        timeSlot,
        sessionType: draggedSessionData.type,
        isValid: !hasTimeConflict(judgeId, timeSlot, draggedSessionData.type, draggedSessionData)
      });
    }
  };

  // Handle drag over to continuously update preview position
  const handleSessionDragOverWithPreview = (e: React.DragEvent, judgeId: string, timeSlot: number) => {
    // Always prevent default for drag operations and show preview
    if (draggedSessionData) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      // Update preview position as user drags around
      setDragPreview({
        judgeId,
        timeSlot,
        sessionType: draggedSessionData.type,
        isValid: !hasTimeConflict(judgeId, timeSlot, draggedSessionData.type, draggedSessionData)
      });
    }
  };

// Handle drag leave to clear preview
const handleSessionDragLeave = () => setDragPreview(null);



  // Check if a session would overlap with existing sessions for a judge
  const hasTimeConflict = (judgeId: string, startRowIndex: number, sessionType: string, excludeSession?: DraggedSessionData) => {
    // Calculate how many row slots this session will occupy using settings
    const sessionDuration = getSessionDurationInSlots(sessionType);
    const proposedEndRow = startRowIndex + sessionDuration - 1;
    
    // Check if any existing sessions for this judge overlap with the proposed row range
    return scheduledSessions.some(session => {
      if (session.judgeId !== judgeId) return false;
      
      // Skip conflicts with the same session (it will replace itself)
      if (excludeSession && 
          session.entrantId === excludeSession.entrantId && 
          session.type === excludeSession.type && 
          session.sessionIndex === excludeSession.sessionIndex) {
        return false;
      }
      
      const existingStartRow = session.startRowIndex!;
      const existingDuration = getSessionDurationInSlots(session.type);
      const existingEndRow = existingStartRow + existingDuration - 1;
      
      return doTimeRangesOverlap(startRowIndex, proposedEndRow, existingStartRow, existingEndRow);
    });
  };

  // Helper function to calculate session duration in row slots
  const getSessionDurationInSlots = (sessionType: string): number => {
    const sessionDurationMinutes = sessionType === '1xLong' ? settings.oneXLongLength : 
                                   sessionType === '3x20' ? settings.threeX20Length : 
                                   settings.threeX10Length;
    return Math.ceil(sessionDurationMinutes / TIME_CONFIG.MINUTES_PER_SLOT);
  };

  // Helper function to check if two time ranges overlap
  const doTimeRangesOverlap = (start1: number, end1: number, start2: number, end2: number): boolean => {
    return !(start1 > end2 || end1 < start2);
  };

  // Check if a session block has conflicts
  const hasSessionConflict = (session: SessionBlock) => {
    // Check 1: Multiple blocks with the same category for the same entrant
    const currentJudge = judges.find(j => j.id === session.judgeId);
    const currentJudgeCategory = currentJudge?.category;
    
    if (currentJudgeCategory) {
      const sameCategorySameEntrant = scheduledSessions.some(otherSession => {
        if (otherSession.id === session.id || 
            otherSession.entrantId !== session.entrantId) {
          return false;
        }
        
        const otherJudge = judges.find(j => j.id === otherSession.judgeId);
        const otherJudgeCategory = otherJudge?.category;
        
        return otherJudgeCategory === currentJudgeCategory;
      });
      
      if (sameCategorySameEntrant) return true;
    }
    
    // Check 2: Overlapping row indices for the same entrant
    const sessionStartRow = session.startRowIndex!;
    const sessionDuration = getSessionDurationInSlots(session.type);
    const sessionEndRow = sessionStartRow + sessionDuration - 1;
    
    // Check for overlap with other sessions from the same entrant
    const hasEntrantOverlap = scheduledSessions.some(otherSession => {
      if (otherSession.id === session.id || otherSession.entrantId !== session.entrantId) return false;
      
      const otherStartRow = otherSession.startRowIndex!;
      const otherDuration = getSessionDurationInSlots(otherSession.type);
      const otherEndRow = otherStartRow + otherDuration - 1;
      
      return doTimeRangesOverlap(sessionStartRow, sessionEndRow, otherStartRow, otherEndRow);
    });

    if (hasEntrantOverlap) return true;

    // Check 3: Overlapping row indices for the same room (if moving judges)
    if (settings.moving === "judges") {
      const currentEntrant = entrants.find(e => e.id === session.entrantId);
      const currentEntrantRoom = currentEntrant?.roomNumber;
      
      if (currentEntrantRoom) {
        const hasRoomOverlap = scheduledSessions.some(otherSession => {
          if (otherSession.id === session.id) return false;
          
          const otherEntrant = entrants.find(e => e.id === otherSession.entrantId);
          const otherEntrantRoom = otherEntrant?.roomNumber;
          
          // Only check room overlap if both entrants have the same room number
          if (otherEntrantRoom !== currentEntrantRoom) return false;
          
          const otherStartRow = otherSession.startRowIndex!;
          const otherDuration = getSessionDurationInSlots(otherSession.type);
          const otherEndRow = otherStartRow + otherDuration - 1;
          
          return doTimeRangesOverlap(sessionStartRow, sessionEndRow, otherStartRow, otherEndRow);
        });
        
        if (hasRoomOverlap) return true;
      }
    }
    
    return false;
  };

  // Calculate total assigned time for each judge
  const getJudgeAssignedTime = (judgeId: string): number => {
    const judgeSessions = scheduledSessions.filter(session => session.judgeId === judgeId);
    return judgeSessions.reduce((total, session) => {
      const sessionDurationMinutes = session.type === '1xLong' ? settings.oneXLongLength : 
                                    session.type === '3x20' ? settings.threeX20Length : 
                                    settings.threeX10Length;
      return total + sessionDurationMinutes;
    }, 0);
  };

  const handleSessionTypeChange = (entrantId: string, oldType: '1xLong' | '3x20' | '3x10', newType: '1xLong' | '3x20' | '3x10') => {
    // Find all session blocks for this entrant with the old type
    const entrantSessionBlocks = allSessionBlocks.filter(block => 
      block.entrantId === entrantId && block.type === oldType
    );
    
    // Remove all old session blocks
    entrantSessionBlocks.forEach(block => {
      onSessionBlockRemove(block.id);
    });
    
    // Create new session blocks with the new type
    const entrant = entrants.find(e => e.id === entrantId);
    if (entrant) {
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

  // Get judge background styling (category color or default)
  const getJudgeBackgroundStyle = (judgeCategory?: 'SNG' | 'MUS' | 'PER') => {
    if (judgeCategory) {
      return { backgroundColor: getCategoryColor(judgeCategory) };
    }
    return { backgroundColor: '#374151' }; // bg-gray-700
  };

  // Get judge preference indicator (circle with number)
  const getJudgePreferenceIndicator = (judgeId: string) => {
    if (!selectedEntrant) {
      return null;
    }

    const entrant = contextEntrants.find(e => e.id === selectedEntrant);
    if (!entrant) {
      return null;
    }

    // Check if this judge is in the entrant's preferences
    if (entrant.judgePreference1 === judgeId) {
      return { number: '1', color: '#d97706' }; // Gold
    } else if (entrant.judgePreference2 === judgeId) {
      return { number: '2', color: '#4b5563' }; // Silver
    } else if (entrant.judgePreference3 === judgeId) {
      return { number: '3', color: '#92400e' }; // Bronze
    }

    return null;
  };

  // Get conflict details for display
  const getConflictDetails = () => {
    const conflicts = new Set<string>();
    const conflictList: Array<{
      type: 'category' | 'entrant' | 'room';
      entrantName?: string;
      category?: string;
      roomNumber?: string;
    }> = [];
    
    scheduledSessions.forEach(session => {
      if (hasSessionConflict(session)) {
        const currentJudge = judges.find(j => j.id === session.judgeId);
        const currentJudgeCategory = currentJudge?.category;
        const currentEntrant = entrants.find(e => e.id === session.entrantId);
        const currentEntrantRoom = currentEntrant?.roomNumber;
        
        // Check 1: Multiple blocks with the same category for the same entrant
        if (currentJudgeCategory) {
          const sameCategorySameEntrant = scheduledSessions.some(otherSession => {
            if (otherSession.id === session.id || 
                otherSession.entrantId !== session.entrantId) {
              return false;
            }
            
            const otherJudge = judges.find(j => j.id === otherSession.judgeId);
            const otherJudgeCategory = otherJudge?.category;
            
            return otherJudgeCategory === currentJudgeCategory;
          });
          
          if (sameCategorySameEntrant) {
            const conflictKey = `category-${session.entrantId}-${currentJudgeCategory}`;
            if (!conflicts.has(conflictKey)) {
              conflicts.add(conflictKey);
              conflictList.push({
                type: 'category',
                entrantName: session.entrantName,
                category: currentJudgeCategory
              });
            }
          }
        }
        
        // Check 2: Overlapping row indices for the same entrant
        const sessionStartRow = session.startRowIndex!;
        const sessionDuration = getSessionDurationInSlots(session.type);
        const sessionEndRow = sessionStartRow + sessionDuration - 1;
        
        const hasEntrantOverlap = scheduledSessions.some(otherSession => {
          if (otherSession.id === session.id || otherSession.entrantId !== session.entrantId) return false;
          
          const otherStartRow = otherSession.startRowIndex!;
          const otherDuration = getSessionDurationInSlots(otherSession.type);
          const otherEndRow = otherStartRow + otherDuration - 1;
          
          return doTimeRangesOverlap(sessionStartRow, sessionEndRow, otherStartRow, otherEndRow);
        });

        if (hasEntrantOverlap) {
          const conflictKey = `entrant-${session.entrantId}`;
          if (!conflicts.has(conflictKey)) {
            conflicts.add(conflictKey);
            conflictList.push({
              type: 'entrant',
              entrantName: session.entrantName
            });
          }
        }

        // Check 3: Overlapping row indices for the same room (if moving judges)
        if (settings.moving === "judges" && currentEntrantRoom) {
          const hasRoomOverlap = scheduledSessions.some(otherSession => {
            if (otherSession.id === session.id) return false;
            
            const otherEntrant = entrants.find(e => e.id === otherSession.entrantId);
            const otherEntrantRoom = otherEntrant?.roomNumber;
            
            if (otherEntrantRoom !== currentEntrantRoom) return false;
            
            const otherStartRow = otherSession.startRowIndex!;
            const otherDuration = getSessionDurationInSlots(otherSession.type);
            const otherEndRow = otherStartRow + otherDuration - 1;
            
            return doTimeRangesOverlap(sessionStartRow, sessionEndRow, otherStartRow, otherEndRow);
          });
          
          if (hasRoomOverlap) {
            const conflictKey = `room-${currentEntrantRoom}`;
            if (!conflicts.has(conflictKey)) {
              conflicts.add(conflictKey);
              conflictList.push({
                type: 'room',
                roomNumber: currentEntrantRoom
              });
            }
          }
        }
      }
    });
    
    return conflictList;
  };

  const conflictDetails = getConflictDetails();
  const hasConflicts = conflictDetails.length > 0;

  const timeSlots = generateTimeSlots();

  return (
    <div>      
      {/* Conflict Warning */}
      {hasConflicts && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">
                Scheduling Conflicts Detected
              </h3>
              <div className="mt-2 text-sm text-red-700">
                <ul className="list-disc list-inside space-y-1">
                  {conflictDetails.map((conflict, index) => {
                    if (conflict.type === 'category') {
                      return (
                        <li key={index}>
                          <strong>{conflict.entrantName}</strong> is receiving multiple feedback sessions in the same category ({conflict.category})
                        </li>
                      );
                    } else if (conflict.type === 'entrant') {
                      return (
                        <li key={index}>
                          <strong>{conflict.entrantName}</strong> has overlapping sessions
                        </li>
                      );
                    } else if (conflict.type === 'room') {
                      return (
                        <li key={index}>
                          Room <strong>{conflict.roomNumber}</strong> has overlapping sessions
                        </li>
                      );
                    }
                    return null;
                  })}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
      
      <div>
        <div className="min-w-max">
          {/* Time Header */}
          <div className="flex">
            <div className="w-10 flex-shrink-0"></div> {/* Empty corner */}
            {judges.map((judge) => (
              //Match heights of the judges columns
              <div key={judge.id} className="flex-1 text-center">
                <div 
                  className={`border-2 border-gray-300 text-white p-3 rounded-t-lg cursor-move flex flex-col justify-center relative h-full ${
                    draggedJudgeId === judge.id ? 'opacity-50 scale-95' : ''
                  } ${
                    dragOverJudgeId === judge.id ? 'ring-2 ring-blue-500 ring-opacity-50' : ''
                  }`}
                  style={{ 
                    minHeight: '80px',
                    ...getJudgeBackgroundStyle(judge.category)
                  }}
                  draggable
                  onDragStart={(e) => handleDragStart(e, judge.id)}
                  onDragOver={(e) => handleDragOver(e, judge.id)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, judge.id)}
                  onDragEnd={handleDragEnd}
                >
                  {/* Preference indicator circle */}
                  {(() => {
                    const preference = getJudgePreferenceIndicator(judge.id);
                    return preference ? (
                      <div 
                        className="absolute top-[-10px] left-1 w-6 h-6 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-md"
                        style={{ backgroundColor: preference.color }}
                      >
                        {preference.number}
                      </div>
                    ) : null;
                  })()}
                  
                  <div className="font-semibold">{judge.name} {judge.category && `(${judge.category})`}</div>
                  {settings.moving === "groups" && (
                    <div className="text-xs opacity-90 mt-1 font-semibold">
                      {judge.roomNumber}
                    </div>
                  )}
                  <div className="text-xs opacity-90 mt-1">
                    {(() => {
                      const totalMinutes = getJudgeAssignedTime(judge.id);
                      if (totalMinutes === 0) return 'No sessions';
                      const hours = Math.floor(totalMinutes / 60);
                      const minutes = totalMinutes % 60;
                      return `${hours > 0 ? `${hours}h ` : ''}${minutes > 0 ? `${minutes}m` : ''}`.trim();
                    })()}
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          {/* Time Grid */}
          <div className="flex">
            {/* Time Column */}
            <div className="w-10 flex-shrink-0">
              {timeSlots.map((slot, index) => (
                <div 
                  key={index}
                  className={`border-r-3 border-gray-300 text-xs text-gray-500 ${index % TIME_CONFIG.HOUR_MARKER_INTERVAL != 0 ? 'border-b border-gray-300' : ''}`}
                  style={{ height: `${TIME_CONFIG.SLOT_HEIGHT_PX}px` }}
                >
                  <div className="p-1 text-right">
                    {slot.displayTime}
                  </div>
                </div>
              ))}
            </div>
            
            {/* Judge Columns */}
            {judges.map((judge) => (
              <div 
                key={judge.id} 
                className="flex-1 border-r-3 border-gray-300"
              >
                {timeSlots.map((_, index) => (
                  <div 
                    key={index}
                    className={`relative`}
                    style={{ height: `${TIME_CONFIG.SLOT_HEIGHT_PX}px` }}
                                         onDragOver={(e) => handleSessionDragOverWithPreview(e, judge.id, index)}
                     onDragEnter={(e) => handleSessionDragEnter(e, judge.id, index)}
                     onDragLeave={handleSessionDragLeave}
                     onDrop={(e) => handleSessionDrop(e, judge.id, index)}
                  >
                                         {/* Show scheduled sessions - only in the first slot they occupy */}
                     {scheduledSessions
                       .filter(session => {
                         // Only show session in the first row it occupies
                         const sessionStartRow = session.startRowIndex!;
                         const currentRowIndex = index;
                         return session.judgeId === judge.id && sessionStartRow === currentRowIndex;
                       })
                       .filter(session => {
                         // Only render sessions for entrants that still exist
                         return entrants.find(e => e.id === session.entrantId) !== undefined;
                       })
                                               .map(session => (
                          <SessionBlockComponent
                            key={`${session.id}`}
                            entrant={entrants.find(e => e.id === session.entrantId)!}
                            type={session.type}
                            index={session.sessionIndex}
                            useAbsolutePositioning={true}
                            hasConflict={hasSessionConflict(session)}
                            onSessionTypeChange={handleSessionTypeChange}
                            onDragStart={() => {
                              // Create session data and notify parent
                              const sessionData = {
                                entrantId: session.entrantId,
                                entrantName: session.entrantName,
                                type: session.type,
                                sessionIndex: session.sessionIndex,
                                isRemoving: true // This session is in the grid and can be moved
                              };
                              if (onSessionDragStart) {
                                onSessionDragStart(sessionData);
                              }
                            }}
                          />
                        ))}
                       {/* Show drag preview indicator */}
{dragPreview && 
 dragPreview.judgeId === judge.id && 
 dragPreview.timeSlot === index && (
  <div
    className={`absolute inset-0 border-2 border-dashed ${
      dragPreview.isValid 
        ? 'border-green-500 bg-green-50 bg-opacity-30' 
        : 'border-red-500 bg-red-50 bg-opacity-30'
    } pointer-events-none z-20`}
    style={{
      height: `${getSessionHeight(dragPreview.sessionType, settings)}px`,
      zIndex: 20
    }}
  >
  </div>
)}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
