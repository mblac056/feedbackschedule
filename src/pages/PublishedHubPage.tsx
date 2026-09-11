import { Link, useParams } from 'react-router-dom';
import PublicScheduleHub from '../components/public/PublicScheduleHub';
import { usePublishedSchedule } from '../hooks/usePublishedSchedule';
import { normalizeCode } from '../utils/publishCodes';

export default function PublishedHubPage() {
  const { code = '' } = useParams<{ code: string }>();
  const { payload, error, loading } = usePublishedSchedule(code);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-950 text-gray-900 dark:text-gray-100 p-6">
        <p>Loading schedule…</p>
      </div>
    );
  }

  if (error || !payload) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-950 text-gray-900 dark:text-gray-100 p-6 gap-4">
        <p className="text-lg" role="alert">
          {error || 'Schedule not found or expired.'}
        </p>
        <Link
          to="/"
          className="text-[var(--primary-color)] hover:underline focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)] rounded"
        >
          Enter a different code
        </Link>
      </div>
    );
  }

  const normalized = normalizeCode(code);
  return <PublicScheduleHub payload={payload} personBasePath={`/${normalized}`} />;
}
