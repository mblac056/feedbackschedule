import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FaChevronDown, FaCopy, FaCheck } from 'react-icons/fa';
import { buildPublishedPayload } from '../utils/buildPublishedPayload';
import { getEntrants, getJudges, getSessionBlocks, getSettings } from '../utils/localStorage';
import { getPublishCredentials, setPublishCredentials } from '../utils/publishStorage';
import { putPublishedSchedule, ScheduleApiError } from '../utils/scheduleApi';
import { formatCode, generateCode, generateEditToken } from '../utils/publishCodes';

const MAX_COLLISION_RETRIES = 5;

type PublishControlsProps = {
  /** Same gate as Print — red conflicts disable publish actions. */
  disabled?: boolean;
};

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

export default function PublishControls({ disabled = false }: PublishControlsProps) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [lastPublishedCode, setLastPublishedCode] = useState<string | null>(
    () => getPublishCredentials()?.code ?? null
  );
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (disabled) {
      setShowDropdown(false);
    }
  }, [disabled]);

  useEffect(() => {
    if (!showDropdown) return;
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest('.publish-dropdown-container')) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showDropdown]);

  const handlePublish = async () => {
    if (disabled || busy) return;
    setShowDropdown(false);
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
    if (disabled || busy) return;
    setShowDropdown(false);
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

  const handlePreview = () => {
    if (disabled) return;
    setShowDropdown(false);
    navigate('/preview');
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

  const disabledClass = disabled
    ? 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed opacity-70'
    : 'bg-gray-600 hover:bg-gray-800 text-white';

  return (
    <>
      <div className="relative shrink-0 publish-dropdown-container">
        <div className="flex">
          <button
            type="button"
            className={`px-4 py-2 rounded-l-md transition-colors ${disabledClass}`}
            onClick={() => void handlePublish()}
            disabled={disabled || busy}
          >
            {busy ? 'Publishing…' : 'Publish'}
          </button>
          <button
            type="button"
            className={`px-2 py-2 rounded-r-md transition-colors border-l ${
              disabled
                ? 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-600 cursor-not-allowed opacity-70'
                : 'bg-gray-600 hover:bg-gray-800 text-white border-gray-300 dark:border-gray-500'
            }`}
            onClick={() => {
              if (disabled || busy) return;
              setShowDropdown((open) => !open);
            }}
            disabled={disabled || busy}
            aria-label="Publish options"
            aria-expanded={showDropdown}
          >
            <FaChevronDown className={`transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {showDropdown && (
          <div className="absolute top-full z-50 left-0 mt-1 bg-white dark:bg-gray-800 border border-[var(--primary-color)] rounded-md shadow-lg w-max min-w-44">
            <div className="p-1">
              <button
                type="button"
                onClick={() => void handlePublish()}
                className="w-full text-left px-3 my-1 py-1 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors whitespace-nowrap"
              >
                Publish
              </button>
              <button
                type="button"
                onClick={() => void handlePublishAsNew()}
                className="w-full text-left px-3 my-1 py-1 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors whitespace-nowrap"
              >
                Publish as new
              </button>
              <button
                type="button"
                onClick={handlePreview}
                className="w-full text-left px-3 my-1 py-1 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors whitespace-nowrap"
              >
                Preview
              </button>
            </div>
          </div>
        )}
      </div>

      {(lastPublishedCode || error) && (
        <div className="basis-full w-full flex flex-col gap-1">
          {lastPublishedCode && (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-gray-600 dark:text-gray-300">Code:</span>
              <code className="font-mono tracking-wider text-gray-900 dark:text-gray-100">
              <Link
                to={`/${lastPublishedCode}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--primary-color)] hover:underline focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)] rounded"
              >
                {formatCode(lastPublishedCode)}
              </Link>
              </code>
              <button
                type="button"
                onClick={() => void handleCopy()}
                className="p-1.5 rounded border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:text-gray-800 hover:border-gray-800 focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 transition-colors"
                aria-label="Copy publish code"
                title="Copy code"
              >
                {copied ? <FaCheck className="text-sm text-green-600" /> : <FaCopy className="text-sm" />}
              </button>
            </div>
          )}
          {error && (
            <p className="text-sm text-red-600 dark:text-red-400" role="alert">
              {error}
            </p>
          )}
        </div>
      )}
    </>
  );
}
