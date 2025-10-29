import React from 'react';

const Footer: React.FC = () => {
  return (
    <footer className="bg-gray-50 border-t border-gray-200 py-4 px-4 mt-auto">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row items-center justify-between text-sm text-gray-600 space-y-2 sm:space-y-0">
          <div className="flex items-center">
            <span>Originally created by <a 
              href="https://michael-black.com" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-gray-700 hover:text-gray-900 transition-colors"
            >
              Michael Black
            </a></span>
          </div>
          
          <div className="flex items-center space-x-2">
          <a
              href="https://github.com/mblac056/feedbackschedule"
              target="_blank"
              rel="noopener noreferrer"
              className="flex gap-2 items-center text-gray-600 hover:text-gray-900 transition-colors"
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
        </div>
      </div>
    </footer>
  );
};

export default Footer;
