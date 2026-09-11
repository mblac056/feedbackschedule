import { useState } from 'react';
import type { SessionBlock } from '../types';
import { reorderSessionBlocksByEntrants } from '../utils/localStorage';
import { buildBlocksAfterSessionTypeChange } from '../utils/sessionTypeChange';
import { parseUnscheduleDropPayload } from '../utils/unscheduleDrop';
import { useEntrant } from '../contexts/useEntrant';
import SessionBlockComponent from './SessionBlock';

interface UnassignedSessionsProps {
  allSessionBlocks: SessionBlock[];
  onSessionUnscheduled?: (sessionData: { entrantId: string; type: string; sessionIndex?: number }) => void;
  onSessionBlocksReplace: (blocks: SessionBlock[]) => void;
}

export default function UnassignedSessions({
  allSessionBlocks,
  onSessionUnscheduled,
  onSessionBlocksReplace,
}: UnassignedSessionsProps) {
  const { entrants } = useEntrant();
  const [isDragOver, setIsDragOver] = useState(false);

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

  if (includedEntrants.length === 0) {
    return (
      <div className="mt-8">
        <div className="bg-gray-200 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <div className="text-center text-gray-500 dark:text-gray-400">
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
        className={`bg-gray-200 dark:bg-gray-800 rounded-xl border-2 transition-all duration-200 p-6 ${
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
          <div className="text-center font-semibold mb-4 p-2 bg-gray-300 dark:bg-gray-700 dark:text-gray-100 rounded-lg border-dashed border-2 border-gray-500 dark:border-gray-500">
            Drop here to unschedule session
          </div>
        )}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
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
      </div>
    </div>
  );
}
