import { useState, useEffect, useCallback } from 'react'
import { SettingsProvider } from '../contexts'
import { useSessionManagement } from '../hooks/useSessionManagement'
import { getJudges } from '../utils/localStorage'
import Header from '../components/Header'
import JudgesModal from '../components/JudgesModal'
import EntrantsModal from '../components/EntrantsModal'
import SettingsModal from '../components/SettingsModal'
import ImportExportModal from '../components/ImportExportModal'
import PreferencesPanel from '../components/PreferencesPanel'
import SessionsArea from '../components/SessionsArea'
import EmptyState from '../components/EmptyState';
import Footer from '../components/Footer';

function CreatePage() {
  const {
    judges,
    allSessionBlocks,
    scheduledSessions,
    entrantJudgeAssignments,
    scheduleConflicts,
    setJudges,
    handleSessionBlockUpdate,
    handleSessionBlocksReplace,
    handleScheduledSessionsChange,
    handleClearGrid,
  } = useSessionManagement();

  const [isJudgesModalOpen, setIsJudgesModalOpen] = useState(false);
  const [isEntrantsModalOpen, setIsEntrantsModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isImportExportModalOpen, setIsImportExportModalOpen] = useState(false);
  const [isPreferencesOpen, setIsPreferencesOpen] = useState(false);

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
    const updatedJudges = getJudges();
    const inactiveJudgeIds = new Set(updatedJudges.filter(j => j.active === false).map(j => j.id));
    // Unschedule any sessions assigned to judges that are now inactive
    allSessionBlocks.forEach(block => {
      if (block.judgeId && inactiveJudgeIds.has(block.judgeId)) {
        handleSessionBlockUpdate({
          ...block,
          isScheduled: false,
          startRowIndex: undefined,
          endRowIndex: undefined,
          judgeId: undefined,
        });
      }
    });
    setJudges(updatedJudges);
  };

  const handleEntrantsModalClose = () => {
    setIsEntrantsModalOpen(false);
  };

  const handleCompleteReset = () => {
    // Reload the page to refresh all data after complete reset
    window.location.reload();
  };

  const handlePreferencesToggle = useCallback(() => {
    setIsPreferencesOpen(prev => !prev);
  }, []);

  return (
    <SettingsProvider>
      <div 
        className="min-h-screen relative bg-gray-100 dark:bg-gray-950 text-gray-900 dark:text-gray-100 flex flex-col"
      >
        <Header 
          onOpenJudgesModal={() => setIsJudgesModalOpen(true)}
          onOpenEntrantsModal={() => setIsEntrantsModalOpen(true)}
          onOpenSettingsModal={() => setIsSettingsModalOpen(true)}
          onOpenImportExportModal={() => setIsImportExportModalOpen(true)}
        />
        
        <div className="flex-1">
          {judges.length === 0 ? (
            <EmptyState onJudgesImported={(importedJudges) => setJudges(importedJudges)} />
          ) : (
            <div className="relative flex h-full items-stretch">
              <div className="flex-1 min-w-0 overflow-x-auto">
                <SessionsArea 
                  judges={judges} 
                  setJudges={setJudges}
                  onScheduledSessionsChange={handleScheduledSessionsChange}
                  scheduledSessions={scheduledSessions}
                  allSessionBlocks={allSessionBlocks}
                  onSessionBlockUpdate={handleSessionBlockUpdate}
                  onSessionBlocksReplace={handleSessionBlocksReplace}
                  entrantJudgeAssignments={entrantJudgeAssignments}
                  scheduleConflicts={scheduleConflicts}
                />
              </div>
              
              <PreferencesPanel 
                judges={judges} 
                entrantJudgeAssignments={entrantJudgeAssignments}
                allSessionBlocks={allSessionBlocks}
                scheduleConflicts={scheduleConflicts}
                onSessionBlocksReplace={handleSessionBlocksReplace}
                isOpen={isPreferencesOpen}
                onToggle={handlePreferencesToggle}
              />
            </div>
          )}
        </div>

        <JudgesModal
          isOpen={isJudgesModalOpen}
          onClose={() => setIsJudgesModalOpen(false)}
          onModalClose={handleJudgesModalClose}
        />

        <EntrantsModal
          isOpen={isEntrantsModalOpen}
          onClose={() => setIsEntrantsModalOpen(false)}
          onModalClose={handleEntrantsModalClose}
          judges={judges}
          sessionBlocks={allSessionBlocks}
          onSessionBlocksReplace={handleSessionBlocksReplace}
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

        <Footer showAdminGuide />
      </div>
    </SettingsProvider>
  )
}

export default CreatePage
