import { useState, useEffect, useCallback, useMemo } from 'react'
import type { Judge, Entrant, EntrantJudgeAssignments, SessionBlock } from './types'
import { getJudges, getEntrants, getSessionBlocks, saveSessionBlocks } from './utils/localStorage'
import { useEntrant, SettingsProvider } from './contexts'
import Header from './components/Header'
import JudgesModal from './components/JudgesModal'
import EntrantsModal from './components/EntrantsModal'
import SettingsModal from './components/SettingsModal'
import ImportExportModal from './components/ImportExportModal'
import PreferencesPanel from './components/PreferencesPanel'
import SessionsArea from './components/SessionsArea'
import EmptyState from './components/EmptyState';

function App() {
  const { setEntrants } = useEntrant();
  const [judges, setJudges] = useState<Judge[]>([]);
  const [isJudgesModalOpen, setIsJudgesModalOpen] = useState(false);
  const [isEntrantsModalOpen, setIsEntrantsModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isImportExportModalOpen, setIsImportExportModalOpen] = useState(false);
  const [entrantJudgeAssignments, setEntrantJudgeAssignments] = useState<EntrantJudgeAssignments>({});
  const [allSessionBlocks, setAllSessionBlocks] = useState<SessionBlock[]>([]);
  
  // Computed property: scheduled sessions are just session blocks that are scheduled
  const scheduledSessions: SessionBlock[] = useMemo(() => {
    return allSessionBlocks.filter(block => block.isScheduled && block.startRowIndex !== undefined && block.judgeId);
  }, [allSessionBlocks]);

  const [scheduleConflicts, setScheduleConflicts] = useState<Array<{
    entrantId: string;
    entrantName: string;
    conflictingGroup: string;
    conflictingEntrantId: string;
    conflictingEntrantName: string;
    timeSlot: string;
  }>>([]);

  // Generate all session blocks for all entrants
  const generateAllSessionBlocks = useCallback((entrants: Entrant[]) => {
    const sessionBlocks: SessionBlock[] = [];
    
    const includedEntrants = entrants.filter(e => e.includeInSchedule);
    
    for (const entrant of includedEntrants) {
      // Use preference if set, otherwise default to 3x20
      const sessionType = entrant.preference || '3x20';
      
      if (sessionType === '1xLong') {
        sessionBlocks.push({
          id: `${entrant.id}-1xlong`,
          entrantId: entrant.id,
          entrantName: entrant.name,
          type: '1xLong',
          isScheduled: false
        });
      } else if (sessionType === '3x20') {
        for (let i = 0; i < 3; i++) {
          sessionBlocks.push({
            id: `${entrant.id}-3x20-${i}`,
            entrantId: entrant.id,
            entrantName: entrant.name,
            type: '3x20',
            sessionIndex: i,
            isScheduled: false
          });
        }
      } else if (sessionType === '3x10') {
        for (let i = 0; i < 3; i++) {
          sessionBlocks.push({
            id: `${entrant.id}-3x10-${i}`,
            entrantId: entrant.id,
            entrantName: entrant.name,
            type: '3x10',
            sessionIndex: i,
            isScheduled: false
          });
        }
      }
    }
    
    setAllSessionBlocks(sessionBlocks);
    saveSessionBlocks(sessionBlocks);
  }, []);

  useEffect(() => {
    const storedJudges = getJudges();
    const storedEntrants = getEntrants();
    const storedSessionBlocks = getSessionBlocks();
    
    setJudges(storedJudges);
    setEntrants(storedEntrants);
    
    // Clean up session blocks that reference non-existent entrants
    const validSessionBlocks = storedSessionBlocks.filter(block => 
      block && block.entrantId && 
      storedEntrants.find(entrant => entrant.id === block.entrantId) !== undefined
    );
    
    // Save cleaned data back to localStorage if any cleanup was needed
    if (validSessionBlocks.length !== storedSessionBlocks.length) {
      saveSessionBlocks(validSessionBlocks);
    }
    
    // Initialize entrant-judge assignments from existing data
    initializeEntrantJudgeAssignments(storedEntrants);
    
    // If we have stored session blocks, use them; otherwise generate new ones
    if (validSessionBlocks.length > 0) {
      setAllSessionBlocks(validSessionBlocks);
    } else {
      // Generate all session blocks
      generateAllSessionBlocks(storedEntrants);
    }
  }, [setEntrants, generateAllSessionBlocks]);

  // Initialize entrant-judge assignments from localStorage or other sources
  const initializeEntrantJudgeAssignments = (entrants: Entrant[]) => {
    // This will be populated when SessionsArea provides the initial data
    const initialAssignments: EntrantJudgeAssignments = {};
    entrants.forEach(entrant => {
      initialAssignments[entrant.id] = [];
    });
    setEntrantJudgeAssignments(initialAssignments);
  };



  // Check for schedule conflicts between entrants and their groups to avoid
  const checkScheduleConflicts = useCallback((sessions: SessionBlock[], entrants: Entrant[]) => {
    const conflicts: Array<{
      entrantId: string;
      entrantName: string;
      conflictingGroup: string;
      conflictingEntrantId: string;
      conflictingEntrantName: string;
      timeSlot: string;
    }> = [];

    // Helper function to calculate session duration in row slots
    const getSessionDurationRows = (sessionType: string): number => {
      // Use default durations for conflict detection (these should match the settings)
      const durationMinutes = sessionType === '1xLong' ? 40 : 
                             sessionType === '3x20' ? 20 : 
                             10; // 3x10
      // Convert minutes to row slots (assuming 5-minute slots)
      return Math.ceil(durationMinutes / 5);
    };

    // Helper function to check if two row ranges overlap
    const doSessionsOverlap = (startRow1: number, durationRows1: number, startRow2: number, durationRows2: number): boolean => {
      const endRow1 = startRow1 + durationRows1 - 1;
      const endRow2 = startRow2 + durationRows2 - 1;
      
      // Check if sessions overlap (one starts before the other ends and ends after the other starts)
      return startRow1 <= endRow2 && endRow1 >= startRow2;
    };

    // Check each entrant for conflicts
    entrants.forEach(entrant => {
      if (!entrant.groupsToAvoid || entrant.groupsToAvoid.trim() === '') {
        return; // Skip if no groups to avoid
      }

      const groupsToAvoid = entrant.groupsToAvoid.split(' | ').map(g => g.trim()).filter(g => g);
      
      // Find this entrant's scheduled sessions
      const entrantSessions = sessions.filter(s => s.entrantId === entrant.id);
      
      entrantSessions.forEach(session => {
        const sessionDuration = getSessionDurationRows(session.type);
        
        // Check all other sessions for overlaps
        sessions.forEach(otherSession => {
          if (otherSession.entrantId === entrant.id) return; // Skip self
          
          const otherSessionDuration = getSessionDurationRows(otherSession.type);
          
          // Check if sessions overlap in row indices
          if (doSessionsOverlap(session.startRowIndex!, sessionDuration, otherSession.startRowIndex!, otherSessionDuration)) {
            const conflictingEntrant = entrants.find(e => e.id === otherSession.entrantId);
            if (!conflictingEntrant) return;
            
            // Check if the conflicting entrant's name matches a group this entrant should avoid
            const hasConflict = groupsToAvoid.some(groupToAvoid => {
              return conflictingEntrant.name === groupToAvoid;
            });
            
            if (hasConflict) {

              const conflictingGroup = conflictingEntrant.name;
                            
              conflicts.push({
                entrantId: entrant.id,
                entrantName: entrant.name,
                conflictingGroup: conflictingGroup,
                conflictingEntrantId: conflictingEntrant.id,
                conflictingEntrantName: conflictingEntrant.name,
                timeSlot: `Row ${session.startRowIndex}` // Convert row index to display string
              });
            }
          }
        });
      });
    });

    // Store conflicts in state for the preferences table
    setScheduleConflicts(conflicts);

    // Log conflicts to console (you can replace this with UI notifications later)
    if (conflicts.length > 0) {
      console.warn('Schedule conflicts detected with groups to avoid:', conflicts);
      
      // Group conflicts by entrant for better readability
      const conflictsByEntrant = conflicts.reduce((acc, conflict) => {
        if (!acc[conflict.entrantId]) {
          acc[conflict.entrantId] = [];
        }
        acc[conflict.entrantId].push(conflict);
        return acc;
      }, {} as Record<string, typeof conflicts>);
      
      Object.entries(conflictsByEntrant).forEach(([entrantId, entrantConflicts]) => {
        const entrant = entrants.find(e => e.id === entrantId);
        console.warn(`${entrant?.name} has ${entrantConflicts.length} conflict(s):`);
        entrantConflicts.forEach(conflict => {
          console.warn(`  - At ${conflict.timeSlot}: conflicting with ${conflict.conflictingEntrantName} (${conflict.conflictingGroup})`);
        });
      });
    } else {
      console.log('No schedule conflicts detected with groups to avoid.');
    }
  }, []);

  // Update entrant-judge assignments when sessions change
  const handleScheduledSessionsChange = useCallback((sessions: SessionBlock[]) => {
    const newAssignments: EntrantJudgeAssignments = {};
    
    // Get all entrants to initialize empty arrays
    const entrants = getEntrants();
    entrants.forEach(entrant => {
      newAssignments[entrant.id] = [];
    });
    
    // Populate assignments based on current sessions
    sessions.forEach(session => {
      if (newAssignments[session.entrantId] && session.judgeId) {
        newAssignments[session.entrantId].push(session.judgeId);
      }
    });
    
    setEntrantJudgeAssignments(newAssignments);
    
    // Check for schedule conflicts with groups to avoid
    checkScheduleConflicts(sessions, entrants);
  }, [checkScheduleConflicts]);

  // Check for conflicts whenever scheduledSessions changes
  useEffect(() => {
    const entrants = getEntrants();
    checkScheduleConflicts(scheduledSessions, entrants);
  }, [scheduledSessions, checkScheduleConflicts]);

  // Handle session block updates (when a session is scheduled or unscheduled)
  const handleSessionBlockUpdate = useCallback((updatedSessionBlock: SessionBlock) => {
    setAllSessionBlocks(prev => {
      const existingIndex = prev.findIndex(block => 
        block.entrantId === updatedSessionBlock.entrantId && 
        block.type === updatedSessionBlock.type && 
        block.sessionIndex === updatedSessionBlock.sessionIndex
      );
      
      let updated;
      if (existingIndex !== -1) {
        // Update existing session block
        updated = [...prev];
        updated[existingIndex] = updatedSessionBlock;
      } else {
        // Add new session block
        updated = [...prev, updatedSessionBlock];
      }
      
      // Save to localStorage
      saveSessionBlocks(updated);
      return updated;
    });
  }, []);

  // Handle removing session blocks by ID
  const handleSessionBlockRemove = useCallback((sessionBlockId: string) => {
    setAllSessionBlocks(prev => {
      const updated = prev.filter(block => block.id !== sessionBlockId);
      saveSessionBlocks(updated);
      return updated;
    });
  }, []);



  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Check if we're in an input field or textarea
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      // Open import/export modal with 'e' key
      if (event.key === 'e' || event.key === 'E') {
        event.preventDefault();
        setIsImportExportModalOpen(true);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleJudgesModalClose = () => {
    // Refresh judges data when modal closes
    const updatedJudges = getJudges();
    setJudges(updatedJudges);
  };

  const handleEntrantsModalClose = () => {
    // This will trigger a refresh of the PreferenceCheckTable
    // by forcing a re-render when the modal closes
    setIsEntrantsModalOpen(false);
  };

  const handleSessionBlocksChange = () => {
    // Refresh session blocks from localStorage
    const storedSessionBlocks = getSessionBlocks();
    setAllSessionBlocks(storedSessionBlocks);
  };

  const handleCompleteReset = () => {
    // Reload the page to refresh all data after complete reset
    window.location.reload();
  };

  return (
    <SettingsProvider>
      <div 
        className="min-h-screen relative bg-gray-100"
      >
        <Header 
          onOpenJudgesModal={() => setIsJudgesModalOpen(true)}
          onOpenEntrantsModal={() => setIsEntrantsModalOpen(true)}
          onOpenSettingsModal={() => setIsSettingsModalOpen(true)}
          onOpenImportExportModal={() => setIsImportExportModalOpen(true)}
        />
        
        {judges.length === 0 ? (
          <EmptyState onAddFirstJudge={() => setIsJudgesModalOpen(true)} />
        ) : (
          <>
            <SessionsArea 
              judges={judges} 
              setJudges={setJudges}
              refreshKey={isEntrantsModalOpen ? 'open' : 'closed'}
              onScheduledSessionsChange={handleScheduledSessionsChange}
              scheduledSessions={scheduledSessions}
              allSessionBlocks={allSessionBlocks}
              onSessionBlockUpdate={handleSessionBlockUpdate}
              onSessionBlockRemove={handleSessionBlockRemove}
            />
            
            <PreferencesPanel 
              judges={judges} 
              refreshKey={isEntrantsModalOpen ? 'open' : 'closed'}
              entrantJudgeAssignments={entrantJudgeAssignments}
              allSessionBlocks={allSessionBlocks}
              scheduleConflicts={scheduleConflicts}
            />
          </>
        )}

        <JudgesModal
          isOpen={isJudgesModalOpen}
          onClose={() => setIsJudgesModalOpen(false)}
          onModalClose={handleJudgesModalClose}
        />

        <EntrantsModal
          isOpen={isEntrantsModalOpen}
          onClose={() => setIsEntrantsModalOpen(false)}
          onModalClose={handleEntrantsModalClose}
          onSessionBlocksChange={handleSessionBlocksChange}
        />

        <SettingsModal
          isOpen={isSettingsModalOpen}
          onClose={() => setIsSettingsModalOpen(false)}
          scheduledSessions={scheduledSessions}
          onCompleteReset={handleCompleteReset}
        />

        <ImportExportModal
          isOpen={isImportExportModalOpen}
          onClose={() => setIsImportExportModalOpen(false)}
        />

      </div>
    </SettingsProvider>
  )
}

export default App
