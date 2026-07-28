import { useEffect, useRef, useState } from 'react';
import type { PersonScheduleRow } from '../utils/publishedPersonSchedule';
import {
  findActiveSessionRow,
  formatCountdown,
  getRemainingSeconds,
} from '../utils/sessionCountdown';

const FIVE_MINUTES_SECONDS = 5 * 60;
const TWO_MINUTES_SECONDS = 2 * 60;

export type CountdownUrgency = 'normal' | 'warning' | 'critical';

export interface ActiveSessionCountdown {
  session: PersonScheduleRow;
  remainingSeconds: number;
  formattedRemaining: string;
  urgency: CountdownUrgency;
}

function getCountdownUrgency(remainingSeconds: number): CountdownUrgency {
  if (remainingSeconds <= TWO_MINUTES_SECONDS) return 'critical';
  if (remainingSeconds <= FIVE_MINUTES_SECONDS) return 'warning';
  return 'normal';
}

function sessionKey(session: PersonScheduleRow): string {
  return `${session.startTime}-${session.endTime}-${session.counterpart}`;
}

export function useActiveSessionCountdown(
  rows: PersonScheduleRow[],
  eventStartTime: string
): ActiveSessionCountdown | null {
  const rowsRef = useRef(rows);
  rowsRef.current = rows;

  const [countdown, setCountdown] = useState<ActiveSessionCountdown | null>(() => {
    const session = findActiveSessionRow(rows, eventStartTime);
    if (!session) return null;

    const remainingSeconds = getRemainingSeconds(session, eventStartTime, rows);
    return {
      session,
      remainingSeconds,
      formattedRemaining: formatCountdown(remainingSeconds),
      urgency: getCountdownUrgency(remainingSeconds),
    };
  });

  useEffect(() => {
    const tick = () => {
      const currentRows = rowsRef.current;
      const session = findActiveSessionRow(currentRows, eventStartTime);
      if (!session) {
        setCountdown((prev) => (prev === null ? prev : null));
        return;
      }

      const remainingSeconds = getRemainingSeconds(session, eventStartTime, currentRows);
      const nextKey = sessionKey(session);

      setCountdown((prev) => {
        if (
          prev &&
          prev.remainingSeconds === remainingSeconds &&
          sessionKey(prev.session) === nextKey
        ) {
          return prev;
        }

        return {
          session,
          remainingSeconds,
          formattedRemaining: formatCountdown(remainingSeconds),
          urgency: getCountdownUrgency(remainingSeconds),
        };
      });
    };

    tick();
    const intervalId = window.setInterval(tick, 1000);
    return () => window.clearInterval(intervalId);
  }, [eventStartTime]);

  return countdown;
}
