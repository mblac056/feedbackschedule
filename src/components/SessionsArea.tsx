import UnassignedSessions from "./UnassignedSessions";
import GridSchedule from "./GridSchedule";
import { useState, useEffect } from "react";
import type { Judge, SessionBlock } from "../types";
import { saveJudges } from "../utils/localStorage";
import type { DraggedSessionData } from "../types";
import { generatePDF } from "../utils/printFiles";
import { FaChevronDown } from "react-icons/fa";
import { useSettings } from "../contexts/useSettings";
import { getSessionDurationMinutes } from "../config/timeConfig";
import { populateGrid } from "../utils/populateGrid";

type SessionsAreaProps = {
    judges: Judge[];
    setJudges: (judges: Judge[]) => void;
    refreshKey: string;
    onScheduledSessionsChange?: (sessions: SessionBlock[]) => void;
    allSessionBlocks: SessionBlock[];
    scheduledSessions: SessionBlock[];
    onSessionBlockUpdate: (sessionBlock: SessionBlock) => void;
    onSessionBlockRemove: (sessionBlockId: string) => void;
    entrantJudgeAssignments?: { [entrantId: string]: string[] };
    scheduleConflicts?: Array<{
        entrantId: string;
        entrantName: string;
        conflictingGroup: string;
        conflictingEntrantId: string;
        conflictingEntrantName: string;
        timeSlot: string;
    }>;
}

