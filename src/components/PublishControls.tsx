import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FaChevronDown, FaCopy, FaCheck } from 'react-icons/fa';
import type { Entrant, Judge, SessionBlock } from '../types';
import type { SessionSettings } from '../config/timeConfig';
import { buildPublishedPayload } from '../utils/buildPublishedPayload';
import {
  getPublishCredentials,
  PUBLISH_CREDENTIALS_CHANGED,
  updatePublishMeta,
  type PublishCredentials,
} from '../utils/publishStorage';
import {
  checkPublishStatus,
  putPublishedSchedule,
  ScheduleApiError,
  userMessageForApiError,
  type PublishStatus,
} from '../utils/scheduleApi';
import { formatCode } from '../utils/publishCodes';
import { buildCurrentPayload, publishWithNewCode, recordPublish } from '../utils/publishActions';
import { invalidatePublishedScheduleCache } from '../utils/publishedScheduleCache';
import { fingerprintPayload } from '../utils/publishFingerprint';
import {
  derivePublishState,
  effectiveExpiresAt,
  formatExpiryDate,
  isExpiringSoon,
  type PublishDisplayState,
} from '../utils/publishStatus';

const FINGERPRINT_DEBOUNCE_MS = 300;

type PublishControlsProps = {
  /** Same gate as Print — red conflicts disable publish actions. */
  disabled?: boolean;
  /** Live editor state, used to tell whether the published copy is out of date. */
  judges: Judge[];
  entrants: Entrant[];
  sessionBlocks: SessionBlock[];
  settings: SessionSettings;
};

const STATE_LABELS: Record<PublishDisplayState, { label: string; detail?: string; tone: string }> = {
  'up-to-date': { label: 'Live', detail: 'up to date', tone: 'text-green-700 dark:text-green-400' },
  'out-of-date': { label: 'Live, out of date', detail: 'unpublished changes', tone: 'text-amber-700 dark:text-amber-400' },
  reserved: { label: 'Reserved', detail: 'nothing published yet', tone: 'text-blue-700 dark:text-blue-400' },
  'reserved-pending': { label: 'Reserved', detail: 'schedule not published yet', tone: 'text-amber-700 dark:text-amber-400' },
  expired: { label: 'Expired', detail: 'Publish to restore', tone: 'text-red-700 dark:text-red-400' },
  'changed-elsewhere': { label: 'Live', detail: 'updated from another device', tone: 'text-amber-700 dark:text-amber-400' },
  'token-rejected': { label: 'Edit token rejected', detail: 'use Publish as new', tone: 'text-red-700 dark:text-red-400' },
  unknown: { label: 'Live', tone: 'text-gray-700 dark:text-gray-300' },
};

