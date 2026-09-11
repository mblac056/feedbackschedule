const KEY = 'evalmatrix_publish_credentials';

function notifyPersist(ok: boolean, quotaExceeded = false): void {
  window.dispatchEvent(
    new CustomEvent(ok ? 'evalmatrix:persist-ok' : 'evalmatrix:persist-failed', {
      detail: { operation: 'publishCredentials', quotaExceeded },
    })
  );
}

function isQuotaExceeded(error: unknown): boolean {
  return (
    error instanceof DOMException &&
    (error.name === 'QuotaExceededError' || error.code === 22 || error.code === 1014)
  );
}

export function getPublishCredentials(): { code: string; editToken: string } | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { code?: string; editToken?: string };
    if (!parsed.code || !parsed.editToken) return null;
    return { code: parsed.code, editToken: parsed.editToken };
  } catch {
    return null;
  }
}

export function setPublishCredentials(code: string, editToken: string): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify({ code, editToken }));
    notifyPersist(true);
    return true;
  } catch (error) {
    notifyPersist(false, isQuotaExceeded(error));
    return false;
  }
}

export function clearPublishCredentials(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
