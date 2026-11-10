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

/** Days before expiry when the date is shown as a warning. */
export const EXPIRY_WARNING_DAYS = 14;

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

/** Effective expiry: server's answer when we have it, else what we stored at publish. */
export function effectiveExpiresAt(credentials: PublishCredentials, server: PublishStatus | null): string | undefined {
  if (server?.state === 'live' && server.expiresAt) return server.expiresAt;
  return credentials.expiresAt;
}

export function isExpiringSoon(expiresAt: string | undefined, now = Date.now()): boolean {
  const t = Date.parse(expiresAt ?? '');
  return Number.isFinite(t) && t >= now && t - now <= EXPIRY_WARNING_DAYS * 24 * 60 * 60 * 1000;
}

export function formatExpiryDate(expiresAt: string | undefined, now = new Date()): string | null {
  const t = Date.parse(expiresAt ?? '');
  if (!Number.isFinite(t)) return null;
  const d = new Date(t);
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    ...(d.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}),
  });
}
