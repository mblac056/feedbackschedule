import { Link } from 'react-router-dom';
import type { PublishedSchedulePayload } from '../../types/publishedSchedule';
import { buildPersonSchedule } from '../../utils/publishedPersonSchedule';

type Props = {
  payload: PublishedSchedulePayload;
  personSlug: string;
  hubPath: string;
};

export default function PublicPersonSchedule({ payload, personSlug, hubPath }: Props) {
  const schedule = buildPersonSchedule(payload, personSlug);

  if (!schedule) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-950 text-gray-900 dark:text-gray-100 p-6 gap-4">
        <p className="text-lg">Person not found.</p>
        <Link
          to={hubPath}
          className="text-[var(--primary-color)] hover:underline focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)] rounded"
        >
          Back to schedule
        </Link>
      </div>
    );
  }

  const counterpartHeader = schedule.kind === 'entrant' ? 'Judge' : 'Entrant';

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      <div className="max-w-3xl mx-auto px-4 py-8 flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <Link
            to={hubPath}
            className="text-sm text-[var(--primary-color)] hover:underline focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)] rounded w-fit"
          >
            ← Back to schedule
          </Link>
          <h1 className="text-2xl font-bold text-[var(--primary-color)]">
            Feedback Schedule for {schedule.name}
          </h1>
          {schedule.ownRoom && (
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Room: {schedule.ownRoom}
            </p>
          )}
        </div>

        {schedule.rows.length === 0 ? (
          <p className="text-gray-600 dark:text-gray-400 text-sm">No sessions scheduled.</p>
        ) : (
          <div className="overflow-x-auto border border-gray-200 dark:border-gray-800 rounded-lg bg-white dark:bg-gray-900">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="bg-[var(--primary-color)] text-white">
                  <th className="px-3 py-2 font-semibold">Time</th>
                  <th className="px-3 py-2 font-semibold">{counterpartHeader}</th>
                  <th className="px-3 py-2 font-semibold">Session Type</th>
                  {schedule.showRoomColumn && (
                    <th className="px-3 py-2 font-semibold">Room</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {schedule.rows.map((row, index) => (
                  <tr
                    key={`${row.startTime}-${row.counterpart}-${index}`}
                    className="border-t border-gray-200 dark:border-gray-800"
                  >
                    <td className="px-3 py-2 whitespace-nowrap font-mono">{row.timeLabel}</td>
                    <td className="px-3 py-2">{row.counterpart}</td>
                    <td className="px-3 py-2">{row.sessionType}</td>
                    {schedule.showRoomColumn && (
                      <td className="px-3 py-2">{row.roomNumber ?? ''}</td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
