import type { DragEvent as ReactDragEvent } from 'react';
import type { Entrant, Judge } from '../../../types';
import { getCategoryHeaderClass } from '../../../config/categoryConfig';
import { formatAssignedTimeLabel } from '../../../utils/assignedTimeLabel';
import { getJudgePreferenceIndicator } from '../../../utils/judgePreferenceIndicator';

interface JudgeColumnHeaderProps {
  judge: Judge;
  selectedEntrant: string | null;
  entrants: Entrant[];
  assignedMinutes: number;
  showRoom: boolean;
  isDragging: boolean;
  isDragOver: boolean;
  onDragStart: (e: ReactDragEvent, judgeId: string) => void;
  onDragOver: (e: ReactDragEvent, judgeId: string) => void;
  onDragLeave: () => void;
  onDrop: (e: ReactDragEvent, judgeId: string) => void;
  onDragEnd: () => void;
}

export default function JudgeColumnHeader({
  judge,
  selectedEntrant,
  entrants,
  assignedMinutes,
  showRoom,
  isDragging,
  isDragOver,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
}: JudgeColumnHeaderProps) {
  const preference = getJudgePreferenceIndicator(judge.id, selectedEntrant, entrants);

  return (
    <div className="flex-1 text-center">
      <div
        className={`border-2 border-gray-300 dark:border-gray-600 text-white p-3 rounded-t-lg cursor-move flex flex-col justify-center relative h-full ${getCategoryHeaderClass(judge.category)} ${
          isDragging ? 'opacity-50 scale-95' : ''
        } ${
          isDragOver ? 'ring-2 ring-blue-500 ring-opacity-50' : ''
        }`}
        style={{ minHeight: '80px' }}
        draggable
        onDragStart={(e) => onDragStart(e, judge.id)}
        onDragOver={(e) => onDragOver(e, judge.id)}
        onDragLeave={onDragLeave}
        onDrop={(e) => onDrop(e, judge.id)}
        onDragEnd={onDragEnd}
      >
        {preference ? (
          <div
            className="absolute top-[-10px] left-1 w-6 h-6 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-md"
            style={{ backgroundColor: preference.color }}
          >
            {preference.number}
          </div>
        ) : null}

        <div className="font-semibold">{judge.name} {judge.category && `(${judge.category})`}</div>
        {showRoom && (
          <div className="text-xs opacity-90 mt-1 font-semibold">
            {judge.roomNumber}
          </div>
        )}
        <div className="text-xs opacity-90 mt-1">
          {formatAssignedTimeLabel(assignedMinutes)}
        </div>
      </div>
    </div>
  );
}
