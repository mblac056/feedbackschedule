import type { Judge } from '../types';
import CSVImport from './CSVImport';

interface EmptyStateProps {
  onJudgesImported?: (judges: Judge[]) => void;
}

export default function EmptyState({ onJudgesImported }: EmptyStateProps) {
  const handleImportComplete = (judges: Judge[]) => {
    if (onJudgesImported) {
      onJudgesImported(judges);
    }
  };

  return (
    <div className="text-center py-16">
      
      <div className="max-w-md mx-auto">
        <CSVImport 
          variant="empty-state"
          onImportComplete={handleImportComplete}
        />
      </div>
    </div>
  );
}
