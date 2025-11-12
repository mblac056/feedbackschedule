import UnassignedSessions from "./UnassignedSessions";
import GridSchedule from "./GridSchedule";
import { useState, useEffect } from "react";
import type { Judge, SessionBlock } from "../types";
//import { saveJudges, clearGrid, saveSettings } from "../utils/localStorage";
import { saveJudges, clearGrid } from "../utils/localStorage";
import type { DraggedSessionData } from "../types";
import { generatePDF } from "../utils/printFiles";
import { FaChevronDown } from "react-icons/fa";
import { useSettings } from "../contexts/useSettings";
import { getSessionDurationMinutes } from "../config/timeConfig";
import { populateGrid } from "../utils/populateGrid";
//import type { SessionSettings } from "../config/timeConfig";


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
    //const { settings, setSettings } = useSettings();
    const { settings } = useSettings();
    const [draggedSessionData, setDraggedSessionData] = useState<DraggedSessionData | null>(null);
    const [totalDuration, setTotalDuration] = useState<number>(0);
    const [showPrintDropdown, setShowPrintDropdown] = useState<boolean>(false);

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
        { id: 'matrix', label: 'Feedback Matrix' },
        { id: 'judgeSchedules', label: 'Judge Schedules' },
        { id: 'entrantSchedules', label: 'Entrant Schedules' },
        { id: 'flowDocument', label: 'Flow Document' },
        { id: 'feedbackAnnouncements', label: 'Feedback Announcements' },
        { id: 'preferenceCheck', label: 'Preference Check' }
    ];

    const handlePrintMatrix = async () => {
        await generatePDF(scheduledSessions, judges, ['matrix'], entrantJudgeAssignments, allSessionBlocks, scheduleConflicts);
    };

    const handleGenerateReport = async (reportId: string) => {
        setShowPrintDropdown(false);
        await generatePDF(scheduledSessions, judges, [reportId], entrantJudgeAssignments, allSessionBlocks, scheduleConflicts);
    };

    /*const handlePopulateGrid = (allSessionBlocks: SessionBlock[], judges: Judge[], onSessionBlockUpdate: (sessionBlock: SessionBlock) => void, sessionSettings?: SessionSettings) => {
      // Determine if the majority of groups are Chorus or Quartet
      const groupTypeQuartet3x20and3x10 = allSessionBlocks.filter(block => block.groupType === 'Quartet' && block.type !== '1xLong').length/3;
      const groupTypeQuartet1xLong = allSessionBlocks.filter(block => block.groupType === 'Quartet' && block.type === '1xLong').length;
      const groupTypeQuartet = groupTypeQuartet3x20and3x10 + groupTypeQuartet1xLong;
      const groupTypeChorus3x20and3x10 = allSessionBlocks.filter(block => block.groupType === 'Chorus' && block.type !== '1xLong').length/3;
      const groupTypeChorus1xLong = allSessionBlocks.filter(block => block.groupType === 'Chorus' && block.type === '1xLong').length;
      const groupTypeChorus = groupTypeChorus3x20and3x10 + groupTypeChorus1xLong;
      // If majority of groups are Chorus, set format to Judges moving to Groups
      if(groupTypeChorus > groupTypeQuartet) {
          const movingType: 'judges' | 'groups' = 'judges';
          const newSettings = { ...settings, moving: movingType };
          setSettings(newSettings);
          saveSettings(newSettings);
      } else {
          const movingType: 'judges' | 'groups' = 'groups';
          const newSettings = { ...settings, moving: movingType };
          setSettings(newSettings);
          saveSettings(newSettings);
      }

      populateGrid(allSessionBlocks, judges, onSessionBlockUpdate, sessionSettings);
    }*/



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
        <div className="mx-auto px-4 sm:px-6 lg:px-8 py-8"
        onDragStart={handleGlobalDragStart}
        onDragOver={handleGlobalDragOver}
        onDragEnd={handleGlobalDragEnd}>
          <div className="flex flex-col md:flex-row items-start md:items-center gap-4 mb-4 ml-10 overflow-x-auto mobile-button-container">
            {/* Button row - side by side on mobile, horizontal on desktop */}
            <div className="flex flex-row items-center gap-4 w-full md:w-auto flex-shrink-0">
              {scheduledSessions.length > 0 ? (
                <button className="bg-[var(--primary-color)] text-white px-4 py-2 rounded-md hover:bg-[var(--primary-color-dark)] focus:ring-2 focus:ring-[var(--primary-color)] focus:ring-offset-2 transition-colors" onClick={() => {
                    // Clear the grid using the utility function
                    const clearedSessionBlocks = clearGrid(allSessionBlocks);
                    clearedSessionBlocks.forEach(block => {
                      onSessionBlockUpdate(block);
                    });
                  }}>
                    Clear Grid
                  </button>) : (
                  <button className="bg-[var(--primary-color)] text-white px-4 py-2 rounded-md hover:bg-[var(--primary-color-dark)] focus:ring-2 focus:ring-[var(--primary-color)] focus:ring-offset-2 transition-colors" onClick={() => {
                    populateGrid(allSessionBlocks, judges, onSessionBlockUpdate, settings);
                    //handlePopulateGrid(allSessionBlocks, judges, onSessionBlockUpdate, settings);
                  }}>
                    Populate Grid
                  </button>
                  )}
                <div className="relative print-dropdown-container">
                  <div className="flex">
                    <button 
                      className="bg-[var(--secondary-color)] px-4 py-2 rounded-l-md hover:bg-[var(--secondary-color-dark)] transition-colors" 
                      onClick={handlePrintMatrix}
                    >
                      Print
                    </button>
                    <button 
                      className="bg-[var(--secondary-color)] px-2 py-2 rounded-r-md hover:bg-[var(--secondary-color-dark)] transition-colors border-l border-gray-300"
                      onClick={() => setShowPrintDropdown(!showPrintDropdown)}
                    >
                      <FaChevronDown className={`transition-transform ${showPrintDropdown ? 'rotate-180' : ''}`} />
                    </button>
                  </div>
                  
                  {showPrintDropdown && (
                    <div className="absolute top-full z-50 left-0 mt-1 bg-white border border-[var(--primary-color)] rounded-md shadow-lg z-10 min-w-64 md:min-w-64 w-full md:w-auto">
                      <div className="p-1">
                        {reportOptions.map(option => (
                          <button
                            key={option.id}
                            onClick={() => handleGenerateReport(option.id)}
                            className="w-full text-left px-3 my-1 py-0 text-gray-700 hover:bg-gray-100 rounded transition-colors"
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
          </div>
          <div className="content-start mx-12 mb-4">
            <div className="text-gray-600 text-lg">
              Session Format:{' '}
              <span className={`font-bold ${settings.moving === 'groups' ? 'text-green-600' : 'text-blue-600'} font-bold`}>
                {settings.moving === 'groups' ? 'Groups moving to Judges' : 'Judges moving to Groups'}
              </span>
            </div>            
            {totalDuration > 0 && (
              <div className={`text-gray-600 text-lg ${totalDuration > 120 && 'text-red-500'} w-full md:w-auto`}>
                Total Length: <span className="font-bold">{Math.floor(totalDuration / 60) !== 0 && `${Math.floor(totalDuration / 60)}h `}{totalDuration % 60 !== 0 && `${totalDuration % 60}m`}</span>
              </div>
            )}
          </div>
        <div className="mobile-scroll-container">
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
        </div>
      
      <div className="mobile-scroll-container">
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
      </div>
    )
}