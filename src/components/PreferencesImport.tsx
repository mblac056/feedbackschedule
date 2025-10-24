import { useState, useRef } from 'react';
import type { Entrant, Judge } from '../types';
import { importEvalPreferencesCSV } from '../utils/csvImport';
import type { ImportResult, EvalPreferencesImportData } from '../utils/csvImportShared';

interface PreferencesImportProps {
  entrants: Entrant[];
  judges: Judge[];
  onImportComplete: (updatedEntrants: Entrant[]) => void;
  onClose: () => void;
}

export default function PreferencesImport({ 
  entrants, 
  judges, 
  onImportComplete, 
  onClose 
}: PreferencesImportProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [importResults, setImportResults] = useState<ImportResult<EvalPreferencesImportData> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (!file.type.includes('csv') && !file.name.endsWith('.csv')) {
      alert('Please select a CSV file');
      return;
    }

    setIsLoading(true);
    
    try {
      const text = await file.text();
      const result = importEvalPreferencesCSV(text, entrants, judges);
      
      if (result.success) {
        // Refresh the entrants state with updated data
        onImportComplete([...entrants]);
        setImportResults(result);
      } else {
        setImportResults(result);
      }
    } catch (error) {
      alert(`Error reading file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFile(files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-lg font-medium text-gray-800">Import Preferences from CSV</h4>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-gray-700 transition-colors"
          disabled={isLoading}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      
      <div 
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-all duration-200 ${
          isDragOver 
            ? 'border-purple-500 bg-purple-50' 
            : 'border-gray-300 hover:border-gray-400'
        } ${isLoading ? 'opacity-50 pointer-events-none' : 'cursor-pointer'}`}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={handleClick}
      >
        <div className="mx-auto w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mb-3">
          {isLoading ? (
            <svg className="animate-spin w-6 h-6 text-purple-600" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          ) : (
            <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          )}
        </div>
        
        <h4 className="text-base font-medium text-gray-900 mb-1">
          {isLoading ? 'Processing file...' : 'Import Preferences from CSV'}
        </h4>
        
        <p className="text-sm text-gray-600 mb-2">
          {isDragOver 
            ? 'Drop your CSV file here' 
            : 'Drag and drop your submission document CSV file here, or click to browse'
          }
        </p>
        
        <p className="text-xs text-gray-500 mb-4">
          Expected format: Group Name, Group To Avoid, Eval Type columns, 1st/2nd/3rd Choice judge preferences
        </p>
        
        {!isLoading && (
          <button
            className="inline-block px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              handleClick();
            }}
          >
            Choose File
          </button>
        )}
        
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      {/* Import Results Dialog */}
      {importResults && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden">
            <div className="bg-gray-600 text-white p-6 flex justify-between items-center">
              <div>
                <h3 className="text-xl font-bold">
                  {importResults.success ? 'Import Successful' : 'Import Failed'}
                </h3>
                <p className="text-gray-200">
                  {importResults.success ? 'Preferences have been updated' : 'There were issues with the import'}
                </p>
              </div>
              <button
                onClick={() => {
                  setImportResults(null);
                  if (importResults.success) {
                    onClose();
                  }
                }}
                className="text-gray-300 hover:text-white transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              {/* Summary */}
              <div className="mb-6">
                <h4 className="text-lg font-semibold text-gray-800 mb-3">Import Summary</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <div className="text-green-800 font-semibold">Entrants Updated</div>
                    <div className="text-2xl font-bold text-green-600">
                      {importResults.data?.entrantsUpdated || 0}
                    </div>
                  </div>
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <div className="text-red-800 font-semibold">Not Found</div>
                    <div className="text-2xl font-bold text-red-600">
                      {importResults.data?.entrantsNotFound || 0}
                    </div>
                  </div>
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                    <div className="text-yellow-800 font-semibold">Rows Skipped</div>
                    <div className="text-2xl font-bold text-yellow-600">
                      {importResults.data?.rowsSkipped || 0}
                    </div>
                  </div>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <div className="text-blue-800 font-semibold">Total Processed</div>
                    <div className="text-2xl font-bold text-blue-600">
                      {importResults.data?.rowsProcessed || 0}
                    </div>
                  </div>
                </div>
              </div>

              {/* Warnings/Errors */}
              {importResults.warnings && importResults.warnings.length > 0 && (
                <div className="mb-6">
                  <h4 className="text-lg font-semibold text-gray-800 mb-3">Warnings & Issues</h4>
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <ul className="space-y-2">
                      {importResults.warnings.map((warning: string, index: number) => (
                        <li key={index} className="text-sm text-yellow-800 flex items-start">
                          <span className="text-yellow-600 mr-2">⚠️</span>
                          {warning}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {/* Error Message */}
              {!importResults.success && (
                <div className="mb-6">
                  <h4 className="text-lg font-semibold text-gray-800 mb-3">Error Details</h4>
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <p className="text-red-800">{importResults.message}</p>
                  </div>
                </div>
              )}

              {/* Success Message */}
              {importResults.success && (
                <div className="mb-6">
                  <h4 className="text-lg font-semibold text-gray-800 mb-3">What was updated?</h4>
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <ul className="space-y-2 text-sm text-green-800">
                      <li>• Group preferences (1xLong, 3x20, 3x10)</li>
                      <li>• Judge preferences (1st, 2nd, 3rd choice)</li>
                      <li>• Groups to avoid relationships</li>
                    </ul>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setImportResults(null);
                    if (importResults.success) {
                      onClose();
                    }
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  {importResults.success ? 'Close' : 'Try Again'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
