import { fetchPublishedSchedule, putPublishedSchedule } from './scheduleApi';
import { fingerprintPayload } from './publishFingerprint';
import { updatePublishMeta } from './publishStorage';
import { invalidatePublishedScheduleCache } from './publishedScheduleCache';

/**
 * Resets the 90-day clock without changing what attendees see: fetches the live
 * schedule and publishes the same data back. Works even when local edits differ
 * from what's live. Returns the new expiry (ISO) when the server reports one.
 *
 * Throws ScheduleApiError 404 when the code has expired (Publish restores it instead)
 * and 403 when this browser's token doesn't own the code.
 */
export async function renewPublishedSchedule(code: string, editToken: string): Promise<string | undefined> {
  const live = await fetchPublishedSchedule(code);
  const result = await putPublishedSchedule(code, editToken, live);
  let fingerprint: string | undefined;
  try {
    fingerprint = await fingerprintPayload(live);
  } catch {
    fingerprint = undefined;
  }
  // The stored fingerprint now describes what's live, so local edits still show as out of date.
  updatePublishMeta(code, {
    updatedAt: result.updatedAt,
    expiresAt: result.expiresAt,
    ...(fingerprint ? { fingerprint } : {}),
    publishedSessionCount: live.sessions.length,
  });
  invalidatePublishedScheduleCache(code);
  return result.expiresAt;
}
