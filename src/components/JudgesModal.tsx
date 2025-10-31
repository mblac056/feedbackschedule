import { useState, useEffect } from 'react';
import type { Judge } from '../types';
import { getJudges, saveJudges } from '../utils/localStorage';
import { FaTrash } from 'react-icons/fa';

interface JudgesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onModalClose?: () => void;
}

export default function JudgesModal({ isOpen, onClose, onModalClose }: JudgesModalProps) {
  const [judges, setJudges] = useState<Judge[]>([]);
  const [originalJudges, setOriginalJudges] = useState<Judge[]>([]);
  const [showConfirmClose, setShowConfirmClose] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const storedJudges = getJudges();
      setJudges(storedJudges);
      setOriginalJudges(JSON.parse(JSON.stringify(storedJudges))); // Deep copy
      setShowConfirmClose(false);
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
    // Update original to reflect saved state
    setOriginalJudges(JSON.parse(JSON.stringify(judges)));
    onClose();
    // Notify parent component that modal has closed
    if (onModalClose) {
      onModalClose();
    }
  };

  // Check if there are unsaved changes
  const hasUnsavedChanges = () => {
    return JSON.stringify(judges) !== JSON.stringify(originalJudges);
  };

  const handleCloseWithoutSave = () => {
    setShowConfirmClose(false);
    onClose();
    if (onModalClose) {
      onModalClose();
    }
  };

  const handleCloseClick = () => {
    if (hasUnsavedChanges()) {
      setShowConfirmClose(true);
    } else {
      onClose();
      if (onModalClose) {
        onModalClose();
      }
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

  if (!isOpen) return null;

  return (
    <>
      {/* Confirmation Dialog */}
      {showConfirmClose && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-2">Unsaved Changes</h3>
              <p className="text-gray-600 mb-6">
                Are you sure you want to close without saving? Your changes will be lost.
              </p>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setShowConfirmClose(false)}
                  className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCloseWithoutSave}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  Yes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60] p-4" onClick={handleCloseClick}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-h-[90vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="bg-gray-600 text-white p-6 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold">Manage Judges</h2>
            <p className="text-blue-100">Add, edit, and remove competition judges</p>
          </div>
          <div className="flex items-center space-x-3">
          <button
              onClick={handleCloseClick}
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
            <div className="text-center py-12">
              <div className="max-w-md mx-auto">
                <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Judges Added Yet</h3>
                <p className="text-gray-600 mb-4">
                  Add judges manually using the "Add Judge" button above, or import them from CSV on the main page.
                </p>
              </div>
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
    </>
  );
}
