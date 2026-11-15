import { Link, useParams } from 'react-router-dom';
import PublicFlowDocument from '../components/public/PublicFlowDocument';
import PublicPersonSchedule from '../components/public/PublicPersonSchedule';
import { FLOW_DOCUMENT_SLUG } from '../utils/personSlugs';
import { usePublishedSchedule } from '../hooks/usePublishedSchedule';
import { normalizeCode } from '../utils/publishCodes';

export default function PublishedFlowPage() {
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
          to={`/${normalizeCode(code)}`}
          className="text-[var(--primary-color)] hover:underline focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)] rounded"
        >
          Back to schedule
        </Link>
      </div>
    );
  }

  const normalized = normalizeCode(code);
  // Schedules published before "flow" was reserved may have a person with that slug.
  if (payload.slugIndex[FLOW_DOCUMENT_SLUG]) {
    return (
      <PublicPersonSchedule
        payload={payload}
        personSlug={FLOW_DOCUMENT_SLUG}
        hubPath={`/${normalized}`}
      />
    );
  }
  return <PublicFlowDocument payload={payload} hubPath={`/${normalized}`} />;
}
