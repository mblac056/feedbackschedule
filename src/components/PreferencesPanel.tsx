import { useEffect, useMemo } from 'react';
import type { Judge, EntrantJudgeAssignments, SessionBlock } from '../types';
import { useEntrant } from '../contexts/useEntrant.ts';
import { useSettings } from '../contexts/useSettings.ts';
import { getCategoryColor } from '../config/categoryConfig';
import { calculateTotalByeLength } from '../utils/printFiles';
import {
  countPreferencePills,
  getAvoidGroupPillStatus,
  getJudgePreferencePillStatus,
  getSessionPreferencePillStatus,
  hasGroupConflict,
} from '../utils/preferencePills';
import { useEntrantReorder } from './preferences/hooks/useEntrantReorder';
import { usePanelResize } from './preferences/hooks/usePanelResize';
import { usePreferenceNotes } from './preferences/hooks/usePreferenceNotes';

interface PreferencesPanelProps {
  judges: Judge[];
  entrantJudgeAssignments?: EntrantJudgeAssignments;
  allSessionBlocks?: SessionBlock[];
  scheduleConflicts?: Array<{
    entrantId: string;
    entrantName: string;
    conflictingGroup: string;
    conflictingEntrantId: string;
    conflictingEntrantName: string;
    timeSlot: string;
  }>;
  onSessionBlocksReplace: (blocks: SessionBlock[]) => void;
  isOpen: boolean;
  onToggle: () => void;
}

const PILL_STATUS_CLASSES = {
  good: 'bg-green-200 dark:bg-green-900/70 text-green-800 dark:text-green-200 border-2 border-green-600 dark:border-green-500',
  conflict: 'bg-red-200 dark:bg-red-900/70 text-red-800 dark:text-red-200 border border-dashed border-red-600 dark:border-red-500',
  unmatched: 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300',
} as const;

const PILL_SWATCH_CLASSES = {
  good: 'bg-green-200 dark:bg-green-800 border-2 border-green-600 dark:border-green-500',
  conflict: 'bg-red-200 dark:bg-red-800 border border-dashed border-red-600 dark:border-red-500',
  unmatched: 'bg-gray-200 dark:bg-gray-600',
} as const;

function formatByeLength(minutes: number): string {
  if (minutes === 0) return '-';
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  let text = '';
  if (hours > 0) {
    text += `${hours}h`;
  }
  if (mins > 0) {
    text += `${hours > 0 ? ' ' : ''}${mins}m`;
  }
  return text || '0m';
}

function JudgePreferencePill({ judge, assigned }: { judge: Judge | undefined; assigned: boolean }) {
  if (!judge) return null;

  return (
    <span
      className={`text-xs px-1.5 py-0.5 rounded-full flex items-center gap-1 ${
        PILL_STATUS_CLASSES[getJudgePreferencePillStatus(assigned)]
      }`}
    >
      {judge.category ? (
        <span
          className="w-2 h-2 rounded-full"
          style={{ backgroundColor: getCategoryColor(judge.category) }}
        />
      ) : null}
      {judge.name}
    </span>
  );
}

