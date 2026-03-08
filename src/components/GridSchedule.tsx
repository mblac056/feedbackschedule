import { useState, useEffect, useRef } from 'react';
import type { DragEvent as ReactDragEvent } from 'react';
import type { Judge, Entrant, SessionBlock, DraggedSessionData } from '../types';
import { saveSettings } from '../utils/localStorage';
import SessionBlockComponent from './SessionBlock';
import { TIME_CONFIG, getSessionHeight } from '../config/timeConfig';
import { useSettings } from '../contexts/useSettings';
import { useEntrant } from '../contexts/useEntrant';
import { getCategoryColor } from '../config/categoryConfig';
import ConflictBanners from './grid/components/ConflictBanners';
import DragPreviewOverlay from './grid/components/DragPreviewOverlay';
import { useGroupSessionDrag } from './grid/hooks/useGroupSessionDrag';
import { useSessionMultiSelect } from './grid/hooks/useSessionMultiSelect';
import type { DragPreview } from './grid/types';
import {
  buildSessionSwapUpdates,
  buildEntrantSwapUpdates,
  getConflictDetails,
  getJudgeAssignedTime,
  getSessionConflictSeverity,
  hasTimeConflict
} from '../utils/scheduleHelpers';
interface GridScheduleProps {
  judges: Judge[];
  onJudgesReorder?: (reorderedJudges: Judge[]) => void;
  onSessionAssigned?: (sessionData: DraggedSessionData) => void;
  draggedSessionData?: DraggedSessionData | null; 
  scheduledSessions: SessionBlock[];
  allSessionBlocks: SessionBlock[];
  onSessionBlockUpdate: (sessionBlock: SessionBlock) => void;
  onSessionBlockRemove: (sessionBlockId: string) => void;
  onSessionDragStart?: (sessionData: DraggedSessionData) => void; // Add callback for drag start
}


