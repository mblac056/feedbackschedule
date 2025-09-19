import { useState, useRef } from 'react';
import { generateExportData, convertToJSON, importData } from '../utils/importExport';

interface ImportExportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ImportExportModal({ isOpen, onClose }: ImportExportModalProps) {
  const [importError, setImportError] = useState<string>('');
  const [importSuccess, setImportSuccess] = useState<string>('');
  const [exportSuccess, setExportSuccess] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = () => {
    try {
      const data = generateExportData();
      const jsonString = convertToJSON(data);
      
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `evalmatrix-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      setExportSuccess('Data exported successfully!');
      setTimeout(() => setExportSuccess(''), 3000);
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImportError('');
    setImportSuccess('');

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const jsonString = e.target?.result as string;
        const result = importData(jsonString);
        
        if (result.success) {
          setImportSuccess(result.message);
          // Clear the file input
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
          // Close modal after successful import
          setTimeout(() => {
            onClose();
            // Reload the page to refresh all data
            window.location.reload();
          }, 1500);
        } else {
          setImportError(result.message);
        }
      } catch {
        setImportError('Failed to read file. Please ensure it is a valid JSON file.');
      }
    };
    
    reader.readAsText(file);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Import / Export Data</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Export Section */}
          <div className="space-y-3">
            <h3 className="text-lg font-medium text-gray-900">Export Data</h3>
            <p className="text-sm text-gray-600">
              Download all your judges, entrants, settings, and session data as a JSON file.
            </p>
            <button
              onClick={handleExport}
              className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Export to File
            </button>
            {exportSuccess && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-green-800 text-sm">{exportSuccess}</p>
              </div>
            )}
          </div>

          {/* Import Section */}
          <div className="space-y-3">
            <h3 className="text-lg font-medium text-gray-900">Import Data</h3>
            <p className="text-sm text-gray-600">
              Upload a JSON file to restore your data. This will replace all current data.
            </p>
            <div className="relative">
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleImport}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <button className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors flex items-center justify-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                Choose File to Import
              </button>
            </div>
            
            {importError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-800 text-sm">{importError}</p>
              </div>
            )}
            
            {importSuccess && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-green-800 text-sm">{importSuccess}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
