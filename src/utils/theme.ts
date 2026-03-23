/** Persisted UI theme; key mirrors evalmatrix_* localStorage naming. */
export const THEME_STORAGE_KEY = 'evalmatrix_theme';

export type ThemePreference = 'light' | 'dark';

export function getStoredTheme(): ThemePreference {
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY);
    return v === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

export function setStoredTheme(theme: ThemePreference): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    /* ignore quota / private mode */
  }
}

export function applyThemeToDocument(theme: ThemePreference): void {
  document.documentElement.classList.toggle('dark', theme === 'dark');
}