export default function PublishControls({
  disabled = false,
  judges,
  entrants,
  sessionBlocks,
  settings,
}: PublishControlsProps) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [credentials, setCredentials] = useState<PublishCredentials | null>(() => getPublishCredentials());
  const [serverStatus, setServerStatus] = useState<PublishStatus | null>(null);
  const [currentFingerprint, setCurrentFingerprint] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const lastPublishedCode = credentials?.code ?? null;

  useEffect(() => {
    const onChange = () => setCredentials(getPublishCredentials());
    window.addEventListener(PUBLISH_CREDENTIALS_CHANGED, onChange);
    return () => window.removeEventListener(PUBLISH_CREDENTIALS_CHANGED, onChange);
  }, []);

  const currentPayload = useMemo(
    () => buildPublishedPayload({ judges, entrants, sessionBlocks, settings }),
    [judges, entrants, sessionBlocks, settings]
  );

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      fingerprintPayload(currentPayload)
        .then((fp) => {
          if (!cancelled) setCurrentFingerprint(fp);
        })
        .catch(() => {
          if (!cancelled) setCurrentFingerprint(null);
        });
    }, FINGERPRINT_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [currentPayload]);

  // Ask the server once per code whether it's still live and who last changed it.
  const credentialCode = credentials?.code;
  const credentialToken = credentials?.editToken;
  useEffect(() => {
    setServerStatus(null);
    if (!credentialCode || !credentialToken) return;
    const controller = new AbortController();
    checkPublishStatus(credentialCode, credentialToken, controller.signal)
      .then((status) => {
        if (controller.signal.aborted) return;
        setServerStatus(status);
        const stored = getPublishCredentials();
        // Backfill dates for credentials saved before status tracking existed.
        if (status.state === 'live' && stored && !stored.updatedAt) {
          updatePublishMeta(credentialCode, { updatedAt: status.updatedAt, expiresAt: status.expiresAt });
        }
      })
      .catch(() => {
        // Offline, local dev without functions, or an older server: show what we know locally.
      });
    return () => controller.abort();
  }, [credentialCode, credentialToken]);

  const displayState = credentials
    ? derivePublishState({
        credentials,
        currentFingerprint,
        currentSessionCount: currentPayload.sessions.length,
        server: serverStatus,
      })
    : null;
  const expiresAt = credentials ? effectiveExpiresAt(credentials, serverStatus) : undefined;
  const expiryLabel = formatExpiryDate(expiresAt);
  const expiringSoon = isExpiringSoon(expiresAt);
  const needsPublish =
    displayState === 'out-of-date' || displayState === 'reserved-pending' || displayState === 'expired';

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
          const payload = buildCurrentPayload();
          // Unknown count (published before tracking) is treated as "had sessions" to be safe.
          const hadSessions = (credentials.publishedSessionCount ?? 1) > 0;
          if (
            payload.sessions.length === 0 &&
            hadSessions &&
            !window.confirm(
              `This will replace the live schedule at ${formatCode(credentials.code)} with an empty “coming soon” page. Continue?`
            )
          ) {
            return;
          }
          const result = await putPublishedSchedule(credentials.code, credentials.editToken, payload);
          await recordPublish(credentials.code, credentials.editToken, payload, result);
          setServerStatus(null);
          invalidatePublishedScheduleCache(credentials.code);
        } catch (err) {
          if (err instanceof ScheduleApiError && err.status === 403) {
            setServerStatus({ state: 'forbidden' });
            setError('Cannot update this schedule (edit token rejected). Use “Publish as new”.');
            return;
          }
          throw err;
        }
      } else {
        const code = await publishWithNewCode();
        setServerStatus(null);
        invalidatePublishedScheduleCache(code);
      }
    } catch (err) {
      setError(userMessageForApiError(err, 'Publish failed'));
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
      setServerStatus(null);
      invalidatePublishedScheduleCache(code);
    } catch (err) {
      setError(userMessageForApiError(err, 'Publish failed'));
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
    : needsPublish
      ? 'bg-[var(--primary-color)] hover:bg-[var(--primary-color-dark)] text-white'
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
                : needsPublish
                  ? 'bg-[var(--primary-color)] hover:bg-[var(--primary-color-dark)] text-white border-white/40'
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
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm" aria-live="polite">
              {displayState && (
                <span className={`font-semibold ${STATE_LABELS[displayState].tone}`}>
                  {STATE_LABELS[displayState].label}
                </span>
              )}
              <span className="text-gray-400" aria-hidden="true">·</span>
              <code className="font-mono tracking-wider dark:text-gray-100 text-[var(--primary-color)]">
              <Link
                to={`/${lastPublishedCode}`}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)] rounded"
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
              {displayState && STATE_LABELS[displayState].detail && (
                <span className={STATE_LABELS[displayState].tone}>· {STATE_LABELS[displayState].detail}</span>
              )}
              {expiryLabel && displayState !== 'expired' && displayState !== 'token-rejected' && (
                <span
                  className={
                    expiringSoon
                      ? 'text-amber-700 dark:text-amber-400 font-medium'
                      : 'text-gray-500 dark:text-gray-400'
                  }
                >
                  · expires {expiryLabel}
                </span>
              )}
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
