import type { PublishedSchedulePayload } from '../types/publishedSchedule';
import type { SessionSettings } from '../config/timeConfig';
import { buildPublishedPayload } from './buildPublishedPayload';
import { getEntrants, getJudges, getSessionBlocks, getSettings } from './localStorage';
import { setPublishCredentials } from './publishStorage';
import { putPublishedSchedule, ScheduleApiError, type PublishResult } from './scheduleApi';
import { generateCode, generateEditToken } from './publishCodes';
import { fingerprintPayload } from './publishFingerprint';
import { invalidatePublishedScheduleCache } from './publishedScheduleCache';

const MAX_COLLISION_RETRIES = 5;

/** Saves credentials plus what the server confirmed, so the status line can compare later. */
export async function recordPublish(
  code: string,
  editToken: string,
  payload: PublishedSchedulePayload,
  result: PublishResult
): Promise<boolean> {
  let fingerprint: string | undefined;
  try {
    fingerprint = await fingerprintPayload(payload);
  } catch {
    fingerprint = undefined;
  }
  return setPublishCredentials(code, editToken, {
    updatedAt: result.updatedAt,
    expiresAt: result.expiresAt,
    fingerprint,
    publishedSessionCount: payload.sessions.length,
  });
}

/** The public payload for what's saved in this browser right now. */
export function buildCurrentPayload(): PublishedSchedulePayload {
  window.dispatchEvent(new Event('evalmatrix:flush-persist'));
  return buildPublishedPayload({
    judges: getJudges(),
    entrants: getEntrants(),
    sessionBlocks: getSessionBlocks(),
    settings: getSettings(),
  });
}

/** An empty schedule carrying only the round name and timing settings ("coming soon"). */
export function buildPlaceholderPayload(settings: SessionSettings): PublishedSchedulePayload {
  return buildPublishedPayload({ judges: [], entrants: [], sessionBlocks: [], settings });
}

/** Mints a fresh code + token, publishes `payload` to it, and saves the credentials. */
export async function publishWithNewCode(
  payload: PublishedSchedulePayload = buildCurrentPayload(),
  prefix: string | undefined = getSettings().codePrefix
): Promise<string> {
  let lastError: unknown;

  for (let attempt = 0; attempt < MAX_COLLISION_RETRIES; attempt++) {
    const code = generateCode(prefix);
    const editToken = generateEditToken();
    try {
      const result = await putPublishedSchedule(code, editToken, payload);
      if (!(await recordPublish(code, editToken, payload, result))) {
        throw new Error('Published, but this browser could not save the edit token. Export a backup with credentials immediately.');
      }
      invalidatePublishedScheduleCache(code);
      return code;
    } catch (err) {
      lastError = err;
      if (err instanceof ScheduleApiError && (err.status === 403 || err.status === 409)) {
        continue;
      }
      throw err;
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Could not publish: too many code collisions');
}
