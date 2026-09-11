import { useEffect, useRef } from 'react';
import type { Judge, SessionBlock, DraggedSessionData } from '../types';
import SessionBlockComponent from './SessionBlock';
import { TIME_CONFIG, getSessionHeight } from '../config/timeConfig';
import { useSettings } from '../contexts/useSettings';
import { useEntrant } from '../contexts/useEntrant';
import { getConflictDetails, getJudgeAssignedTime, getSessionConflictSeverity } from '../utils/scheduleHelpers';
import ConflictBanners from './grid/components/ConflictBanners';
import DragPreviewOverlay from './grid/components/DragPreviewOverlay';
import JudgeColumnHeader from './grid/components/JudgeColumnHeader';
import { useGroupSessionDrag } from './grid/hooks/useGroupSessionDrag';
import { useJudgeColumnReorder } from './grid/hooks/useJudgeColumnReorder';
import { useSessionCellDrop } from './grid/hooks/useSessionCellDrop';
import { useSessionMultiSelect } from './grid/hooks/useSessionMultiSelect';
import { useSessionSwap } from './grid/hooks/useSessionSwap';
import { useSessionTypeChange } from './grid/hooks/useSessionTypeChange';
import { useStartTimeEdit } from './grid/hooks/useStartTimeEdit';
import { generateTimeSlots } from '../utils/timeSlots';

interface GridScheduleProps {
  judges: Judge[];
  onJudgesReorder?: (reorderedJudges: Judge[]) => void;
  onSessionAssigned?: (sessionData: DraggedSessionData) => void;
  draggedSessionData?: DraggedSessionData | null;
  scheduledSessions: SessionBlock[];
  allSessionBlocks: SessionBlock[];
  onSessionBlocksReplace: (blocks: SessionBlock[]) => void;
  onSessionDragStart?: (sessionData: DraggedSessionData) => void;
}

