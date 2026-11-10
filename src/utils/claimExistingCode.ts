import { checkPublishStatus, fetchPublishedSchedule } from './scheduleApi';
import { fingerprintPayload } from './publishFingerprint';
import { isValidNormalizedCode, normalizeCode } from './publishCodes';
import { setPublishCredentials } from './publishStorage';

export type ClaimExistingCodeResult =
  | { outcome: 'saved'; code: string }
  /** Token owns an expired code: saved, and the next Publish restores it. */
  | { outcome: 'saved-expired'; code: string }
  | { outcome: 'invalid-code' }
  | { outcome: 'missing-token' }
  | { outcome: 'wrong-token' }
  | { outcome: 'not-found' }
  | { outcome: 'storage-failed' };

/**
 * Checks a hand-entered code + edit token with the server and, if they match,
 * makes them this browser's publish credentials. Nothing is published.
 */
export async function claimExistingCode(rawCode: string, rawToken: string): Promise<ClaimExistingCodeResult> {
  const code = normalizeCode(rawCode);
  const editToken = rawToken.trim();
  if (!isValidNormalizedCode(code)) return { outcome: 'invalid-code' };
  if (!editToken) return { outcome: 'missing-token' };

  const status = await checkPublishStatus(code, editToken);
  if (status.state === 'forbidden') return { outcome: 'wrong-token' };
  if (status.state === 'not-found') return { outcome: 'not-found' };
  if (status.state === 'expired') {
    return setPublishCredentials(code, editToken) ? { outcome: 'saved-expired', code } : { outcome: 'storage-failed' };
  }

  // Fingerprint what's live so the status line can say whether local data matches it.
  let fingerprint: string | undefined;
  try {
    fingerprint = await fingerprintPayload(await fetchPublishedSchedule(code));
  } catch {
    fingerprint = undefined;
  }
  const saved = setPublishCredentials(code, editToken, {
    updatedAt: status.updatedAt || undefined,
    expiresAt: status.expiresAt || undefined,
    fingerprint,
    publishedSessionCount: status.sessionCount,
  });
  return saved ? { outcome: 'saved', code } : { outcome: 'storage-failed' };
}
