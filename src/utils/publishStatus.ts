import type { PublishCredentials } from './publishStorage';
import type { PublishStatus } from './scheduleApi';

export type PublishDisplayState =
  | 'up-to-date'
  | 'out-of-date'
  | 'reserved'
  /** A placeholder is live and there's now a schedule to publish over it. */
  | 'reserved-pending'
  | 'expired'
  | 'changed-elsewhere'
  | 'token-rejected'
  | 'unknown';

/**
 * Works out what to tell the admin about their published code.
 * `server` is the latest status check, or null when it hasn't run or failed (offline, dev).
 */
export function derivePublishState(args: {
  credentials: PublishCredentials;
  currentFingerprint: string | null;
  currentSessionCount: number;
  server: PublishStatus | null;
  now?: number;
}): PublishDisplayState {
  const { credentials, currentFingerprint, currentSessionCount, server } = args;
  const now = args.now ?? Date.now();

  if (server?.state === 'forbidden') return 'token-rejected';
  if (server?.state === 'expired' || server?.state === 'not-found') return 'expired';

  const expiresAt = Date.parse(server?.state === 'live' ? server.expiresAt : credentials.expiresAt ?? '');
  if (Number.isFinite(expiresAt) && expiresAt < now) return 'expired';

  if (server?.state === 'live' && credentials.updatedAt) {
    const serverUpdated = Date.parse(server.updatedAt);
    const localUpdated = Date.parse(credentials.updatedAt);
    if (Number.isFinite(serverUpdated) && Number.isFinite(localUpdated) && serverUpdated > localUpdated) {
      return 'changed-elsewhere';
    }
  }

  if (!credentials.fingerprint || !currentFingerprint) return 'unknown';
  if (credentials.fingerprint !== currentFingerprint) {
    return credentials.publishedSessionCount === 0 && currentSessionCount > 0 ? 'reserved-pending' : 'out-of-date';
  }
  if (currentSessionCount === 0) return 'reserved';
  return 'up-to-date';
}