export default function GridSchedule({
  judges,
  onJudgesReorder,
  onSessionAssigned,
  draggedSessionData,
  scheduledSessions,
  allSessionBlocks,
  onSessionBlocksReplace,
  onSessionDragStart,
}: GridScheduleProps) {
  const { settings, setSettings } = useSettings();
  const { selectedEntrant, setSelectedEntrant, entrants } = useEntrant();
  const gridBodyRef = useRef<HTMLDivElement>(null);

  const {
    selectedSessionIds,
    selectionRect,
    isSelectingBlocks,
    handleGridMouseDown,
  } = useSessionMultiSelect({ scheduledSessions, gridBodyRef });

  const { isGroupDragActive, getGroupDragPreview, applyGroupDrop } = useGroupSessionDrag({
    judges,
    scheduledSessions,
    allSessionBlocks,
    settings,
    gridBodyRef,
    onSessionBlocksReplace,
  });

  const {
    isEditingStartTime,
    tempStartTime,
    handleStartTimeClick,
    handleStartTimeChange,
    handleStartTimeBlur,
    handleStartTimeKeyDown,
  } = useStartTimeEdit({ settings, setSettings });

  const {
    draggedJudgeId,
    dragOverJudgeId,
    handleDragStart,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleDragEnd,
  } = useJudgeColumnReorder({ judges, onJudgesReorder });

  const {
    swapCandidateSessionId,
    cancelSwapHover,
    handleScheduledBlockDragEnter,
    handleScheduledBlockDragOver,
    handleScheduledBlockDragEnd,
    handleSessionBlockSwapDrop,
  } = useSessionSwap({
    draggedSessionData,
    scheduledSessions,
    allSessionBlocks,
    settings,
    isGroupDragActive,
    onSessionBlocksReplace,
  });

  const {
    dragPreview,
    setDragPreview,
    handleSessionDrop,
    handleSessionDragEnter,
    handleSessionDragOverWithPreview,
    handleSessionDragLeave,
  } = useSessionCellDrop({
    scheduledSessions,
    allSessionBlocks,
    settings,
    draggedSessionData,
    isGroupDragActive,
    getGroupDragPreview,
    applyGroupDrop,
    onSessionBlocksReplace,
    onSessionAssigned,
    onSwapCancel: cancelSwapHover,
  });

  const { handleSessionTypeChange } = useSessionTypeChange({
    allSessionBlocks,
    entrants,
    onSessionBlocksReplace,
  });

  useEffect(() => {
    if (!selectedEntrant) return;
    if (draggedSessionData?.entrantId === selectedEntrant) return;
    const entrantHasSessions = scheduledSessions.some(
      (session) => session.entrantId === selectedEntrant
    );
    if (!entrantHasSessions) {
      setSelectedEntrant(null);
    }
  }, [selectedEntrant, draggedSessionData, scheduledSessions, setSelectedEntrant]);

  const conflictDetails = getConflictDetails(scheduledSessions, judges, entrants, settings);
  const redConflicts = conflictDetails.filter((conflict) => conflict.severity === 'red');
  const yellowConflicts = conflictDetails.filter((conflict) => conflict.severity === 'yellow');
  const timeSlots = generateTimeSlots(settings.startTime);

  return (
    <div>
      <ConflictBanners redConflicts={redConflicts} yellowConflicts={yellowConflicts} />

      <div>
        <div className="min-w-max mt-4">
          <div className="flex">
            <div className="w-12 flex-shrink-0"></div>
            {judges.map((judge) => (
              <JudgeColumnHeader
                key={judge.id}
                judge={judge}
                selectedEntrant={selectedEntrant}
                entrants={entrants}
                assignedMinutes={getJudgeAssignedTime(judge.id, scheduledSessions, settings)}
                showRoom={settings.moving === 'groups'}
                isDragging={draggedJudgeId === judge.id}
                isDragOver={dragOverJudgeId === judge.id}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onDragEnd={handleDragEnd}
              />
            ))}
          </div>

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
                  height: `${Math.abs(selectionRect.currentY - selectionRect.startY)}px`,
                }}
              />
            )}
            <div className="w-12 flex-shrink-0">
              {timeSlots.map((slot, index) => (
                <div
                  key={index}
                  className={`border-r-2 border-gray-300 dark:border-gray-600 text-xs text-gray-500 dark:text-gray-400 ${
                    index % TIME_CONFIG.HOUR_MARKER_INTERVAL !== 0
                      ? 'border-b border-gray-200 dark:border-gray-700'
                      : 'border-b-2 border-gray-300 dark:border-gray-600'
                  }`}
                  style={{ height: `${TIME_CONFIG.SLOT_HEIGHT_PX}px` }}
                >
                  <div className="p-1 text-right">
                    {index === 0 ? (
                      isEditingStartTime ? (
                        <input
                          type="text"
                          value={tempStartTime}
                          onChange={handleStartTimeChange}
                          onBlur={handleStartTimeBlur}
                          onKeyDown={handleStartTimeKeyDown}
                          className="w-full text-right bg-transparent border-none outline-none text-xs text-gray-700 dark:text-gray-200 font-mono"
                          placeholder="HH:MM"
                          autoFocus
                        />
                      ) : (
                        <button
                          onClick={handleStartTimeClick}
                          className="w-full text-right hover:bg-gray-100 dark:hover:bg-gray-800 rounded px-1 py-0.5 transition-colors cursor-pointer"
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

            {judges.map((judge) => (
              <div
                key={judge.id}
                className="flex-1 border-r-2 border-gray-300 dark:border-gray-600"
                data-judge-column={judge.id}
              >
                {timeSlots.map((_, index) => (
                  <div
                    key={index}
                    className="relative border-b border-gray-200 dark:border-gray-700"
                    style={{ height: `${TIME_CONFIG.SLOT_HEIGHT_PX}px` }}
                    onDragOver={(e) => handleSessionDragOverWithPreview(e, judge.id, index)}
                    onDragEnter={(e) => handleSessionDragEnter(e, judge.id, index)}
                    onDragLeave={handleSessionDragLeave}
                    onDrop={(e) => handleSessionDrop(e, judge.id, index)}
                  >
                    {scheduledSessions
                      .filter((session) => session.judgeId === judge.id && session.startRowIndex === index)
                      .filter((session) => entrants.some((item) => item.id === session.entrantId))
                      .map((session) => {
                        const entrantData = entrants.find((item) => item.id === session.entrantId);
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
                            onDrop={(e) => {
                              handleSessionBlockSwapDrop(e, session);
                              setDragPreview(null);
                            }}
                            isMultiSelected={selectedSessionIds.includes(session.id)}
                            suppressEntrantSelectionOnDrag={
                              selectedSessionIds.length > 1 && selectedSessionIds.includes(session.id)
                            }
                            onDragStart={(e) => {
                              const shouldGroupDrag =
                                selectedSessionIds.length > 1 && selectedSessionIds.includes(session.id);
                              const sessionData: DraggedSessionData = {
                                entrantId: session.entrantId,
                                entrantName: session.entrantName,
                                type: session.type,
                                sessionIndex: session.sessionIndex,
                                sessionId: session.id,
                                isRemoving: true,
                                ...(shouldGroupDrag
                                  ? {
                                      groupSessionIds: [...selectedSessionIds],
                                      groupAnchorSessionId: session.id,
                                    }
                                  : {}),
                              };
                              if (shouldGroupDrag) {
                                e.dataTransfer.setData('application/json', JSON.stringify(sessionData));
                              }
                              onSessionDragStart?.(sessionData);
                            }}
                          />
                        );
                      })}
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
                            zIndex: 20,
                          }}
                        />
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
