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
import { isTextEditingTarget, matchUndoRedoShortcut } from '../utils/undoShortcuts';

function CreatePage() {
  const {
    judges,
    allSessionBlocks,
    scheduledSessions,
    entrantJudgeAssignments,
    scheduleConflicts,
    setJudges,
    handleSessionBlocksReplace,
    handleScheduledSessionsChange,
    handleClearGrid,
    handleUndoGridChange,
    handleRedoGridChange,
  } = useSessionManagement();

  const [isJudgesModalOpen, setIsJudgesModalOpen] = useState(false);
  const [isEntrantsModalOpen, setIsEntrantsModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isImportExportModalOpen, setIsImportExportModalOpen] = useState(false);
  const [isPreferencesOpen, setIsPreferencesOpen] = useState(false);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (isTextEditingTarget(target)) {
        return;
      }

      const undoRedo = matchUndoRedoShortcut(event);
      if (undoRedo === 'undo') {
        event.preventDefault();
        handleUndoGridChange();
        return;
      }
      if (undoRedo === 'redo') {
        event.preventDefault();
        handleRedoGridChange();
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
  }, [handleRedoGridChange, handleUndoGridChange]);

  const handleJudgesModalClose = () => {
    const updatedJudges = getJudges();
    const inactiveJudgeIds = new Set(updatedJudges.filter(j => j.active === false).map(j => j.id));
    const nextBlocks = allSessionBlocks.map((block) => (
      block.judgeId && inactiveJudgeIds.has(block.judgeId)
        ? {
            ...block,
            isScheduled: false,
            startRowIndex: undefined,
            endRowIndex: undefined,
            judgeId: undefined,
          }
        : block
    ));
    if (nextBlocks.some((block, index) => block !== allSessionBlocks[index])) {
      handleSessionBlocksReplace(nextBlocks);
    }
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
