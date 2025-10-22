import { useState, useRef, useCallback } from 'react';
import { importAssignmentsCSV, importDRCJReportCSV, type ImportResult } from '../utils/csvImport';
import type { Judge, Entrant } from '../types';
import { saveJudges, saveEntrants } from '../utils/localStorage';

interface CSVImportProps {
  onImportComplete?: (judges: Judge[]) => void;
  onEntrantsImportComplete?: (entrants: Entrant[]) => void;
  variant?: 'empty-state' | 'modal';
  importType?: 'judges' | 'entrants';
  existingEntrants?: Entrant[]; // Pass existing entrants for append behavior
}

export default function CSVImport({ 
  onImportComplete, 
  onEntrantsImportComplete, 
  variant = 'empty-state', 
  importType = 'judges',
  existingEntrants = []
}: CSVImportProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    if (!file.type.includes('csv') && !file.name.endsWith('.csv')) {
      setImportResult({
        success: false,
        message: 'Please select a CSV file'
      });
      return;
    }

    setIsProcessing(true);
    setImportResult(null);

    try {
      const text = await file.text();
      let result: ImportResult;
      
      if (importType === 'judges') {
        result = importAssignmentsCSV(text);
        
        if (result.success && result.data) {
          const judgesData = result.data as { judges: Judge[] };
          // Save judges to localStorage
          saveJudges(judgesData.judges);
          
          // Notify parent component
          if (onImportComplete) {
            onImportComplete(judgesData.judges);
          }
        }
      } else {
        result = importDRCJReportCSV(text);
        
        if (result.success && result.data) {
          const entrantsData = result.data as { entrants: Entrant[] };
          
          // Use existing entrants passed from parent and append new ones
          const combinedEntrants = [...existingEntrants, ...entrantsData.entrants];
          
          // Save combined entrants to localStorage
          saveEntrants(combinedEntrants);
          
          // Notify parent component with combined entrants
          if (onEntrantsImportComplete) {
            onEntrantsImportComplete(combinedEntrants);
          }
        }
      }
      
      setImportResult(result);
    } catch (error) {
      setImportResult({
        success: false,
        message: `Error reading file: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    } finally {
      setIsProcessing(false);
    }
  }, [onImportComplete, onEntrantsImportComplete, importType, existingEntrants]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFile(files[0]);
    }
  }, [handleFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
  }, [handleFile]);

  const handleClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const resetImport = useCallback(() => {
    setImportResult(null);
    setIsProcessing(false);
  }, []);

  // Empty state variant (larger, more prominent)
  if (variant === 'empty-state') {
    return (
      <div className="space-y-6">
        <div
          className={`relative border-2 border-dashed rounded-xl p-12 transition-colors cursor-pointer ${
            isDragOver 
              ? 'border-blue-400 bg-blue-50' 
              : 'border-gray-300 hover:border-gray-400'
          }`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={handleClick}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileSelect}
            className="hidden"
          />
          
          <div className="text-center">
            <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Import {importType === 'judges' ? 'Judges' : 'Entrants'} from CSV
            </h3>
            <p className="text-gray-600 mb-4">
              Drag and drop your {importType === 'judges' ? 'Assignments Report' : 'DRCJ Report'} CSV file here, or click to browse
            </p>
          </div>
        </div>

        {importResult && !importResult.success && (
          <div className="p-4 rounded-lg bg-red-50 border border-red-200">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <svg className="w-5 h-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3 flex-1">
                <p className="text-sm font-medium text-red-800">
                  {importResult.message}
                </p>
                <button
                  onClick={resetImport}
                  className="mt-3 text-sm text-blue-600 hover:text-blue-800 underline"
                >
                  Try again
                </button>
              </div>
            </div>
          </div>
        )}

        {isProcessing && (
          <div className="flex items-center justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-3 text-gray-600">Processing CSV...</span>
          </div>
        )}
      </div>
    );
  }

  // Modal variant (smaller, more compact)
  return (
    <div className="space-y-4">
      <div
        className={`relative border-2 border-dashed rounded-lg p-8 transition-colors cursor-pointer ${
          isDragOver 
            ? 'border-blue-400 bg-blue-50' 
            : 'border-gray-300 hover:border-gray-400'
        }`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={handleClick}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          onChange={handleFileSelect}
          className="hidden"
        />
        
        <div className="text-center">
          <div className="mx-auto w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-3">
            <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          </div>
          
          <h4 className="text-base font-medium text-gray-900 mb-1">
            Import {importType === 'judges' ? 'Judges' : 'Entrants'} from CSV
          </h4>
          <p className="text-sm text-gray-600 mb-2">
            Drag and drop your CSV file here, or click to browse
          </p>
          <p className="text-xs text-gray-500">
            {importType === 'judges' ? 'Assignments Report format with Name, Type, Category columns' : 'DRCJ Report format with OA, Group Name, Shared Members columns'}
          </p>
        </div>
      </div>

      {importResult && !importResult.success && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="w-4 h-4 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-2 flex-1">
              <p className="text-sm font-medium text-red-800">
                {importResult.message}
              </p>
              <button
                onClick={resetImport}
                className="mt-2 text-xs text-blue-600 hover:text-blue-800 underline"
              >
                Try again
              </button>
            </div>
          </div>
        </div>
      )}

      {isProcessing && (
        <div className="flex items-center justify-center p-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          <span className="ml-2 text-sm text-gray-600">Processing...</span>
        </div>
      )}
    </div>
  );
}
