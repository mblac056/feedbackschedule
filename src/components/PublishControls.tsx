import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FaCopy, FaCheck } from 'react-icons/fa';
import { buildPublishedPayload } from '../utils/buildPublishedPayload';
import { getEntrants, getJudges, getSessionBlocks, getSettings } from '../utils/localStorage';
import { getPublishCredentials, setPublishCredentials } from '../utils/publishStorage';
import { putPublishedSchedule, ScheduleApiError } from '../utils/scheduleApi';
import { formatCode, generateCode, generateEditToken } from '../utils/publishCodes';

const MAX_COLLISION_RETRIES = 5;

function buildCurrentPayload() {
  return buildPublishedPayload({
    judges: getJudges(),
    entrants: getEntrants(),
    sessionBlocks: getSessionBlocks(),
    settings: getSettings(),
  });
}

async function publishWithNewCode(): Promise<string> {
  const payload = buildCurrentPayload();
  const prefix = getSettings().codePrefix;
  let lastError: unknown;

  for (let attempt = 0; attempt < MAX_COLLISION_RETRIES; attempt++) {
    const code = generateCode(prefix);
    const editToken = generateEditToken();
    try {
      await putPublishedSchedule(code, editToken, payload);
      setPublishCredentials(code, editToken);
      return code;
    } catch (err) {
      lastError = err;
      // Netlify returns 403 when code exists with a non-matching token; 409 is also collision.
      if (
        err instanceof ScheduleApiError &&
        (err.status === 403 || err.status === 409)
      ) {
        continue;
      }
      throw err;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('Could not publish: too many code collisions');
}

export default function PublishControls() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [lastPublishedCode, setLastPublishedCode] = useState<string | null>(
    () => getPublishCredentials()?.code ?? null
  );
  const [copied, setCopied] = useState(false);

  const handlePublishOrUpdate = async () => {
    setBusy(true);
    setError('');
    try {
      const credentials = getPublishCredentials();
      if (credentials) {
        try {
          await putPublishedSchedule(
            credentials.code,
            credentials.editToken,
            buildCurrentPayload()
          );
          setLastPublishedCode(credentials.code);
        } catch (err) {
          if (err instanceof ScheduleApiError && err.status === 403) {
            setError('Cannot update this schedule (edit token rejected). Use “Publish as new”.');
            return;
          }
          throw err;
        }
      } else {
        const code = await publishWithNewCode();
        setLastPublishedCode(code);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Publish failed');
    } finally {
      setBusy(false);
    }
  };

  const handlePublishAsNew = async () => {
    setBusy(true);
    setError('');
    try {
      const code = await publishWithNewCode();
      setLastPublishedCode(code);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Publish failed');
    } finally {
      setBusy(false);
    }
  };

  const handleCopy = async () => {
    if (!lastPublishedCode) return;
    try {
      await navigator.clipboard.writeText(formatCode(lastPublishedCode));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Could not copy code to clipboard');
    }
  };

  const hasPublishedCode = Boolean(lastPublishedCode);

  return (
    <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
      <div className="mx-auto px-4 sm:px-6 lg:px-8 py-2 flex flex-wrap items-center gap-2 sm:gap-3">
        <button
          type="button"
          onClick={handlePublishOrUpdate}
          disabled={busy}
          className="px-3 py-1.5 text-sm bg-[var(--primary-color)] text-white rounded-lg hover:bg-[var(--primary-color-dark)] focus:ring-2 focus:ring-[var(--primary-color)] focus:ring-offset-2 dark:focus:ring-offset-gray-900 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {busy ? 'Publishing…' : hasPublishedCode ? 'Update' : 'Publish'}
        </button>
        <button
          type="button"
          onClick={handlePublishAsNew}
          disabled={busy}
          className="px-3 py-1.5 text-sm bg-gray-600 text-white rounded-lg hover:bg-gray-700 focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          Publish as new
        </button>

        {lastPublishedCode && (
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm text-gray-600 dark:text-gray-300">Code:</span>
            <code className="font-mono text-sm tracking-wider text-gray-900 dark:text-gray-100">
              {formatCode(lastPublishedCode)}
            </code>
            <button
              type="button"
              onClick={handleCopy}
              className="p-1.5 rounded border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:text-[var(--primary-color)] hover:border-[var(--primary-color)] focus:ring-2 focus:ring-[var(--primary-color)] focus:ring-offset-2 dark:focus:ring-offset-gray-900 transition-colors"
              aria-label="Copy publish code"
              title="Copy code"
            >
              {copied ? <FaCheck className="text-sm text-green-600" /> : <FaCopy className="text-sm" />}
            </button>
            <Link
              to={`/${lastPublishedCode}`}
              className="text-sm text-[var(--primary-color)] hover:underline focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)] rounded"
            >
              Open published view
            </Link>
          </div>
        )}

        {error && (
          <p className="w-full text-sm text-red-600 dark:text-red-400" role="alert">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
