import React from 'react';
import { Link } from 'react-router-dom';

type FooterProps = {
  /** Show Admin Guide link on the right (create page). */
  showAdminGuide?: boolean;
};

const Footer: React.FC<FooterProps> = ({ showAdminGuide = false }) => {
  return (
    <footer className="bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 py-4 px-4 mt-auto">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row items-center justify-between text-sm text-gray-600 dark:text-gray-400 space-y-2 sm:space-y-0">
          <div className="flex items-center space-x-2">
            <a
              href="https://github.com/mblac056/feedbackschedule"
              target="_blank"
              rel="noopener noreferrer"
              className="flex gap-2 items-center text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
              aria-label="View on GitHub"
            >
              <span>Open Source</span>
              <img
                src="/github-color.svg"
                alt="GitHub"
                className="w-4 h-4"
              />
            </a>
          </div>

          {showAdminGuide && (
            <Link
              to="/admin-guide"
              className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
            >
              Admin Guide
            </Link>
          )}
        </div>
      </div>
    </footer>
  );
};

export default Footer;
