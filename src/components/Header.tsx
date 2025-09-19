import { RiLayoutMasonryFill } from "react-icons/ri";

interface HeaderProps {
  onOpenJudgesModal: () => void;
  onOpenEntrantsModal: () => void;
  onOpenSettingsModal: () => void;
  onOpenImportExportModal: () => void;
}

export default function Header({ onOpenJudgesModal, onOpenEntrantsModal, onOpenSettingsModal, onOpenImportExportModal }: HeaderProps) {


  return (
    <div className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-2">
          <RiLayoutMasonryFill className="text-2xl text-[var(--primary-color)]" />
          <h1 className="text-2xl font-bold text-[var(--primary-color)]">Feedback Matrix</h1>
          </div>
          <div className="flex space-x-3">
            <button
              onClick={onOpenEntrantsModal}
              className="px-4 py-2 bg-[var(--primary-color)] text-white rounded-lg hover:bg-[var(--primary-color-dark)] focus:ring-2 focus:ring-[var(--primary-color)] focus:ring-offset-2 transition-colors"
            >
              Manage Entrants
            </button>
            <button
              onClick={onOpenJudgesModal}
              className="px-4 py-2 bg-[var(--primary-color)] text-white rounded-lg hover:bg-[var(--primary-color-dark)] focus:ring-2 focus:ring-[var(--primary-color)] focus:ring-offset-2 transition-colors"
            >
              Manage Judges
            </button>
            <button
              onClick={onOpenImportExportModal}
              className="px-4 py-2 bg-[var(--secondary-color)] rounded-lg hover:bg-[var(--secondary-color-dark)] focus:ring-2 focus:ring-[var(--secondary-color)] focus:ring-offset-2 transition-colors"
              title="Import/Export (Press 'E' for quick export)"
            >
              Import/Export
            </button>
            <button
              onClick={onOpenSettingsModal}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
            >
              Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
