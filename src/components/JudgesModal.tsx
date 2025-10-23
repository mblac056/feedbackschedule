import { useState, useEffect } from 'react';
import type { Judge } from '../types';
import { getJudges, saveJudges } from '../utils/localStorage';
import { FaTrash } from 'react-icons/fa';
import CSVImport from './CSVImport';

interface JudgesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onModalClose?: () => void;
}

export default function JudgesModal({ isOpen, onClose, onModalClose }: JudgesModalProps) {
  const [judges, setJudges] = useState<Judge[]>([]);

  useEffect(() => {
    if (isOpen) {
      const storedJudges = getJudges();
      setJudges(storedJudges);
    }
  }, [isOpen]);

  const handleAddJudge = () => {
    const newJudge: Judge = {
      id: Date.now().toString(),
      name: '',
      roomNumber: '',
      category: undefined,
    };
    
    setJudges(prev => [...prev, newJudge]);
  };

  const handleRemove = (judgeId: string) => {
    setJudges(prev => prev.filter(judge => judge.id !== judgeId));
  };

  const handleClose = () => {
    // Save all local changes to localStorage before closing
    saveJudges(judges);
    onClose();
    // Notify parent component that modal has closed
    if (onModalClose) {
      onModalClose();
    }
  };

  const handleFieldUpdate = (judgeId: string, field: keyof Judge, value: string | undefined) => {
    // For all fields, only update local state
    setJudges(prev => prev.map(judge => 
      judge.id === judgeId 
        ? { ...judge, [field]: value }
        : judge
    ));
  };

  const handleImportComplete = (importedJudges: Judge[]) => {
    setJudges(importedJudges);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-h-[90vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="bg-gray-600 text-white p-6 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold">Manage Judges</h2>
            <p className="text-blue-100">Add, edit, and remove competition judges</p>
          </div>
          <div className="flex items-center space-x-3">
          <button
              onClick={onClose}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Close
            </button>
                        <button
              onClick={handleClose}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors"
            >
              Save & Close
            </button>

          </div>
        </div>
        
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-semibold text-gray-800">Judges ({judges.length})</h3>
            <button
              onClick={handleAddJudge}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
            >
              Add Judge
            </button>
          </div>

          {judges.length === 0 ? (
            <div className="max-w-md mx-auto">
              <CSVImport 
                variant="modal"
                onImportComplete={handleImportComplete}
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full bg-white border border-gray-200 rounded-lg">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">Category</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">Room</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {judges.map((judge) => (
                    <tr key={judge.id} className="text-gray-600 hover:bg-gray-50">
                      <td className="px-4 py-3 border-b">
                        <input
                          type="text"
                          value={judge.name}
                          onChange={(e) => handleFieldUpdate(judge.id, 'name', e.target.value)}
                          onBlur={(e) => handleFieldUpdate(judge.id, 'name', e.target.value.trim())}
                          className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="Enter judge name"
                        />
                      </td>
                      <td className="px-4 py-3 border-b">
                        <select
                          value={judge.category || ''}
                          onChange={(e) => handleFieldUpdate(judge.id, 'category', e.target.value || undefined)}
                          className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          <option value="">Select Category</option>
                          <option value="SNG">SNG</option>
                          <option value="MUS">MUS</option>
                          <option value="PER">PER</option>
                        </select>
                      </td>
                      <td className="px-4 py-3 border-b">
                        <input
                          type="text"
                          value={judge.roomNumber || ''}
                          onChange={(e) => handleFieldUpdate(judge.id, 'roomNumber', e.target.value)}
                          onBlur={(e) => handleFieldUpdate(judge.id, 'roomNumber', e.target.value.trim() || undefined)}
                          className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </td>

                      <td className="px-4 py-3 border-b">
                        <button
                          onClick={() => handleRemove(judge.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                          title="Remove judge"
                        >
                          <FaTrash className="w-4 h-4" />
                        </button>
                      </td>
                      
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
