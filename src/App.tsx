import { useState, useEffect } from 'react'
import { useEntrant, SettingsProvider } from './contexts'
import { useSessionManagement } from './hooks/useSessionManagement'
import { getEntrants, getJudges } from './utils/localStorage'
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
  const {
    judges,
    allSessionBlocks,
    scheduledSessions,
    entrantJudgeAssignments,
    scheduleConflicts,
    setJudges,
    handleSessionBlockUpdate,
    handleSessionBlockRemove,
    handleScheduledSessionsChange,
    handleClearGrid,
    refreshSessionBlocks,
  } = useSessionManagement();

  const [isJudgesModalOpen, setIsJudgesModalOpen] = useState(false);
  const [isEntrantsModalOpen, setIsEntrantsModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isImportExportModalOpen, setIsImportExportModalOpen] = useState(false);

  // Initialize entrants when the hook loads data
  useEffect(() => {
    const storedEntrants = getEntrants();
    setEntrants(storedEntrants);
  }, [setEntrants]);






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
    // Refresh session blocks when entrants change
    refreshSessionBlocks();
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
          <EmptyState onJudgesImported={(importedJudges) => setJudges(importedJudges)} />
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
              entrantJudgeAssignments={entrantJudgeAssignments}
              scheduleConflicts={scheduleConflicts}
            />
            
            <PreferencesPanel 
              judges={judges} 
              refreshKey={isEntrantsModalOpen ? 'open' : 'closed'}
              entrantJudgeAssignments={entrantJudgeAssignments}
              allSessionBlocks={allSessionBlocks}
              scheduleConflicts={scheduleConflicts}
              onSessionBlocksChange={handleSessionBlocksChange}
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
          scheduleConflicts={scheduleConflicts}
        />

        <SettingsModal
          isOpen={isSettingsModalOpen}
          onClose={() => setIsSettingsModalOpen(false)}
          scheduledSessions={scheduledSessions}
          onCompleteReset={handleCompleteReset}
          onClearGrid={handleClearGrid}
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
