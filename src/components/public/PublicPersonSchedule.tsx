import { Link } from 'react-router-dom';
import { RiLayoutMasonryFill } from 'react-icons/ri';
import { FiRefreshCcw } from 'react-icons/fi';
import type { PublishedSchedulePayload } from '../../types/publishedSchedule';
import { buildPersonSchedule } from '../../utils/publishedPersonSchedule';
import ScheduleQrButton from './ScheduleQrButton';

type Props = {
  payload: PublishedSchedulePayload;
  personSlug: string;
  hubPath: string;
  showBackToCreate?: boolean;
};

export default function PublicPersonSchedule({ payload, personSlug, hubPath, showBackToCreate = false }: Props) {
  const schedule = buildPersonSchedule(payload, personSlug);

  if (!schedule) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-950 text-gray-900 dark:text-gray-100 p-6 gap-4">
        <Link
          to="/"
          className="flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)] rounded"
          title="Enter a schedule code"
        >
          <RiLayoutMasonryFill className="text-2xl text-[var(--primary-color)]" />
          <span className="text-xl font-bold text-[var(--primary-color)]">Feedback Schedule</span>
        </Link>
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
          {showBackToCreate && (
            <Link
              to="/create"
              className="inline-flex items-center w-fit px-3 py-1.5 text-sm font-medium rounded-lg bg-gray-600 text-white hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 dark:focus:ring-offset-gray-950 transition-colors"
            >
              ← Back to create
            </Link>
          )}
          <div className="flex items-center justify-between gap-3">
            <Link
              to="/"
              className="flex items-center gap-2 min-w-0 focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)] rounded"
              title="Enter a schedule code"
            >
              <RiLayoutMasonryFill className="text-2xl text-[var(--primary-color)] shrink-0" />
              <span className="text-xl font-bold text-[var(--primary-color)] truncate">Feedback Schedule</span>
            </Link>
            <div className="flex items-center gap-2 shrink-0">
              <ScheduleQrButton />
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="p-2 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:text-[var(--primary-color)] hover:border-[var(--primary-color)] focus:ring-2 focus:ring-[var(--primary-color)] focus:ring-offset-2 dark:focus:ring-offset-gray-950 transition-colors"
                aria-label="Refresh"
                title="Refresh"
              >
                <FiRefreshCcw className="text-lg" />
              </button>
            </div>
          </div>
          <Link
            to={hubPath}
            className="text-sm text-[var(--primary-color)] hover:underline focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)] rounded w-fit"
          >
            ← Back to schedule
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
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
                    className={`border-t border-gray-200 dark:border-gray-800 ${
                      row.isBye ? 'bg-gray-50 dark:bg-gray-800/50 text-gray-600 dark:text-gray-400 italic' : ''
                    }`}
                  >
                    <td className="px-3 py-2 whitespace-nowrap font-mono">{row.timeLabel}</td>
                    <td className="px-3 py-2">{row.counterpart}</td>
                    <td className="px-3 py-2">{row.sessionType}</td>
                    {schedule.showRoomColumn && (
                      <td className="px-3 py-2">{row.isBye ? '' : (row.roomNumber ?? '')}</td>
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
