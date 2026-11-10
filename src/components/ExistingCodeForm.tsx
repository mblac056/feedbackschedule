import { useState } from 'react';
import { claimExistingCode } from '../utils/claimExistingCode';
import { formatCode, normalizeCode } from '../utils/publishCodes';
import { getPublishCredentials } from '../utils/publishStorage';
import { userMessageForApiError } from '../utils/scheduleApi';

type Props = {
  onDone: (message: string) => void;
  onCancel: () => void;
};

const MESSAGES: Record<string, string> = {
  'invalid-code': 'Enter a six-character code (ABC-DEF).',
  'missing-token': 'Paste the edit token for this code.',
  'wrong-token': 'That edit token doesn’t match this code.',
  'not-found': 'No live schedule at that code.',
  'storage-failed': 'This browser couldn’t save the code. Free storage space and try again.',
};

/** Enter a code + edit token by hand; the server confirms they match before anything is saved. */
export default function ExistingCodeForm({ onDone, onCancel }: Props) {
  const [code, setCode] = useState('');
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setError('');
    const current = getPublishCredentials();
    const normalized = normalizeCode(code);
    if (
      current &&
      current.code !== normalized &&
      !window.confirm(
        `This browser currently publishes to ${formatCode(current.code)}. Switch to ${formatCode(normalized)}? Keep an export if you still need to update ${formatCode(current.code)}.`
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      const result = await claimExistingCode(code, token);
      if (result.outcome === 'saved') {
        onDone(`This browser now publishes to ${formatCode(result.code)}.`);
      } else if (result.outcome === 'saved-expired') {
        onDone(`${formatCode(result.code)} has expired. It’s saved here; Publish to restore it.`);
      } else {
        setError(MESSAGES[result.outcome]);
      }
    } catch (err) {
      setError(userMessageForApiError(err, 'Could not check that code. Try again.'));
    } finally {
      setBusy(false);
    }
  };

  const inputClass =
    'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-gray-500 focus:border-transparent';

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-2 text-sm text-left">
      <div>
        <label className="block text-sm font-medium mb-1" htmlFor="existing-code">
          Code
        </label>
        <input
          id="existing-code"
          type="text"
          value={formatCode(code)}
          onChange={(e) => setCode(normalizeCode(e.target.value).slice(0, 6))}
          placeholder="ABC-DEF"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          className={`${inputClass} font-mono tracking-widest uppercase`}
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1" htmlFor="existing-token">
          Edit token
        </label>
        <input
          id="existing-token"
          type="text"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="Paste from Settings → Publishing on the other device"
          autoComplete="off"
          spellCheck={false}
          className={`${inputClass} font-mono text-xs`}
        />
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={busy}
          className="px-4 py-2 rounded-md bg-gray-600 hover:bg-gray-800 text-white disabled:opacity-60 transition-colors"
        >
          {busy ? 'Checking…' : 'Use this code'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-2 text-gray-700 dark:text-gray-300 underline hover:no-underline"
        >
          Cancel
        </button>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        Checks the code and token with the server. Nothing is published until you click Publish.
      </p>
      {error && (
        <p className="text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
