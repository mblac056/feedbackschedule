import { useState } from 'react';
import { Link } from 'react-router-dom';
import { RiLayoutMasonryFill } from 'react-icons/ri';
import { FiRefreshCcw } from 'react-icons/fi';
import type { PublishedSchedulePayload } from '../../types/publishedSchedule';
import { downloadPublishedMatrixPdf } from '../../utils/publishedPdf';

type Props = {
  payload: PublishedSchedulePayload;
  personBasePath: string; // '/preview' or `/${code}`
  title?: string;
  /** Shown on local preview so creators can return to the editor. */
  showBackToCreate?: boolean;
};

type Tab = 'entrants' | 'judges';

export default function PublicScheduleHub({ payload, personBasePath, title, showBackToCreate = false }: Props) {
  const [tab, setTab] = useState<Tab>('entrants');
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfError, setPdfError] = useState('');

  const heading = title ?? (payload.exportName?.trim() || 'Feedback Schedule');
  const base = personBasePath.replace(/\/$/, '');

  const people = (
    tab === 'entrants'
      ? payload.entrants.map((e) => ({
          id: e.id,
          name: e.name,
          slug: payload.slugs[e.id],
        }))
      : payload.judges.map((j) => ({
          id: j.id,
          name: j.category ? `${j.name} (${j.category})` : j.name,
          slug: payload.slugs[j.id],
        }))
  )
    .filter((p) => p.slug)
    .sort((a, b) => a.name.localeCompare(b.name));

  const handleDownload = async () => {
    setPdfError('');
    setPdfBusy(true);
    try {
      await downloadPublishedMatrixPdf(payload);
    } catch {
      setPdfError('Could not generate PDF. Please try again.');
    } finally {
      setPdfBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      <div className="max-w-2xl mx-auto px-4 py-8 flex flex-col gap-6">
        <header className="flex flex-col gap-4">
          {showBackToCreate && (
            <Link
              to="/create"
              className="inline-flex items-center w-fit px-3 py-1.5 text-sm font-medium rounded-lg bg-gray-600 text-white hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 dark:focus:ring-offset-gray-950 transition-colors"
            >
              ← Back to create
            </Link>
          )}
          <div className="flex items-center justify-between gap-3">
            <Link
              to="/"
              className="flex items-center gap-2 min-w-0 focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)] rounded"
              title="Enter a schedule code"
            >
              <RiLayoutMasonryFill className="text-2xl text-[var(--primary-color)] shrink-0" />
              <span className="text-xl font-bold text-[var(--primary-color)] truncate">Feedback Schedule</span>
            </Link>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="p-2 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:text-[var(--primary-color)] hover:border-[var(--primary-color)] focus:ring-2 focus:ring-[var(--primary-color)] focus:ring-offset-2 dark:focus:ring-offset-gray-950 transition-colors shrink-0"
              aria-label="Refresh"
              title="Refresh"
            >
              <FiRefreshCcw className="text-lg" />
            </button>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{heading}</h1>
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
            <button
              type="button"
              onClick={() => void handleDownload()}
              disabled={pdfBusy || payload.sessions.length === 0}
              className="px-4 py-2 bg-[var(--primary-color)] text-white font-medium rounded-lg hover:bg-[var(--primary-color-dark)] disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)] focus:ring-offset-2 dark:focus:ring-offset-gray-950 transition-colors"
            >
              {pdfBusy ? 'Preparing PDF…' : 'Download full grid PDF'}
            </button>
            {pdfError && (
              <p className="text-red-600 dark:text-red-400 text-sm" role="alert">
                {pdfError}
              </p>
            )}
          </div>
        </header>

        <div className="flex gap-2 border-b border-gray-300 dark:border-gray-700" role="tablist">
          {(['entrants', 'judges'] as const).map((key) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                tab === key
                  ? 'border-[var(--primary-color)] text-[var(--primary-color)]'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
              }`}
            >
              {key === 'entrants' ? 'Entrant Schedules' : 'Judge Schedules'}
            </button>
          ))}
        </div>

        {people.length === 0 ? (
          <p className="text-gray-600 dark:text-gray-400 text-sm">No scheduled people yet.</p>
        ) : (
          <ul className="divide-y divide-gray-200 dark:divide-gray-800 border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden bg-white dark:bg-gray-900">
            {people.map((person) => (
              <li key={person.id}>
                <Link
                  to={`${base}/${person.slug}`}
                  className="block px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/80 focus:outline-none focus:bg-gray-50 dark:focus:bg-gray-800/80 text-[var(--primary-color)]"
                >
                  {person.name}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
