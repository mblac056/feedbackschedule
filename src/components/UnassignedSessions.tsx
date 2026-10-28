import { useState } from 'react';
import { createPortal } from 'react-dom';
import { RiPushpinFill, RiPushpinLine } from 'react-icons/ri';
import type { SessionBlock } from '../types';
import { reorderSessionBlocksByEntrants } from '../utils/localStorage';
import { buildBlocksAfterSessionTypeChange } from '../utils/sessionTypeChange';
import { parseUnscheduleDropPayload } from '../utils/unscheduleDrop';
import { useEntrant } from '../contexts/useEntrant';
import SessionBlockComponent from './SessionBlock';

const PIN_STORAGE_KEY = 'evalmatrix_unassigned_pinned';
/** Fixed dock height. Also used as scroll clearance so the grid can move out from under the bar. */
const PINNED_BAR_HEIGHT_CLASS = 'h-40';

interface UnassignedSessionsProps {
  allSessionBlocks: SessionBlock[];
  onSessionUnscheduled?: (sessionData: { entrantId: string; type: string; sessionIndex?: number }) => void;
  onSessionBlocksReplace: (blocks: SessionBlock[]) => void;
}

function readPinned(): boolean {
  try {
    return localStorage.getItem(PIN_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

function writePinned(pinned: boolean) {
  try {
    localStorage.setItem(PIN_STORAGE_KEY, String(pinned));
  } catch {
    /* ignore quota / private mode */
  }
}

export default function UnassignedSessions({
  allSessionBlocks,
  onSessionUnscheduled,
  onSessionBlocksReplace,
}: UnassignedSessionsProps) {
  const { entrants } = useEntrant();
  const [isDragOver, setIsDragOver] = useState(false);
  const [isPinned, setIsPinned] = useState(readPinned);

  const togglePinned = () => {
    setIsPinned((pinned) => {
      const next = !pinned;
      writePinned(next);
      return next;
    });
  };

  const handleSessionTypeChange = (
    entrantId: string,
    oldType: '1xLong' | '3x20' | '3x10',
    newType: '1xLong' | '3x20' | '3x10'
  ) => {
    const entrant = entrants.find((item) => item.id === entrantId);
    onSessionBlocksReplace(buildBlocksAfterSessionTypeChange(allSessionBlocks, entrant, oldType, newType));
  };

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
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    const payload = parseUnscheduleDropPayload(e.dataTransfer.getData('application/json'));
    if (payload) {
      onSessionUnscheduled?.(payload);
    }
  };

  const includedEntrants = entrants.filter((entrant) => entrant.includeInSchedule);
  const unassignedSessions = reorderSessionBlocksByEntrants(
    allSessionBlocks.filter((block) => !block.isScheduled),
    entrants
  );

  const pinButton = (
    <button
      type="button"
      onClick={togglePinned}
      aria-pressed={isPinned}
      aria-label={isPinned ? 'Unpin unscheduled sessions' : 'Pin unscheduled sessions to the bottom of the screen'}
      title={isPinned ? 'Unpin' : 'Pin to bottom'}
      className={`absolute top-2 left-2 z-20 rounded-md p-1.5 transition-colors ${
        isPinned
          ? 'bg-[var(--primary-color)] text-white'
          : 'text-gray-600 hover:bg-gray-300 dark:text-gray-300 dark:hover:bg-gray-700'
      }`}
    >
      {isPinned ? <RiPushpinFill className="h-4 w-4" aria-hidden /> : <RiPushpinLine className="h-4 w-4" aria-hidden />}
    </button>
  );

  const sessionGrid = includedEntrants.length === 0 ? (
    <div className="text-center text-gray-500 dark:text-gray-400">
      <p className="text-lg font-medium">Unassigned Sessions</p>
      <p className="text-sm">No entrants included in schedule yet</p>
    </div>
  ) : (
    <div className={`grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 ${isPinned ? 'min-h-0 flex-1 overflow-y-auto pl-8' : 'pl-8'}`}>
      {unassignedSessions.map((sessionBlock) => {
        const actualEntrant = entrants.find((entrant) => entrant.id === sessionBlock.entrantId);
        const entrantData = actualEntrant || {
          id: sessionBlock.entrantId,
          name: sessionBlock.entrantName,
          groupsToAvoid: [],
          preference: null,
          judgePreference1: '',
          judgePreference2: '',
          judgePreference3: '',
          includeInSchedule: true,
        };

        return (
          <SessionBlockComponent
            key={sessionBlock.id}
            entrant={entrantData}
            type={sessionBlock.type}
            index={sessionBlock.sessionIndex}
            sessionId={sessionBlock.id}
            useAbsolutePositioning={false}
            onSessionTypeChange={handleSessionTypeChange}
          />
        );
      })}
    </div>
  );

  const panel = (
    <div
      className={`relative bg-gray-200 dark:bg-gray-800 border-2 transition-all duration-200 ${
        isPinned ? `flex h-full flex-col overflow-hidden p-3 shadow-[0_-8px_24px_rgba(0,0,0,0.18)]` : 'rounded-xl p-6'
      } ${
        isDragOver
          ? 'border-blue-500 bg-blue-50 shadow-lg'
          : 'border-gray-500'
      }`}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {pinButton}
      {isDragOver && (
        <div className="text-center font-semibold mb-4 p-2 bg-gray-300 dark:bg-gray-700 dark:text-gray-100 rounded-lg border-dashed border-2 border-gray-500 dark:border-gray-500">
          Drop here to unschedule session
        </div>
      )}
      {sessionGrid}
    </div>
  );

  if (isPinned) {
    const dock = (
      <div className={`fixed bottom-0 left-0 z-30 w-full ${PINNED_BAR_HEIGHT_CLASS}`}>
        {panel}
      </div>
    );

    return (
      <>
        <div className={PINNED_BAR_HEIGHT_CLASS} aria-hidden />
        {createPortal(dock, document.body)}
      </>
    );
  }

  return (
    <div className="mt-8">
      {panel}
    </div>
  );
}
