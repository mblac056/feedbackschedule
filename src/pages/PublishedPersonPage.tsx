import { Link, useParams } from 'react-router-dom';
import PublicPersonSchedule from '../components/public/PublicPersonSchedule';
import { usePublishedSchedule } from '../hooks/usePublishedSchedule';
import { normalizeCode } from '../utils/publishCodes';

export default function PublishedPersonPage() {
  const { code = '', personSlug = '' } = useParams<{ code: string; personSlug: string }>();
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
          to={`/${normalizeCode(code)}`}
          className="text-[var(--primary-color)] hover:underline focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)] rounded"
        >
          Back to schedule
        </Link>
      </div>
    );
  }

  const normalized = normalizeCode(code);
  return (
    <PublicPersonSchedule
      payload={payload}
      personSlug={personSlug}
      hubPath={`/${normalized}`}
    />
  );
}