export default function PreferencesPanel({
  judges,
  entrantJudgeAssignments,
  allSessionBlocks = [],
  scheduleConflicts,
  onSessionBlocksReplace,
  isOpen,
  onToggle,
}: PreferencesPanelProps) {
  const { entrants, selectedEntrant, setSelectedEntrant } = useEntrant();
  const { settings } = useSettings();
  const { preferenceNotes, handleNotesChange } = usePreferenceNotes();
  const { panelWidth, isDesktopView, isResizing, handleResizePointerDown } = usePanelResize();
  const {
    draggedEntrantId,
    dragOverEntrantId,
    handleDragStart,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleDragEnd,
  } = useEntrantReorder({
    entrants,
    sessionBlocks: allSessionBlocks,
    onSessionBlocksReplace,
  });

  const includedEntrants = useMemo(
    () => entrants.filter((entrant) => entrant.includeInSchedule),
    [entrants]
  );

  const pillCounts = useMemo(
    () =>
      countPreferencePills({
        entrants,
        judges,
        sessionBlocks: allSessionBlocks,
        assignments: entrantJudgeAssignments,
        conflicts: scheduleConflicts,
      }),
    [entrants, judges, allSessionBlocks, entrantJudgeAssignments, scheduleConflicts]
  );

  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }
      if (event.key.toLowerCase() === 'p') {
        onToggle();
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => {
      document.removeEventListener('keydown', handleKeyPress);
    };
  }, [onToggle]);

  const getEntrantByeLength = (entrantId: string): number => {
    const entrantSessions = allSessionBlocks.filter(
      (block) => block.entrantId === entrantId && block.isScheduled && block.startRowIndex !== undefined
    );
    return calculateTotalByeLength(entrantSessions, settings);
  };

  const groupName = (groupId: string) =>
    entrants.find((entrant) => entrant.id === groupId)?.name || 'Unknown Group';

  const isEmpty = includedEntrants.length === 0;

  const panelBodyContent = isEmpty ? (
    <div className="text-center text-gray-500 dark:text-gray-400 py-8">
      <p>No entrants included in schedule yet.</p>
      <p className="text-sm mt-2">Check the "Include" checkbox for entrants in the Entrants modal.</p>
    </div>
  ) : (
    <div className="space-y-4 min-w-0">
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-3">Summary</h3>
        <div className="flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-2">
            <span className={`w-3 h-3 rounded-full ${PILL_SWATCH_CLASSES.good}`}></span>
            <span className="text-green-800 dark:text-green-200 font-medium">{pillCounts.greenCount}</span>
            <span className="text-gray-600 dark:text-gray-400">Good/Assigned</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`w-3 h-3 rounded-full ${PILL_SWATCH_CLASSES.conflict}`}></span>
            <span className="text-red-800 dark:text-red-200 font-medium">{pillCounts.redCount}</span>
            <span className="text-gray-600 dark:text-gray-400">Conflicts</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`w-3 h-3 rounded-full ${PILL_SWATCH_CLASSES.unmatched}`}></span>
            <span className="text-gray-800 dark:text-gray-200 font-medium">{pillCounts.grayCount}</span>
            <span className="text-gray-600 dark:text-gray-400">Unassigned/Mismatched</span>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg" style={{ minWidth: '800px' }}>
          <thead className="bg-gray-50 dark:bg-gray-800/80">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b dark:border-gray-700">
                #
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b dark:border-gray-700">
                Name
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b dark:border-gray-700">
                Groups to Avoid
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b dark:border-gray-700">
                Preference
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b dark:border-gray-700">
                Judge 1
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b dark:border-gray-700">
                Judge 2
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b dark:border-gray-700">
                Judge 3
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b dark:border-gray-700">
                Byes
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {includedEntrants.map((entrant, index) => (
              <tr
                key={entrant.id}
                className={`transition-all duration-200 ${draggedEntrantId === entrant.id ? 'opacity-50 scale-95' : ''
                  } ${dragOverEntrantId === entrant.id ? 'ring-2 ring-blue-500 ring-opacity-50' : ''
                  } ${selectedEntrant === entrant.id ? 'bg-[var(--primary-color)] text-white' : 'text-gray-600 dark:text-gray-300'
                  }`}
                draggable
                onClick={() => setSelectedEntrant(entrant.id)}
                onDragStart={(e) => handleDragStart(e, entrant.id)}
                onDragOver={(e) => handleDragOver(e, entrant.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, entrant.id)}
                onDragEnd={handleDragEnd}
              >
                <td className="px-3 py-2 border-b text-sm cursor-move">
                  {index + 1}
                </td>
                <td className="px-3 py-2 border-b">
                  <span className="font-medium text-sm">{entrant.name}</span>
                </td>
                <td className="px-3 py-2 border-b">
                  {entrant.groupsToAvoid && Array.isArray(entrant.groupsToAvoid) && entrant.groupsToAvoid.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {entrant.groupsToAvoid.map((groupId, groupIndex) => (
                        <span
                          key={groupIndex}
                          className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs ${
                            PILL_STATUS_CLASSES[
                              getAvoidGroupPillStatus(hasGroupConflict(scheduleConflicts, entrant.id, groupId))
                            ]
                          }`}
                        >
                          {groupName(groupId)}
                        </span>
                      ))}
                    </div>
                  )}
                </td>
                <td className="px-3 py-2 border-b">
                  {entrant.preference && (
                    <span
                      className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs ${
                        PILL_STATUS_CLASSES[
                          getSessionPreferencePillStatus(
                            entrant.preference,
                            allSessionBlocks.filter((block) => block.entrantId === entrant.id)
                          ) ?? 'conflict'
                        ]
                      }`}
                    >
                      {entrant.preference}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 border-b">
                  <JudgePreferencePill
                    judge={judges.find((j) => j.id === entrant.judgePreference1)}
                    assigned={Boolean(entrantJudgeAssignments?.[entrant.id]?.includes(entrant.judgePreference1))}
                  />
                </td>
                <td className="px-3 py-2 border-b">
                  <JudgePreferencePill
                    judge={judges.find((j) => j.id === entrant.judgePreference2)}
                    assigned={Boolean(entrantJudgeAssignments?.[entrant.id]?.includes(entrant.judgePreference2))}
                  />
                </td>
                <td className="px-3 py-2 border-b">
                  <JudgePreferencePill
                    judge={judges.find((j) => j.id === entrant.judgePreference3)}
                    assigned={Boolean(entrantJudgeAssignments?.[entrant.id]?.includes(entrant.judgePreference3))}
                  />
                </td>
                <td className="px-3 py-2 border-b">
                  <span className="text-sm font-medium">
                    {formatByeLength(getEntrantByeLength(entrant.id))}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-gray-600 dark:text-gray-400 text-xs text-center">
        Drag rows to reorder entrants to more easily visualize preferences by group priority
      </p>
      <label htmlFor="preference-notes" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
        Notes and Reminders
      </label>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
        These notes will also be included in the Preference Check PDF.
      </p>
      <textarea
        id="preference-notes"
        value={preferenceNotes}
        onChange={handleNotesChange}
        placeholder="Add any notes, reminders, or considerations for the feedback schedule..."
        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-950 text-gray-700 dark:text-gray-200 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm resize-y min-h-[100px]"
        rows={4}
      />
      <div className="flex justify-center">
        <p className="text-gray-600 dark:text-gray-300 text-xs text-center bg-yellow-100 dark:bg-yellow-950/40 p-2 rounded-lg">
          Tip: Toggle this panel using the "P" key.
        </p>
      </div>
    </div>
  );

  const toggleBadge = (
    <button
      onClick={onToggle}
      className={`fixed right-0 top-1/2 -translate-y-1/2 z-40 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 border-r-0 rounded-l-lg shadow px-3 py-2 text-xs font-semibold text-gray-600 dark:text-gray-300 flex flex-col items-center gap-2 transition-opacity duration-300 ${isOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'
        }`}
      aria-label="Open preference panel"
    >
      <span className="flex items-center gap-1">
        <span className={`w-2 h-2 rounded-full ${PILL_SWATCH_CLASSES.good}`}></span>
        <span>{pillCounts.greenCount}</span>
      </span>
      <span className="flex items-center gap-1">
        <span className={`w-2 h-2 rounded-full ${PILL_SWATCH_CLASSES.conflict}`}></span>
        <span>{pillCounts.redCount}</span>
      </span>
      <span className="flex items-center gap-1">
        <span className={`w-2 h-2 rounded-full ${PILL_SWATCH_CLASSES.unmatched}`}></span>
        <span>{pillCounts.grayCount}</span>
      </span>
    </button>
  );

  return (
    <>
      {toggleBadge}

      <div
        className={`flex-shrink-0 self-stretch z-50 transition-[width] ease-in-out ${isResizing ? 'duration-0' : 'duration-300'} ${isOpen ? 'min-h-full' : 'h-0'}`}
        style={{
          width: isOpen ? (isDesktopView ? `${panelWidth}px` : '100vw') : '0px',
        }}
      >
        {isOpen &&
          <div className="relative flex h-full min-h-full flex-col bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700 shadow-lg">
            {isDesktopView && (
              <button
                type="button"
                onPointerDown={handleResizePointerDown}
                className="absolute left-0 top-0 z-10 hidden h-full w-3 -translate-x-1/2 cursor-col-resize items-center justify-center lg:flex"
                aria-label="Resize preference panel"
              >
                <span className={`h-16 w-1 rounded-full transition-colors ${isResizing ? 'bg-[var(--primary-color)]' : 'bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500'}`} />
              </button>
            )}
            <div className="bg-[var(--primary-color)] text-white px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Evaluation Preferences</h2>
              <button
                onClick={onToggle}
                aria-label="Close preference panel"
              >
                <svg className="w-5 h-5 hover:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto overflow-x-auto p-6 flyout-panel">
              {panelBodyContent}
            </div>
          </div>
        }
      </div>
    </>
  );
}
