import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { RiLayoutMasonryFill } from 'react-icons/ri';
import { markdownToHtml } from '../utils/simpleMarkdown';

export default function AdminGuidePage() {
  const [html, setHtml] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    fetch('/Administrative-User-Guide.md')
      .then((response) => {
        if (!response.ok) {
          throw new Error('Could not load the administrative user guide.');
        }
        return response.text();
      })
      .then((markdown) => {
        if (!cancelled) {
          setHtml(markdownToHtml(markdown));
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not load the guide.');
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      <header className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between gap-3">
          <Link
            to="/"
            className="flex items-center gap-2 min-w-0 focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)] rounded"
            title="Enter a schedule code"
          >
            <RiLayoutMasonryFill className="text-2xl text-[var(--primary-color)] shrink-0" />
            <span className="text-xl font-bold text-[var(--primary-color)] truncate">
              Feedback Schedule
            </span>
          </Link>
          <Link
            to="/create"
            className="text-sm font-medium text-[var(--primary-color)] hover:underline focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)] rounded shrink-0"
          >
            ← Back to create
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        {loading && <p className="text-gray-600 dark:text-gray-400">Loading guide…</p>}
        {error && (
          <p className="text-red-600 dark:text-red-400" role="alert">
            {error}
          </p>
        )}
        {!loading && !error && (
          <article
            className="admin-guide prose-guide"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        )}
      </main>
    </div>
  );
}
