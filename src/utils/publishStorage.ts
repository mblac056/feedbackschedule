const KEY = 'evalmatrix_publish_credentials';

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

export function setPublishCredentials(code: string, editToken: string): void {
  localStorage.setItem(KEY, JSON.stringify({ code, editToken }));
}

export function clearPublishCredentials(): void {
  localStorage.removeItem(KEY);
}
