import { RiLayoutMasonryFill } from "react-icons/ri";
import { useState, useCallback } from "react";
import { FaBars, FaTimes } from "react-icons/fa";
import { FiRefreshCcw, FiMoon, FiSun } from "react-icons/fi";
import {
  applyThemeToDocument,
  getStoredTheme,
  setStoredTheme,
  type ThemePreference,
} from "../utils/theme";

interface HeaderProps {
  onOpenJudgesModal: () => void;
  onOpenEntrantsModal: () => void;
  onOpenSettingsModal: () => void;
  onOpenImportExportModal: () => void;
}

export default function Header({ onOpenJudgesModal, onOpenEntrantsModal, onOpenSettingsModal, onOpenImportExportModal }: HeaderProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [theme, setTheme] = useState<ThemePreference>(() => getStoredTheme());

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next: ThemePreference = prev === "dark" ? "light" : "dark";
      setStoredTheme(next);
      applyThemeToDocument(next);
      return next;
    });
  }, []);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  return (
    <div className="bg-white dark:bg-gray-900 shadow-sm border-b border-gray-200 dark:border-gray-700">
      <div className="mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-2">
            <RiLayoutMasonryFill className="text-2xl text-[var(--primary-color)]" />
            <h1 className="text-2xl font-bold text-[var(--primary-color)]">Feedback Schedule</h1>
          </div>
          
          {/* Desktop menu */}
          <div className="hidden md:flex items-center space-x-3">
            <button
              onClick={onOpenEntrantsModal}
              className="px-4 py-2 bg-[var(--primary-color)] text-white rounded-lg hover:bg-[var(--primary-color-dark)] focus:ring-2 focus:ring-[var(--primary-color)] focus:ring-offset-2 dark:focus:ring-offset-gray-900 transition-colors"
            >
              Manage Entrants
            </button>
            <button
              onClick={onOpenJudgesModal}
              className="px-4 py-2 bg-[var(--primary-color)] text-white rounded-lg hover:bg-[var(--primary-color-dark)] focus:ring-2 focus:ring-[var(--primary-color)] focus:ring-offset-2 dark:focus:ring-offset-gray-900 transition-colors"
            >
              Manage Judges
            </button>
            <button
              onClick={onOpenImportExportModal}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-[var(--secondary-color-dark)] focus:ring-2 focus:ring-[var(--secondary-color)] focus:ring-offset-2 dark:focus:ring-offset-gray-900 transition-colors"
              title="Import/Export (Press 'E' for quick export)"
            >
              Import/Export
            </button>
            <button
              onClick={onOpenSettingsModal}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 transition-colors"
            >
              Settings
            </button>
            <button
              type="button"
              onClick={toggleTheme}
              className="p-2 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:text-[var(--primary-color)] hover:border-[var(--primary-color)] focus:ring-2 focus:ring-[var(--primary-color)] focus:ring-offset-2 dark:focus:ring-offset-gray-900 transition-colors"
              aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              title={theme === "dark" ? "Light mode" : "Dark mode"}
              aria-pressed={theme === "dark"}
            >
              {theme === "dark" ? (
                <FiSun className="text-lg" />
              ) : (
                <FiMoon className="text-lg" />
              )}
            </button>
            <button
              onClick={() => window.location.reload()}
              className="p-2 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:text-[var(--primary-color)] hover:border-[var(--primary-color)] focus:ring-2 focus:ring-[var(--primary-color)] focus:ring-offset-2 dark:focus:ring-offset-gray-900 transition-colors"
              aria-label="Refresh"
              title="Refresh"
            >
              <FiRefreshCcw className="text-lg" />
            </button>
          </div>

          {/* Mobile menu button */}
          <button
            onClick={toggleMobileMenu}
            className="md:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="Toggle menu"
          >
            {isMobileMenuOpen ? (
              <FaTimes className="text-xl text-gray-600" />
            ) : (
              <FaBars className="text-xl text-gray-600" />
            )}
          </button>
        </div>

        {/* Mobile menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-gray-200 dark:border-gray-700 py-4">
            <div className="flex flex-col space-y-2">
              <button
                onClick={() => {
                  onOpenEntrantsModal();
                  closeMobileMenu();
                }}
                className="w-full text-left px-4 py-3 bg-[var(--primary-color)] text-white rounded-lg hover:bg-[var(--primary-color-dark)] focus:ring-2 focus:ring-[var(--primary-color)] focus:ring-offset-2 dark:focus:ring-offset-gray-900 transition-colors"
              >
                Manage Entrants
              </button>
              <button
                onClick={() => {
                  onOpenJudgesModal();
                  closeMobileMenu();
                }}
                className="w-full text-left px-4 py-3 bg-[var(--primary-color)] text-white rounded-lg hover:bg-[var(--primary-color-dark)] focus:ring-2 focus:ring-[var(--primary-color)] focus:ring-offset-2 dark:focus:ring-offset-gray-900 transition-colors"
              >
                Manage Judges
              </button>
              <button
                onClick={() => {
                  onOpenImportExportModal();
                  closeMobileMenu();
                }}
                className="w-full text-left px-4 py-3 bg-gray-600 text-white rounded-lg hover:bg-[var(--secondary-color-dark)] focus:ring-2 focus:ring-[var(--secondary-color)] focus:ring-offset-2 dark:focus:ring-offset-gray-900 transition-colors"
              >
                Import/Export
              </button>
              <button
                onClick={() => {
                  onOpenSettingsModal();
                  closeMobileMenu();
                }}
                className="w-full text-left px-4 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 transition-colors"
              >
                Settings
              </button>
              <button
                type="button"
                onClick={() => {
                  toggleTheme();
                  closeMobileMenu();
                }}
                className="w-full text-left px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-200 hover:text-[var(--primary-color)] hover:border-[var(--primary-color)] focus:ring-2 focus:ring-[var(--primary-color)] focus:ring-offset-2 dark:focus:ring-offset-gray-900 transition-colors flex items-center space-x-2"
                aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
                title={theme === "dark" ? "Light mode" : "Dark mode"}
              >
                {theme === "dark" ? (
                  <FiSun className="text-lg" />
                ) : (
                  <FiMoon className="text-lg" />
                )}
                <span>{theme === "dark" ? "Light mode" : "Dark mode"}</span>
              </button>
              <button
                onClick={() => {
                  window.location.reload();
                  closeMobileMenu();
                }}
                className="w-full text-left px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-200 hover:text-[var(--primary-color)] hover:border-[var(--primary-color)] focus:ring-2 focus:ring-[var(--primary-color)] focus:ring-offset-2 dark:focus:ring-offset-gray-900 transition-colors flex items-center space-x-2"
                aria-label="Refresh"
                title="Refresh"
              >
                <FiRefreshCcw className="text-lg" />
                <span>Refresh</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
