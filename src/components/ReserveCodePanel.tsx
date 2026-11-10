import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { FaCheck, FaCopy } from 'react-icons/fa';
import { useSettings } from '../contexts/useSettings';
import { buildPlaceholderPayload, publishWithNewCode } from '../utils/publishActions';
import { getPublishCredentials, PUBLISH_CREDENTIALS_CHANGED, type PublishCredentials } from '../utils/publishStorage';
import { formatCode, normalizeCode } from '../utils/publishCodes';
import { userMessageForApiError } from '../utils/scheduleApi';
import { claimExistingCode } from '../utils/claimExistingCode';

type Props = {
  /** Round name to show on the "coming soon" page. */
  roundName: string;
  /** Code prefix to use; defaults to the saved setting. */
  codePrefix?: string;
};

type CopyTarget = 'code' | 'token' | null;

const CLAIM_ERRORS: Record<string, string> = {
  'invalid-code': 'Enter a six-character code (ABC-DEF).',
  'missing-token': 'Paste the edit token for this code.',
  'wrong-token': 'That edit token doesn’t match this code.',
  'not-found': 'No live schedule at that code.',
  'storage-failed': 'This browser couldn’t save the code. Free storage space and try again.',
};

const MOTION = 'transition-[translate,opacity] duration-300 ease-out motion-reduce:transition-none';

/**
 * Two versions of one row stacked in the same spot. Switching slides the current one
 * out to the left and the other in from the right (and back again on cancel).
 * The hidden version can't take focus.
 */
function SideSwap({ editing, view, edit }: { editing: boolean; view: ReactNode; edit: ReactNode }) {
  return (
    <div className="grid items-center overflow-hidden">
      <div
        className={`[grid-area:1/1] p-1 ${MOTION} ${editing ? '-translate-x-full opacity-0' : 'translate-x-0 opacity-100'}`}
        inert={editing}
        aria-hidden={editing}
      >
        {view}
      </div>
      <div
        className={`[grid-area:1/1] p-1 ${MOTION} ${editing ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}`}
        inert={!editing}
        aria-hidden={!editing}
      >
        {edit}
      </div>
    </div>
  );
}

