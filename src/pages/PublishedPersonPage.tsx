import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import PublicPersonSchedule from '../components/public/PublicPersonSchedule';
import type { PublishedSchedulePayload } from '../types/publishedSchedule';
import { fetchPublishedSchedule, ScheduleApiError } from '../utils/scheduleApi';
import { normalizeCode } from '../utils/publishCodes';

export default function PublishedPersonPage() {
  const { code = '', personSlug = '' } = useParams<{ code: string; personSlug: string }>();
  const [payload, setPayload] = useState<PublishedSchedulePayload | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    setPayload(null);

    fetchPublishedSchedule(code)
      .then((data) => {
        if (!cancelled) setPayload(data);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof ScheduleApiError && (err.status === 404 || err.status === 400)) {
          setError('Schedule not found or expired.');
        } else {
          setError('Could not load schedule. Please try again.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [code]);

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
  return (
    <PublicPersonSchedule
      payload={payload}
      personSlug={personSlug}
      hubPath={`/${normalized}`}
    />
  );
}