export default function GridSchedule({ judges, onJudgesReorder, onSessionAssigned, draggedSessionData, scheduledSessions, allSessionBlocks, onSessionBlockUpdate, onSessionBlockRemove, onSessionDragStart }: GridScheduleProps) {
  const { settings, setSettings } = useSettings();
  const { selectedEntrant, setSelectedEntrant, entrants: contextEntrants } = useEntrant();
  const [draggedJudgeId, setDraggedJudgeId] = useState<string | null>(null);
  const [dragOverJudgeId, setDragOverJudgeId] = useState<string | null>(null);
  const [dragPreview, setDragPreview] = useState<DragPreview | null>(null);
  const [isEditingStartTime, setIsEditingStartTime] = useState(false);
  const [tempStartTime, setTempStartTime] = useState(settings.startTime);
  const [swapCandidateSessionId, setSwapCandidateSessionId] = useState<string | null>(null);
  const swapHoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSwapSessionIdRef = useRef<string | null>(null);
  const gridBodyRef = useRef<HTMLDivElement>(null);
  const SWAP_HOVER_TIMEOUT = 1000; // 1 second

  const entrants: Entrant[] = contextEntrants;
  const {
    selectedSessionIds,
    selectionRect,
    isSelectingBlocks,
    handleGridMouseDown
  } = useSessionMultiSelect({ scheduledSessions, gridBodyRef });
  const {
    isGroupDragActive,
    getGroupDragPreview,
    applyGroupDrop
  } = useGroupSessionDrag({
    judges,
    scheduledSessions,
    settings,
    gridBodyRef,
    onSessionBlockUpdate
  });

  // Update temp start time when settings change
  useEffect(() => {
    setTempStartTime(settings.startTime);
  }, [settings.startTime]);

  // Handle start time editing
  const handleStartTimeClick = () => {
    setIsEditingStartTime(true);
  };

  const handleStartTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTempStartTime(e.target.value);
  };

  const handleStartTimeBlur = () => {
    // Validate time format (HH:MM)
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (timeRegex.test(tempStartTime)) {
      // Update settings
      const newSettings = { ...settings, startTime: tempStartTime };
      setSettings(newSettings);
      saveSettings(newSettings);
    } else {
      // Reset to original value if invalid
      setTempStartTime(settings.startTime);
    }
    setIsEditingStartTime(false);
  };

  const handleStartTimeKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleStartTimeBlur();
    } else if (e.key === 'Escape') {
      setTempStartTime(settings.startTime);
      setIsEditingStartTime(false);
    }
  };

  useEffect(() => {
    if (!selectedEntrant) {
      return;
    }

    const isSelectedEntrantBeingDragged = draggedSessionData?.entrantId === selectedEntrant;
    if (isSelectedEntrantBeingDragged) {
      return;
    }

    const entrantHasSessions = scheduledSessions.some(
      session => session.entrantId === selectedEntrant
    );

    if (!entrantHasSessions) {
      setSelectedEntrant(null);
    }
  }, [selectedEntrant, draggedSessionData, scheduledSessions, setSelectedEntrant]);

  // Note: Session type validation is now handled at the App.tsx level when regenerating session blocks
  // The GridSchedule component now relies entirely on the SessionBlocks provided to it


  // Clear drag preview when drag ends
  useEffect(() => {
    if (!draggedSessionData) {
      setDragPreview(null);
      setSwapCandidateSessionId(null);
      if (swapHoverTimeoutRef.current) {
        clearTimeout(swapHoverTimeoutRef.current);
        swapHoverTimeoutRef.current = null;
      }
      pendingSwapSessionIdRef.current = null;
    }
  }, [draggedSessionData]);

  useEffect(() => {
    return () => {
      if (swapHoverTimeoutRef.current) {
        clearTimeout(swapHoverTimeoutRef.current);
      }
      swapHoverTimeoutRef.current = null;
      pendingSwapSessionIdRef.current = null;
    };
  }, []);

  const startSwapHoverTimer = (sessionId: string) => {
    setSwapCandidateSessionId((current) => (current === sessionId ? current : null));

    if (swapHoverTimeoutRef.current) {
      if (pendingSwapSessionIdRef.current === sessionId) {
        return;
      }
      clearTimeout(swapHoverTimeoutRef.current);
      swapHoverTimeoutRef.current = null;
      pendingSwapSessionIdRef.current = null;
    }

    pendingSwapSessionIdRef.current = sessionId;
    swapHoverTimeoutRef.current = setTimeout(() => {
      setSwapCandidateSessionId(sessionId);
      swapHoverTimeoutRef.current = null;
      pendingSwapSessionIdRef.current = null;
    }, SWAP_HOVER_TIMEOUT);
  };

  const cancelSwapHover = (sessionId?: string) => {
    if (swapHoverTimeoutRef.current) {
      if (!sessionId || pendingSwapSessionIdRef.current === sessionId) {
        clearTimeout(swapHoverTimeoutRef.current);
        swapHoverTimeoutRef.current = null;
        pendingSwapSessionIdRef.current = null;
      }
    }
    if (!sessionId) {
      setSwapCandidateSessionId(null);
    } else {
      setSwapCandidateSessionId((current) => (current === sessionId ? null : current));
    }
  };

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
  const handleDragStart = (e: ReactDragEvent, judgeId: string) => {
    setDraggedJudgeId(judgeId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', judgeId);
  };

  const handleDragOver = (e: ReactDragEvent, judgeId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggedJudgeId && draggedJudgeId !== judgeId) {
      setDragOverJudgeId(judgeId);
    }
  };

  const handleDragLeave = () => {
    setDragOverJudgeId(null);
  };

  const handleDrop = (e: ReactDragEvent, targetJudgeId: string) => {
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
  const handleSessionDrop = (e: ReactDragEvent, judgeId: string, timeSlot: number) => {
    e.preventDefault();
    cancelSwapHover();
    
    try {
      const sessionData = e.dataTransfer.getData('application/json');
      if (sessionData) {
        const draggedSession: DraggedSessionData = JSON.parse(sessionData);

        if (draggedSession.groupSessionIds && draggedSession.groupSessionIds.length > 1) {
          const wasGroupApplied = applyGroupDrop(judgeId, timeSlot, draggedSession);
          if (!wasGroupApplied) {
            console.warn('Cannot drop session group: invalid location or conflict detected');
          }
          setDragPreview(null);
          return;
        }
        
        // Check for time conflicts before allowing the drop
        if (hasTimeConflict(scheduledSessions, judgeId, timeSlot, draggedSession.type, settings, draggedSession)) {
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
  const handleSessionDragEnter = (e: ReactDragEvent, judgeId: string, timeSlot: number) => {
    cancelSwapHover();
    // Always prevent default for drag operations and show preview
    if (draggedSessionData) {
      e.preventDefault();
      // Use the stored dragged session data instead of trying to get it from the event
      const groupPreview = isGroupDragActive(draggedSessionData)
        ? getGroupDragPreview(judgeId, timeSlot, draggedSessionData)
        : null;
      const isValid = groupPreview
        ? groupPreview.isValid
        : !hasTimeConflict(scheduledSessions, judgeId, timeSlot, draggedSessionData.type, settings, draggedSessionData);
      setDragPreview({
        judgeId,
        timeSlot,
        sessionType: draggedSessionData.type,
        isValid,
        groupShadowFrame: groupPreview?.groupShadowFrame
      });
    }
  };

  // Handle drag over to continuously update preview position
  const handleSessionDragOverWithPreview = (e: ReactDragEvent, judgeId: string, timeSlot: number) => {
    // Always prevent default for drag operations and show preview
    if (draggedSessionData) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      // Update preview position as user drags around
      const groupPreview = isGroupDragActive(draggedSessionData)
        ? getGroupDragPreview(judgeId, timeSlot, draggedSessionData)
        : null;
      const isValid = groupPreview
        ? groupPreview.isValid
        : !hasTimeConflict(scheduledSessions, judgeId, timeSlot, draggedSessionData.type, settings, draggedSessionData);
      setDragPreview({
        judgeId,
        timeSlot,
        sessionType: draggedSessionData.type,
        isValid,
        groupShadowFrame: groupPreview?.groupShadowFrame
      });
    }
  };

// Handle drag leave to clear preview
const handleSessionDragLeave = () => {
  setDragPreview(null);
  cancelSwapHover();
};

  const handleScheduledBlockDragEnter = (_e: ReactDragEvent, targetSession: SessionBlock) => {
    if (isGroupDragActive(draggedSessionData)) {
      cancelSwapHover(targetSession.id);
      return;
    }
    if (!draggedSessionData || draggedSessionData.isRemoving !== true || !draggedSessionData.sessionId) {
      cancelSwapHover(targetSession.id);
      return;
    }
    if (draggedSessionData.sessionId === targetSession.id) {
      cancelSwapHover(targetSession.id);
      return;
    }
    if (draggedSessionData.type !== targetSession.type) {
      cancelSwapHover(targetSession.id);
      return;
    }
    startSwapHoverTimer(targetSession.id);
  };

  const handleScheduledBlockDragOver = (e: ReactDragEvent, targetSession: SessionBlock) => {
    if (isGroupDragActive(draggedSessionData)) return;
    if (!draggedSessionData || draggedSessionData.isRemoving !== true || !draggedSessionData.sessionId) return;
    if (draggedSessionData.sessionId === targetSession.id) return;
    if (draggedSessionData.type !== targetSession.type) return;
    e.preventDefault();
    startSwapHoverTimer(targetSession.id);
  };

  const handleScheduledBlockDragEnd = () => {
    cancelSwapHover();
  };

  const handleSessionBlockSwapDrop = (e: ReactDragEvent, targetSession: SessionBlock) => {
    if (!draggedSessionData || draggedSessionData.isRemoving !== true || !draggedSessionData.sessionId) return;
    if (swapCandidateSessionId !== targetSession.id) return;

    e.preventDefault();
    e.stopPropagation();

    const sourceSession = scheduledSessions.find(session => session.id === draggedSessionData.sessionId);
    if (!sourceSession) {
      cancelSwapHover();
      return;
    }

    const fullTargetSession = scheduledSessions.find(session => session.id === targetSession.id);
    if (!fullTargetSession) {
      cancelSwapHover();
      return;
    }

    if (sourceSession.type !== fullTargetSession.type) {
      cancelSwapHover();
      return;
    }

    const sourceEntrantSessions = allSessionBlocks.filter(
      session => session.entrantId === sourceSession.entrantId && session.type === sourceSession.type
    );

    const targetEntrantSessions = allSessionBlocks.filter(
      session => session.entrantId === fullTargetSession.entrantId && session.type === fullTargetSession.type
    );

    let updatedBlocks = buildEntrantSwapUpdates(
      sourceEntrantSessions,
      targetEntrantSessions,
      settings
    );

    if (updatedBlocks.length === 0) {
      const [updatedSource, updatedTarget] = buildSessionSwapUpdates(
        sourceSession,
        fullTargetSession,
        settings
      );
      updatedBlocks = [updatedSource, updatedTarget];
    }

    updatedBlocks.forEach(updatedSession => {
      onSessionBlockUpdate(updatedSession);
    });
    setSwapCandidateSessionId(null);
    cancelSwapHover();
    setDragPreview(null);
  };

  const handleSessionTypeChange = (entrantId: string, oldType: '1xLong' | '3x20' | '3x10', newType: '1xLong' | '3x20' | '3x10') => {
    const entrantSessionBlocks = allSessionBlocks.filter(block => 
      block.entrantId === entrantId && block.type === oldType
    );
    
    entrantSessionBlocks.forEach(block => {
      onSessionBlockRemove(block.id);
    });
    
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

  const getJudgeBackgroundStyle = (judgeCategory?: 'SNG' | 'MUS' | 'PER') => {
    if (judgeCategory) {
      return { backgroundColor: getCategoryColor(judgeCategory) };
    }
    return { backgroundColor: '#374151' };
  };

  const getJudgePreferenceIndicator = (judgeId: string) => {
    if (!selectedEntrant) {
      return null;
    }

    const entrant = contextEntrants.find(e => e.id === selectedEntrant);
    if (!entrant) {
      return null;
    }

    if (entrant.judgePreference1 === judgeId) {
      return { number: '1', color: '#d97706' };
    } else if (entrant.judgePreference2 === judgeId) {
      return { number: '2', color: '#4b5563' };
    } else if (entrant.judgePreference3 === judgeId) {
      return { number: '3', color: '#92400e' };
    }

    return null;
  };

  const conflictDetails = getConflictDetails(scheduledSessions, judges, entrants, settings);
  const redConflicts = conflictDetails.filter(conflict => conflict.severity === 'red');
  const yellowConflicts = conflictDetails.filter(conflict => conflict.severity === 'yellow');

  const timeSlots = generateTimeSlots();

  return (
    <div>      
      <ConflictBanners redConflicts={redConflicts} yellowConflicts={yellowConflicts} />
      
      <div>
        <div className="min-w-max mt-4">
          {/* Time Header */}
          <div className="flex">
            <div className="w-12 flex-shrink-0"></div> {/* Empty corner */}
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
                      const totalMinutes = getJudgeAssignedTime(judge.id, scheduledSessions, settings);
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
          <div
            ref={gridBodyRef}
            className={`relative flex ${isSelectingBlocks ? 'select-none' : ''}`}
            onMouseDown={handleGridMouseDown}
          >
            <DragPreviewOverlay draggedSessionData={draggedSessionData} dragPreview={dragPreview} />
            {selectionRect && (
              <div
                className="absolute border-2 border-sky-500 bg-sky-200 bg-opacity-30 pointer-events-none z-40"
                style={{
                  left: `${Math.min(selectionRect.startX, selectionRect.currentX)}px`,
                  top: `${Math.min(selectionRect.startY, selectionRect.currentY)}px`,
                  width: `${Math.abs(selectionRect.currentX - selectionRect.startX)}px`,
                  height: `${Math.abs(selectionRect.currentY - selectionRect.startY)}px`
                }}
              />
            )}
            {/* Time Column */}
            <div className="w-12 flex-shrink-0">
              {timeSlots.map((slot, index) => (
                <div 
                  key={index}
                  className={`border-r-2 border-gray-300 text-xs text-gray-500 ${
                    index % TIME_CONFIG.HOUR_MARKER_INTERVAL !== 0
                      ? 'border-b border-gray-200'
                      : 'border-b-2 border-gray-300'
                  }`}
                  style={{ height: `${TIME_CONFIG.SLOT_HEIGHT_PX}px` }}
                >
                  <div className="p-1 text-right">
                    {index === 0 ? (
                      // First time slot - editable start time
                      isEditingStartTime ? (
                        <input
                          type="text"
                          value={tempStartTime}
                          onChange={handleStartTimeChange}
                          onBlur={handleStartTimeBlur}
                          onKeyDown={handleStartTimeKeyDown}
                          className="w-full text-right bg-transparent border-none outline-none text-xs text-gray-700 font-mono"
                          placeholder="HH:MM"
                          autoFocus
                        />
                      ) : (
                        <button
                          onClick={handleStartTimeClick}
                          className="w-full text-right hover:bg-gray-100 rounded px-1 py-0.5 transition-colors cursor-pointer"
                          title="Click to edit start time"
                        >
                          {slot.displayTime}
                        </button>
                      )
                    ) : (
                      slot.displayTime
                    )}
                  </div>
                </div>
              ))}
            </div>
            
            {/* Judge Columns */}
            {judges.map((judge) => (
              <div 
                key={judge.id} 
                className="flex-1 border-r-2 border-gray-300"
                data-judge-column={judge.id}
              >
                {timeSlots.map((_, index) => (
                  <div 
                    key={index}
                    className={`relative border-b border-gray-200`}
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
                       .map(session => {
                          const entrantData = entrants.find(e => e.id === session.entrantId);
                          if (!entrantData) return null;

                          const conflictSeverity = getSessionConflictSeverity(
                            session,
                            scheduledSessions,
                            judges,
                            entrants,
                            settings
                          );

                          return (
                            <SessionBlockComponent
                              key={`${session.id}`}
                              entrant={entrantData}
                              type={session.type}
                              index={session.sessionIndex}
                              sessionId={session.id}
                              useAbsolutePositioning={true}
                              hasConflict={Boolean(conflictSeverity)}
                              conflictSeverity={conflictSeverity ?? undefined}
                              isDragOver={swapCandidateSessionId === session.id}
                              onSessionTypeChange={handleSessionTypeChange}
                              onDragEnter={(e) => handleScheduledBlockDragEnter(e, session)}
                              onDragOver={(e) => handleScheduledBlockDragOver(e, session)}
                              onDragEnd={handleScheduledBlockDragEnd}
                              onDrop={(e) => handleSessionBlockSwapDrop(e, session)}
                              isMultiSelected={selectedSessionIds.includes(session.id)}
                              suppressEntrantSelectionOnDrag={
                                selectedSessionIds.length > 1 && selectedSessionIds.includes(session.id)
                              }
                              onDragStart={(e) => {
                                const shouldGroupDrag =
                                  selectedSessionIds.length > 1 && selectedSessionIds.includes(session.id);

                                // Create session data and notify parent
                                const sessionData: DraggedSessionData = {
                                  entrantId: session.entrantId,
                                  entrantName: session.entrantName,
                                  type: session.type,
                                  sessionIndex: session.sessionIndex,
                                  sessionId: session.id,
                                  isRemoving: true, // This session is in the grid and can be moved
                                  ...(shouldGroupDrag
                                    ? {
                                        groupSessionIds: [...selectedSessionIds],
                                        groupAnchorSessionId: session.id
                                      }
                                    : {})
                                };
                                if (shouldGroupDrag) {
                                  e.dataTransfer.setData('application/json', JSON.stringify(sessionData));
                                }
                                if (onSessionDragStart) {
                                  onSessionDragStart(sessionData);
                                }
                              }}
                            />
                          );
                        })}
                       {/* Show drag preview indicator */}
{dragPreview && 
 !dragPreview.groupShadowFrame &&
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
