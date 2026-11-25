import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { RiLayoutMasonryFill } from 'react-icons/ri';
import type { PublishedSchedulePayload } from '../../types/publishedSchedule';
import { buildFlowDocumentFromPayload } from '../../utils/flowDocument';
import { getFlowTimeline, type FlowEntryStatus } from '../../utils/flowTimeline';
import { formatTimeForDisplay } from '../../utils/printHelpers';
import type { TimeFormat } from '../../config/timeConfig';
import MaskIcon from './MaskIcon';
import ScheduleQrButton from './ScheduleQrButton';

type Props = {
  payload: PublishedSchedulePayload;
  hubPath: string;
  showBackToCreate?: boolean;
};

const TICK_MS = 15_000;

/** `?now=14:20` pins the clock, so organisers can check how the page looks mid-event. */
function parseNowOverride(value: string | null): Date | null {
  const match = value?.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const date = new Date();
  date.setHours(Number(match[1]) % 24, Number(match[2]), 0, 0);
  return date;
}

function useNow(override: Date | null): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (override) return;
    const id = window.setInterval(() => setNow(new Date()), TICK_MS);
    return () => window.clearInterval(id);
  }, [override]);
  return override ?? now;
}

function formatClock(minutes: number, timeFormat: TimeFormat = '24h'): string {
  const whole = Math.floor(minutes);
  const h = Math.floor(whole / 60) % 24;
  const m = whole % 60;
  return formatTimeForDisplay(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`, timeFormat);
}

function formatIn(minutes: number): string {
  if (minutes <= 1) return 'in 1 min';
  if (minutes < 60) return `in ${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `in ${h} h ${m} min` : `in ${h} h`;
}

const ENTRY_STYLES: Record<FlowEntryStatus, { card: string; time: string; text: string }> = {
  idle: {
    card: 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900',
    time: 'text-gray-900 dark:text-gray-100',
    text: 'text-gray-800 dark:text-gray-200',
  },
  past: {
    card: 'border-transparent bg-transparent',
    time: 'text-gray-400 dark:text-gray-600',
    text: 'text-gray-400 dark:text-gray-600',
  },
  now: {
    card: 'border-[var(--primary-color)] border-2 bg-white dark:bg-gray-900 shadow-md',
    time: 'text-[var(--primary-color)] text-lg',
    text: 'text-gray-900 dark:text-gray-50 text-base font-medium',
  },
  next: {
    card: 'border-gray-400 dark:border-gray-500 bg-white dark:bg-gray-900 shadow-sm',
    time: 'text-gray-900 dark:text-gray-100',
    text: 'text-gray-900 dark:text-gray-100',
  },
  later: {
    card: 'border-gray-200 dark:border-gray-800 bg-white/70 dark:bg-gray-900/60',
    time: 'text-gray-600 dark:text-gray-400',
    text: 'text-gray-600 dark:text-gray-400',
  },
};

export default function PublicFlowDocument({ payload, hubPath, showBackToCreate = false }: Props) {
  const [searchParams] = useSearchParams();
  const nowParam = searchParams.get('now');
  const override = useMemo(() => parseNowOverride(nowParam), [nowParam]);
  const now = useNow(override);

  const entries = useMemo(() => buildFlowDocumentFromPayload(payload), [payload]);
  const timeline = getFlowTimeline(entries, payload.settings.startTime, now);
  const roundName = payload.exportName?.trim();

  // Bring the current spot into view once when the page opens mid-event.
  const markerRef = useRef<HTMLDivElement | null>(null);
  const scrolledRef = useRef(false);
  useEffect(() => {
    if (!timeline.live || scrolledRef.current || !markerRef.current) return;
    scrolledRef.current = true;
    markerRef.current.scrollIntoView({ block: 'center' });
  }, [timeline.live]);

  const marker = timeline.live && (
    <div ref={markerRef} className="flex items-center gap-3 py-1" aria-live="polite">
      <span className="h-px flex-1 bg-red-500/70" aria-hidden />
      <span className="text-xs font-semibold uppercase tracking-wide text-red-600 dark:text-red-400 whitespace-nowrap">
        Now · {formatClock(timeline.nowMinutes, payload.settings.timeFormat)}
        {timeline.minutesUntilNext !== undefined && (
          <span className="font-normal normal-case tracking-normal">
            {' '}· next {formatIn(timeline.minutesUntilNext)}
          </span>
        )}
      </span>
      <span className="h-px flex-1 bg-red-500/70" aria-hidden />
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      <div className="max-w-2xl mx-auto px-4 py-8 flex flex-col gap-6">
        <header className="flex flex-col gap-2">
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
                <MaskIcon src="/icons/icon-refresh.png" className="w-[1.125rem] h-[1.125rem]" />
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
            Flow Document{roundName ? ` - ${roundName}` : ''}
          </h1>
        </header>

        {entries.length === 0 ? (
          <p className="text-gray-600 dark:text-gray-400 text-sm">No sessions scheduled.</p>
        ) : (
          <ol className="flex flex-col gap-2">
            {entries.map((entry, index) => {
              const status = timeline.statuses[index];
              const style = ENTRY_STYLES[status];
              return (
                <li key={entry.time} className="flex flex-col gap-2">
                  {index === timeline.markerIndex && marker}
                  <section
                    className={`rounded-lg border px-4 py-3 transition-colors ${style.card}`}
                    aria-current={status === 'now' ? 'time' : undefined}
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <h2 className={`font-mono font-bold tabular-nums ${style.time}`}>
                        {formatTimeForDisplay(entry.time, payload.settings.timeFormat)}
                      </h2>
                      {status === 'now' && (
                        <span className="text-xs font-semibold uppercase tracking-wide text-white bg-[var(--primary-color)] rounded px-2 py-0.5">
                          Happening now
                        </span>
                      )}
                      {status === 'next' && (
                        <span className="text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300">
                          Up next
                        </span>
                      )}
                    </div>
                    <ul
                      className={`mt-1 text-sm divide-y divide-gray-200 dark:divide-gray-800 ${style.text}`}
                    >
                      {entry.events.map((event, eventIndex) => (
                        <li key={eventIndex} className="py-1.5 first:pt-0.5 last:pb-0">
                          {event}
                        </li>
                      ))}
                    </ul>
                  </section>
                </li>
              );
            })}
            {timeline.markerIndex === entries.length && <li>{marker}</li>}
          </ol>
        )}
      </div>
    </div>
  );
}