/** Content that collapses to zero height when closed. */
function Collapse({ open, children }: { open: boolean; children: ReactNode }) {
  return (
    <div
      className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out motion-reduce:transition-none ${
        open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
      }`}
      inert={!open}
      aria-hidden={!open}
    >
      <div className="overflow-hidden">{children}</div>
    </div>
  );
}

/**
 * Settings → Publishing. Shows this browser's Publish Code and Edit Token (or a Reserve
 * button). "Use a different code" turns both values into inputs in place.
 */
export default function ReserveCodePanel({ roundName, codePrefix }: Props) {
  const { settings, setSettings } = useSettings();
  const [credentials, setCredentials] = useState<PublishCredentials | null>(() => getPublishCredentials());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [copied, setCopied] = useState<CopyTarget>(null);

  const [editing, setEditing] = useState(false);
  const [codeInput, setCodeInput] = useState('');
  const [tokenInput, setTokenInput] = useState('');
  const codeInputRef = useRef<HTMLInputElement>(null);
  const switchRef = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef(false);

  useEffect(() => {
    const onChange = () => setCredentials(getPublishCredentials());
    window.addEventListener(PUBLISH_CREDENTIALS_CHANGED, onChange);
    return () => window.removeEventListener(PUBLISH_CREDENTIALS_CHANGED, onChange);
  }, []);

  // Focus follows the swap: into the code field on open, back to the link on close.
  useEffect(() => {
    if (editing) {
      codeInputRef.current?.focus({ preventScroll: true });
    } else if (restoreFocus.current) {
      restoreFocus.current = false;
      switchRef.current?.focus({ preventScroll: true });
    }
  }, [editing]);

  const handleReserve = async () => {
    if (busy) return;
    const name = roundName.trim();
    if (!name) {
      setError('Enter a Feedback Round name above first. It’s the title attendees will see.');
      return;
    }
    setBusy(true);
    setError('');
    setNotice('');
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

  const openEditor = () => {
    setCodeInput('');
    setTokenInput('');
    setError('');
    setNotice('');
    setShowToken(false);
    setEditing(true);
  };

  const closeEditor = () => {
    restoreFocus.current = true;
    setError('');
    setEditing(false);
  };

  const handleClaim = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editing || busy) return;
    setError('');
    const normalized = normalizeCode(codeInput);
    if (
      credentials &&
      credentials.code !== normalized &&
      normalized.length === 6 &&
      !window.confirm(
        `This browser currently publishes to ${formatCode(credentials.code)}. Switch to ${formatCode(normalized)}? Keep an export if you still need to update ${formatCode(credentials.code)}.`
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      const result = await claimExistingCode(codeInput, tokenInput);
      if (result.outcome === 'saved') {
        closeEditor();
        setNotice(`This browser now publishes to ${formatCode(result.code)}.`);
      } else if (result.outcome === 'saved-expired') {
        closeEditor();
        setNotice(`${formatCode(result.code)} has expired. It’s saved here; Publish to restore it.`);
      } else {
        setError(CLAIM_ERRORS[result.outcome]);
      }
    } catch (err) {
      setError(userMessageForApiError(err, 'Could not check that code. Try again.'));
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
      className="p-1.5 rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 hover:text-gray-800 hover:border-gray-800 focus:ring-2 focus:ring-gray-500 transition-colors shrink-0"
      aria-label={label}
      title={label}
    >
      {copied === target ? <FaCheck className="text-sm text-green-600" /> : <FaCopy className="text-sm" />}
    </button>
  );

  const inputClass =
    'w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-500';
  const linkClass =
    'text-sm text-gray-600 dark:text-gray-300 underline hover:no-underline focus:outline-none focus:ring-2 focus:ring-gray-500 rounded';
  const none = <span className="text-gray-400 dark:text-gray-500 italic leading-8">None yet</span>;

  const codeView = credentials ? (
    <div className="flex items-center gap-2">
      <code className="font-mono tracking-wider text-[var(--primary-color)]">
        <Link to={`/${credentials.code}`} target="_blank" rel="noopener noreferrer" className="hover:underline">
          {formatCode(credentials.code)}
        </Link>
      </code>
      {copyButton('code', formatCode(credentials.code), 'Copy publish code')}
    </div>
  ) : (
    none
  );

  const tokenView = credentials ? (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => setShowToken((shown) => !shown)}
        aria-pressed={showToken}
        title={showToken ? 'Click to hide' : 'Click to reveal'}
        className={`min-w-0 text-left font-mono text-xs break-all px-2 py-1 rounded bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 ${
          showToken ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400 dark:text-gray-500 tracking-widest'
        }`}
      >
        {showToken ? credentials.editToken : '•'.repeat(24)}
        <span className="sr-only">{showToken ? ' (click to hide)' : 'Edit token hidden. Click to reveal'}</span>
      </button>
      {copyButton('token', credentials.editToken, 'Copy edit token')}
    </div>
  ) : (
    none
  );

  const actionsView = (
    <div className="flex flex-wrap items-center gap-3">
      {!credentials && (
        <button
          type="button"
          onClick={() => void handleReserve()}
          disabled={busy}
          className="px-4 py-2 rounded-md bg-gray-600 hover:bg-gray-800 text-white disabled:opacity-60 transition-colors"
        >
          {busy ? 'Reserving…' : 'Reserve a code'}
        </button>
      )}
      <button ref={switchRef} type="button" onClick={openEditor} className={linkClass}>
        {credentials ? 'Use a different code' : 'Use an existing code'}
      </button>
    </div>
  );

  const actionsEdit = (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="submit"
        disabled={busy}
        className="px-4 py-2 rounded-md bg-gray-600 hover:bg-gray-800 text-white disabled:opacity-60 transition-colors"
      >
        {busy ? 'Checking…' : 'Use this code'}
      </button>
      <button type="button" onClick={closeEditor} disabled={busy} className={linkClass}>
        Cancel
      </button>
    </div>
  );

  return (
    <section
      aria-labelledby="publishing-heading"
      className="rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/40 p-4 text-sm"
    >
      <h3 id="publishing-heading" className="text-sm font-semibold mb-2">
        Publishing
      </h3>
      <form
        onSubmit={(e) => void handleClaim(e)}
        onKeyDown={(e) => {
          if (editing && e.key === 'Escape' && !busy) {
            e.stopPropagation();
            closeEditor();
          }
        }}
      >
        {/* Fixed rows; the notes below sit outside this spacing so closed ones add no gap. */}
        <div className="space-y-2">
        <div>
          <label htmlFor="existing-code" className="block font-medium px-1">
            Publish Code:
          </label>
          <SideSwap
            editing={editing}
            view={codeView}
            edit={
              <input
                ref={codeInputRef}
                id="existing-code"
                type="text"
                value={formatCode(codeInput)}
                onChange={(e) => setCodeInput(normalizeCode(e.target.value).slice(0, 6))}
                placeholder="ABC-DEF"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                className={`${inputClass} font-mono tracking-widest uppercase`}
              />
            }
          />
        </div>
        <div>
          <label htmlFor="existing-token" className="block font-medium px-1">
            Edit Token:
          </label>
          <SideSwap
            editing={editing}
            view={tokenView}
            edit={
              <input
                id="existing-token"
                type="text"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                placeholder="Paste from the other device"
                autoComplete="off"
                spellCheck={false}
                className={`${inputClass} font-mono text-xs leading-6`}
              />
            }
          />
          <Collapse open={!editing && showToken}>
            <p className="px-1 text-xs text-amber-700 dark:text-amber-400">
              Anyone with this code and token can change the published schedule. Exports include it too.
            </p>
          </Collapse>
        </div>
        <SideSwap editing={editing} view={actionsView} edit={actionsEdit} />
        </div>
        <Collapse open={!editing && !credentials}>
          <p className="px-1 pt-2 text-xs text-gray-500 dark:text-gray-400">
            Reserving posts a “coming soon” page with the round name so you can share the code now. Build the schedule
            later and Publish to the same code.
          </p>
        </Collapse>
        <Collapse open={editing}>
          <p className="px-1 pt-2 text-xs text-gray-500 dark:text-gray-400">
            Checks the code and token with the server. Nothing is published until you click Publish.
          </p>
        </Collapse>
        {error && (
          <p className="px-1 pt-2 text-red-600 dark:text-red-400" role="alert">
            {error}
          </p>
        )}
        {notice && <p className="px-1 pt-2 text-green-700 dark:text-green-400">{notice}</p>}
      </form>
    </section>
  );
}
