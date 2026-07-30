import { useEffect, useRef } from 'react';
import type { ActiveSessionCountdown } from './useActiveSessionCountdown';
import type { PersonScheduleRow } from '../utils/publishedPersonSchedule';
import { playDoneTone, playWarningTone } from '../utils/sessionAlertAudio';

const FIVE_MINUTES_SECONDS = 5 * 60;
const TWO_MINUTES_SECONDS = 2 * 60;

function sessionKey(session: PersonScheduleRow): string {
  return `${session.startTime}-${session.endTime}-${session.counterpart}-${session.sessionType}`;
}

/** Warning threshold: 2 min for 3x10, 5 min for 3x20 / 1xLong. */
export function getWarningThresholdSeconds(sessionType: string): number {
  return sessionType === '3x10' ? TWO_MINUTES_SECONDS : FIVE_MINUTES_SECONDS;
}

type SessionAlertState = {
  key: string;
  remainingSeconds: number;
  warningHandled: boolean;
};

/**
 * Plays Web Audio warning/done tones for judge schedules when thresholds are crossed.
 * Missed crossings while muted (or on first observation) are not replayed.
 */
export function useSessionAlertSounds(
  countdown: ActiveSessionCountdown | null,
  enabled: boolean,
  isJudge: boolean
): void {
  const previousRef = useRef<SessionAlertState | null>(null);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  useEffect(() => {
    if (!isJudge) {
      previousRef.current = null;
      return;
    }

    const previous = previousRef.current;
    const soundsOn = enabledRef.current;

    if (!countdown) {
      if (previous) {
        if (soundsOn) {
          void playDoneTone();
        }
        previousRef.current = null;
      }
      return;
    }

    const key = sessionKey(countdown.session);
    const threshold = getWarningThresholdSeconds(countdown.session.sessionType);
    const remaining = countdown.remainingSeconds;

    // New session (or first observation): baseline silently; never retroactively warn.
    if (!previous || previous.key !== key) {
      if (previous && soundsOn) {
        void playDoneTone();
      }

      previousRef.current = {
        key,
        remainingSeconds: remaining,
        warningHandled: remaining <= threshold,
      };
      return;
    }

    // Same session: fire warning only on a real crossing while sounds are on.
    if (!previous.warningHandled && previous.remainingSeconds > threshold && remaining <= threshold) {
      if (soundsOn) {
        void playWarningTone();
      }
      previousRef.current = {
        key,
        remainingSeconds: remaining,
        warningHandled: true,
      };
      return;
    }

    // Already at/past threshold while muted (or staying there): mark handled so enable doesn't replay.
    if (!previous.warningHandled && remaining <= threshold) {
      previousRef.current = {
        key,
        remainingSeconds: remaining,
        warningHandled: true,
      };
      return;
    }

    previousRef.current = {
      key,
      remainingSeconds: remaining,
      warningHandled: previous.warningHandled,
    };
  }, [countdown, enabled, isJudge]);
}
