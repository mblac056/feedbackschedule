import type { ConflictDetail } from '../../../utils/scheduleHelpers';

interface ConflictBannersProps {
  redConflicts: ConflictDetail[];
  yellowConflicts: ConflictDetail[];
}

export default function ConflictBanners({ redConflicts, yellowConflicts }: ConflictBannersProps) {
  return (
    <>
      {redConflicts.length > 0 && (
        <div className="mb-4 p-4 rounded-lg bg-red-50 border border-red-200">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">
                Critical Scheduling Conflicts
              </h3>
              <div className="mt-2 text-sm text-red-700">
                <ul className="list-disc list-inside space-y-1">
                  {redConflicts.map((conflict, index) => {
                    if (conflict.type === 'entrant') {
                      return (
                        <li key={`red-entrant-${index}`}>
                          <strong>{conflict.entrantName}</strong> has overlapping sessions
                        </li>
                      );
                    }
                    if (conflict.type === 'room') {
                      return (
                        <li key={`red-room-${index}`}>
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

      {yellowConflicts.length > 0 && (
        <div className="mb-4 p-4 rounded-lg bg-yellow-50 border border-yellow-200">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">
                Scheduling Alerts
              </h3>
              <div className="mt-2 text-sm text-yellow-700">
                <ul className="list-disc list-inside space-y-1">
                  {yellowConflicts.map((conflict, index) => {
                    if (conflict.type === 'category') {
                      return (
                        <li key={`yellow-category-${index}`}>
                          <strong>{conflict.entrantName}</strong> is receiving multiple feedback sessions in the same category ({conflict.category})
                        </li>
                      );
                    }
                    if (conflict.type === 'late') {
                      return (
                        <li key={`yellow-late-${index}`}>
                          Sessions ending after 1am for: <strong>{conflict.entrantName}</strong>
                        </li>
                      );
                    }
                    if (conflict.type === 'room') {
                      return (
                        <li key={`yellow-room-${index}`}>
                          Room <strong>{conflict.roomNumber}</strong> has overlapping 3x10 sessions
                        </li>
                      );
                    }
                    if (conflict.type === 'unpaddedChorusChange') {
                      return (
                        <li key={`yellow-unpadded-${index}`}>
                          Room <strong>{conflict.roomNumber}</strong> may need transition time added before group <strong>{conflict.entrantName}</strong>
                        </li>
                      );
                    }
                    if (conflict.type === 'judgeOvertime') {
                      const hours = Math.floor(conflict.totalMinutes / 60);
                      const minutes = conflict.totalMinutes % 60;
                      const formattedDuration = [
                        hours > 0 ? `${hours}h` : null,
                        minutes > 0 ? `${minutes}m` : null
                      ]
                        .filter(Boolean)
                        .join(' ');
                      return (
                        <li key={`yellow-judgeOvertime-${index}`}>
                          Judge <strong>{conflict.judgeName}</strong> is scheduled for {formattedDuration || `${conflict.totalMinutes}m`} of sessions
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
    </>
  );
}
