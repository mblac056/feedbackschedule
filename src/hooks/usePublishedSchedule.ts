import { useEffect, useState } from 'react';
import type { PublishedSchedulePayload } from '../types/publishedSchedule';
import { fetchPublishedScheduleCached } from '../utils/publishedScheduleCache';
import { PayloadValidationError } from '../utils/publishedScheduleSchema';
import { ScheduleApiError } from '../utils/scheduleApi';

export function usePublishedSchedule(code: string) {
  const [payload, setPayload] = useState<PublishedSchedulePayload | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    setLoading(true);
    setError('');
    setPayload(null);

    fetchPublishedScheduleCached(code, controller.signal)
      .then((data) => {
        if (!cancelled) setPayload(data);
      })
      .catch((err: unknown) => {
        if (cancelled || controller.signal.aborted) return;
        if (err instanceof PayloadValidationError) {
          setError('This schedule is damaged or from a newer app version.');
        } else if (err instanceof ScheduleApiError && err.status === 422) {
          setError('This schedule is damaged or from a newer app version.');
        } else if (err instanceof ScheduleApiError && (err.status === 404 || err.status === 400)) {
          setError('Schedule not found or expired.');
        } else if (err instanceof ScheduleApiError && err.status === 429) {
          setError('Too many requests. Wait a moment and try again.');
        } else {
          setError('Could not load schedule. Please try again.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [code]);

  return { payload, error, loading };
}
