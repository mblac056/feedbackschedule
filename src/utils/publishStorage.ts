const KEY = 'evalmatrix_publish_credentials';
export const PUBLISH_CREDENTIALS_CHANGED = 'evalmatrix:publish-credentials-changed';

/** What the server confirmed at the last successful publish (all optional for legacy data). */
export type PublishMeta = {
  /** ISO time of the last publish, from the server. */
  updatedAt?: string;
  /** ISO time the published schedule expires, from the server. */
  expiresAt?: string;
  /** Fingerprint of the public payload at last publish (see publishFingerprint.ts). */
  fingerprint?: string;
  /** Number of sessions in the last published payload. */
  publishedSessionCount?: number;
};

export type PublishCredentials = { code: string; editToken: string } & PublishMeta;

function notifyPersist(ok: boolean, quotaExceeded = false): void {
  window.dispatchEvent(
    new CustomEvent(ok ? 'evalmatrix:persist-ok' : 'evalmatrix:persist-failed', {
      detail: { operation: 'publishCredentials', quotaExceeded },
    })
  );
}

function notifyChanged(): void {
  window.dispatchEvent(new Event(PUBLISH_CREDENTIALS_CHANGED));
}

function isQuotaExceeded(error: unknown): boolean {
  return (
    error instanceof DOMException &&
    (error.name === 'QuotaExceededError' || error.code === 22 || error.code === 1014)
  );
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value !== '' ? value : undefined;
}

/** Validates an unknown value (localStorage or an import file) into credentials, or null. */
export function parsePublishCredentials(value: unknown): PublishCredentials | null {
  if (typeof value !== 'object' || value === null) return null;
  const v = value as Record<string, unknown>;
  if (typeof v.code !== 'string' || typeof v.editToken !== 'string') return null;
  if (v.code.trim() === '' || v.editToken.trim() === '') return null;
  const count = v.publishedSessionCount;
  const meta: PublishMeta = {
    updatedAt: optionalString(v.updatedAt),
    expiresAt: optionalString(v.expiresAt),
    fingerprint: optionalString(v.fingerprint),
    publishedSessionCount:
      typeof count === 'number' && Number.isInteger(count) && count >= 0 ? count : undefined,
  };
  const out: PublishCredentials = { code: v.code, editToken: v.editToken };
  for (const [k, val] of Object.entries(meta)) {
    if (val !== undefined) (out as Record<string, unknown>)[k] = val;
  }
  return out;
}

export function getPublishCredentials(): PublishCredentials | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return parsePublishCredentials(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function setPublishCredentials(code: string, editToken: string, meta: PublishMeta = {}): boolean {
  const value = parsePublishCredentials({ ...meta, code, editToken });
  if (!value) return false;
  try {
    localStorage.setItem(KEY, JSON.stringify(value));
    notifyPersist(true);
    notifyChanged();
    return true;
  } catch (error) {
    notifyPersist(false, isQuotaExceeded(error));
    return false;
  }
}

/** Merges server-confirmed fields into the stored credentials, if they're still for `code`. */
export function updatePublishMeta(code: string, meta: PublishMeta): boolean {
  const current = getPublishCredentials();
  if (!current || current.code !== code) return false;
  return setPublishCredentials(current.code, current.editToken, { ...current, ...meta });
}

export function clearPublishCredentials(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  notifyChanged();
}
