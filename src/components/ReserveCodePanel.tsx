import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FaCheck, FaCopy } from 'react-icons/fa';
import { useSettings } from '../contexts/useSettings';
import { buildPlaceholderPayload, publishWithNewCode } from '../utils/publishActions';
import { getPublishCredentials, PUBLISH_CREDENTIALS_CHANGED, type PublishCredentials } from '../utils/publishStorage';
import { formatCode } from '../utils/publishCodes';
import { userMessageForApiError } from '../utils/scheduleApi';
import ExistingCodeForm from './ExistingCodeForm';

type Props = {
  /** Round name to show on the "coming soon" page. */
  roundName: string;
  /** Code prefix to use; defaults to the saved setting. */
  codePrefix?: string;
};

type CopyTarget = 'code' | 'token' | null;

/**
 * Reserve a code ahead of time by publishing an empty "coming soon" page, or, once
 * this browser holds a code, show it with its edit token.
 */
export default function ReserveCodePanel({ roundName, codePrefix }: Props) {
  const { settings, setSettings } = useSettings();
  const [credentials, setCredentials] = useState<PublishCredentials | null>(() => getPublishCredentials());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [copied, setCopied] = useState<CopyTarget>(null);
  const [showExisting, setShowExisting] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    const onChange = () => setCredentials(getPublishCredentials());
    window.addEventListener(PUBLISH_CREDENTIALS_CHANGED, onChange);
    return () => window.removeEventListener(PUBLISH_CREDENTIALS_CHANGED, onChange);
  }, []);

  const handleReserve = async () => {
    if (busy) return;
    const name = roundName.trim();
    if (!name) {
      setError('Enter a Feedback Round name above first. It’s the title attendees will see.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const prefix = codePrefix ?? settings.codePrefix ?? '';
      const next = { ...settings, exportName: name, codePrefix: prefix };
      // Save the name so later publishes to this code keep the same title.
      setSettings(next);
      await publishWithNewCode(buildPlaceholderPayload(next), prefix);
    } catch (err) {
      setError(userMessageForApiError(err, 'Could not reserve a code'));
    } finally {
      setBusy(false);
    }
  };

  const copy = async (target: Exclude<CopyTarget, null>, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(target);
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      setError('Could not copy to clipboard');
    }
  };

  const copyButton = (target: Exclude<CopyTarget, null>, text: string, label: string) => (
    <button
      type="button"
      onClick={() => void copy(target, text)}
      className="p-1.5 rounded border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:text-gray-800 hover:border-gray-800 focus:ring-2 focus:ring-gray-500 transition-colors shrink-0"
      aria-label={label}
      title={label}
    >
      {copied === target ? <FaCheck className="text-sm text-green-600" /> : <FaCopy className="text-sm" />}
    </button>
  );

  const existingSection = showExisting ? (
    <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
      <ExistingCodeForm
        onDone={(message) => {
          setShowExisting(false);
          setShowToken(false);
          setError('');
          setNotice(message);
        }}
        onCancel={() => setShowExisting(false)}
      />
    </div>
  ) : (
    <button
      type="button"
      onClick={() => {
        setNotice('');
        setShowExisting(true);
      }}
      className="block text-sm text-gray-600 dark:text-gray-300 underline hover:no-underline"
    >
      {credentials ? 'Switch to a different code' : 'Use an existing code'}
    </button>
  );

  const noticeLine = notice ? <p className="text-sm text-green-700 dark:text-green-400">{notice}</p> : null;

  if (credentials) {
    const count = credentials.publishedSessionCount;
    const summary =
      count === undefined
        ? 'Published'
        : count === 0
          ? 'Reserved · nothing published yet'
          : `Published · ${count} session${count === 1 ? '' : 's'}`;
    return (
      <div className="space-y-2 text-sm">
        <div className="flex items-center gap-2">
          <span className="text-gray-600 dark:text-gray-300">This browser publishes to</span>
          <code className="font-mono tracking-wider text-[var(--primary-color)]">
            <Link to={`/${credentials.code}`} target="_blank" rel="noopener noreferrer" className="hover:underline">
              {formatCode(credentials.code)}
            </Link>
          </code>
          {copyButton('code', formatCode(credentials.code), 'Copy publish code')}
        </div>
        <p className="text-gray-500 dark:text-gray-400">
          {summary}
        </p>
        {showToken ? (
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <code className="font-mono text-xs break-all bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                {credentials.editToken}
              </code>
              {copyButton('token', credentials.editToken, 'Copy edit token')}
            </div>
            <p className="text-xs text-amber-700 dark:text-amber-400">
              Anyone with this code and token can change the published schedule. Exports include it too.
            </p>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowToken(true)}
            className="text-gray-600 dark:text-gray-300 underline hover:no-underline"
          >
            Show edit token
          </button>
        )}
        {error && (
          <p className="text-red-600 dark:text-red-400" role="alert">
            {error}
          </p>
        )}
        {noticeLine}
        {existingSection}
      </div>
    );
  }

  return (
    <div className="space-y-2 text-sm text-left">
      <button
        type="button"
        onClick={() => void handleReserve()}
        disabled={busy}
        className="px-4 py-2 rounded-md bg-gray-600 hover:bg-gray-800 text-white disabled:opacity-60 transition-colors"
      >
        {busy ? 'Reserving…' : 'Reserve a code'}
      </button>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        Posts a “coming soon” page with the round name so you can share the code now. Build the schedule later and
        Publish to the same code.
      </p>
      {error && (
        <p className="text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      )}
      {noticeLine}
      {existingSection}
    </div>
  );
}