export default function SessionsArea({judges, setJudges, refreshKey, onScheduledSessionsChange, scheduledSessions, allSessionBlocks, onSessionBlockUpdate, onSessionBlockRemove, entrantJudgeAssignments, scheduleConflicts }: SessionsAreaProps) {
    const { settings } = useSettings();
    const [draggedSessionData, setDraggedSessionData] = useState<DraggedSessionData | null>(null);
    const [totalDuration, setTotalDuration] = useState<number>(0);
    const [showPrintDropdown, setShowPrintDropdown] = useState<boolean>(false);
    const [selectedReports, setSelectedReports] = useState<string[]>(['matrix', 'judgeSchedules', 'entrantSchedules', 'flowDocument', 'feedbackAnnouncements']);

    useEffect(() => {
        if (scheduledSessions.length === 0) {
            setTotalDuration(0);
            return;
        }

        // Helper function to get session duration in minutes using settings
        const getSessionDurationMinutesFromSettings = (sessionType: string): number => {
            return getSessionDurationMinutes(sessionType as '1xLong' | '3x20' | '3x10', settings);
        };

        // Find the earliest start row and latest end row
        let earliestStartRow = Infinity;
        let latestEndRow = -Infinity;

        scheduledSessions.forEach(session => {
            const startRow = session.startRowIndex!;
            const sessionDuration = getSessionDurationMinutesFromSettings(session.type);
            // Convert duration from minutes to row slots (assuming 5-minute slots)
            const sessionDurationRows = Math.ceil(sessionDuration / 5);
            const endRow = startRow + sessionDurationRows - 1;

            earliestStartRow = Math.min(earliestStartRow, startRow);
            latestEndRow = Math.max(latestEndRow, endRow);
        });

        // Convert row span back to minutes for display
        const totalSpanRows = latestEndRow - earliestStartRow + 1;
        const totalSpanMinutes = totalSpanRows * 5; // Convert back to minutes
        setTotalDuration(totalSpanMinutes);
    }, [scheduledSessions, settings]);

    // Notify parent when sessions change
    useEffect(() => {
        if (onScheduledSessionsChange) {
            onScheduledSessionsChange(scheduledSessions);
        }
    }, [scheduledSessions, onScheduledSessionsChange]);
    
      const handleJudgesReorder = (reorderedJudges: Judge[]) => {
        setJudges(reorderedJudges);
        saveJudges(reorderedJudges);
      };
    
        // Global variable to store drag data
        let globalDragData: DraggedSessionData | null = null;
        
        const handleGlobalDragStart = (e: React.DragEvent) => {
            // Try to read drag data from the event
            try {
              const sessionData = e.dataTransfer.getData('application/json');
              if (sessionData) {
                const parsedData: DraggedSessionData = JSON.parse(sessionData);
                globalDragData = parsedData;
                setDraggedSessionData(parsedData);
              }
            } catch {
              // Not a session drag, ignore
            }
          };
        
          const handleGlobalDragOver = () => {
            // Use the global drag data if available
            if (globalDragData && !draggedSessionData) {
              setDraggedSessionData(globalDragData);
            }
          };
        
          const handleGlobalDragEnd = () => {
            setDraggedSessionData(null);
            globalDragData = null;
          };

    const reportOptions = [
        { id: 'matrix', label: 'Schedule Matrix' },
        { id: 'judgeSchedules', label: 'Judge Schedules' },
        { id: 'entrantSchedules', label: 'Entrant Schedules' },
        { id: 'flowDocument', label: 'Flow Document' },
        { id: 'feedbackAnnouncements', label: 'Feedback Announcements' }
    ];

    const handleReportToggle = (reportId: string) => {
        setSelectedReports(prev => 
            prev.includes(reportId) 
                ? prev.filter(id => id !== reportId)
                : [...prev, reportId]
        );
    };

    const handleGeneratePDF = () => {
        if (selectedReports.length > 0) {
            generatePDF(scheduledSessions, judges, selectedReports, entrantJudgeAssignments, allSessionBlocks, scheduleConflicts);
        }
    };



    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (showPrintDropdown) {
                const target = event.target as Element;
                if (!target.closest('.print-dropdown-container')) {
                    setShowPrintDropdown(false);
                }
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showPrintDropdown]);

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8"
        onDragStart={handleGlobalDragStart}
        onDragOver={handleGlobalDragOver}
        onDragEnd={handleGlobalDragEnd}>
          <div className="flex items-center gap-4 mb-4 ml-10">
          {scheduledSessions.length > 0 ? (
          <button className="bg-[var(--primary-color)] text-white px-4 py-2 rounded-md hover:bg-[var(--primary-color-dark)] focus:ring-2 focus:ring-[var(--primary-color)] focus:ring-offset-2 transition-colors" onClick={() => {
              // Update all session blocks to mark them as unscheduled
              allSessionBlocks.forEach(block => {
                if (block.isScheduled) {
                  const updatedBlock = {
                    ...block,
                    isScheduled: false,
                    startRowIndex: undefined,
                    judgeId: undefined
                  };
                  onSessionBlockUpdate(updatedBlock);
                }
              });
            }}>
              Clear Grid
            </button>) : (
            <button className="bg-[var(--primary-color)] text-white px-4 py-2 rounded-md hover:bg-[var(--primary-color-dark)] focus:ring-2 focus:ring-[var(--primary-color)] focus:ring-offset-2 transition-colors" onClick={() => {
              populateGrid(allSessionBlocks, judges, onSessionBlockUpdate);
            }}>
              Populate Grid
            </button>
            )}
            <div className="relative print-dropdown-container">
              <div className="flex">
                <button 
                  className="bg-[var(--secondary-color)] px-4 py-2 rounded-l-md hover:bg-[var(--secondary-color-dark)] transition-colors" 
                  onClick={handleGeneratePDF}
                  disabled={selectedReports.length === 0}
                >
                  Create Print File
                </button>
                <button 
                  className="bg-[var(--secondary-color)] px-2 py-2 rounded-r-md hover:bg-[var(--secondary-color-dark)] transition-colors border-l border-gray-300"
                  onClick={() => setShowPrintDropdown(!showPrintDropdown)}
                >
                  <FaChevronDown className={`transition-transform ${showPrintDropdown ? 'rotate-180' : ''}`} />
                </button>
              </div>
              
              {showPrintDropdown && (
                <div className="absolute top-full z-50 left-0 mt-1 bg-white border border-[var(--primary-color)] rounded-md shadow-lg z-10 min-w-64">
                  <div className="p-2">
                    <div className="text-sm font-medium text-gray-700 mb-2">Select Reports:</div>
                    {reportOptions.map(option => (
                      <label key={option.id} className="flex items-center space-x-2 p-1 hover:bg-gray-50 rounded cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedReports.includes(option.id)}
                          onChange={() => handleReportToggle(option.id)}
                          className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                        />
                        <span className="text-sm text-gray-700">{option.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
            {totalDuration > 0 && (
              <span className={`text-gray-600 font-bold text-lg ${totalDuration > 180 && 'text-red-500'}`}>
                                 Total Length: {Math.floor(totalDuration / 60) !== 0 && `${Math.floor(totalDuration / 60)}h `}{totalDuration % 60 !== 0 && `${totalDuration % 60}m`}
              </span>
            )}
          </div>
        <GridSchedule 
        judges={judges} 
        onJudgesReorder={handleJudgesReorder}
        refreshKey={refreshKey}
        draggedSessionData={draggedSessionData}
        scheduledSessions={scheduledSessions}
        allSessionBlocks={allSessionBlocks}
        onSessionBlockUpdate={onSessionBlockUpdate}
        onSessionBlockRemove={onSessionBlockRemove}
        onSessionDragStart={(sessionData) => {
          setDraggedSessionData(sessionData);
        }}
      />
      
      <UnassignedSessions 
        allSessionBlocks={allSessionBlocks}
        refreshKey={refreshKey}
        onSessionUnscheduled={(sessionData) => {
          // Find the session block and unschedule it instead of removing it
          const sessionBlock = allSessionBlocks.find(block => 
            block.entrantId === sessionData.entrantId && 
            block.type === sessionData.type && 
            block.sessionIndex === sessionData.sessionIndex
          );
          
          if (sessionBlock) {
            const updatedBlock = {
              ...sessionBlock,
              isScheduled: false,
              startRowIndex: undefined,
              judgeId: undefined
            };
            onSessionBlockUpdate(updatedBlock);
          }
        }}
        onSessionBlockUpdate={onSessionBlockUpdate}
        onSessionBlockRemove={onSessionBlockRemove}
      />
      </div>
    )
}