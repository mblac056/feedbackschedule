import { useEffect, useState } from 'react';
import { FaQrcode, FaTimes } from 'react-icons/fa';
import QRCode from 'qrcode';

type Props = {
  /** Absolute URL encoded in the QR code. Defaults to current page URL. */
  url?: string;
};

export default function ScheduleQrButton({ url }: Props) {
  const [open, setOpen] = useState(false);
  const [dataUrl, setDataUrl] = useState('');
  const [error, setError] = useState('');

  const targetUrl = url || (typeof window !== 'undefined' ? window.location.href : '');

  useEffect(() => {
    if (!open || !targetUrl) return;
    let cancelled = false;
    setError('');
    setDataUrl('');
    QRCode.toDataURL(targetUrl, {
      width: 240,
      margin: 2,
      errorCorrectionLevel: 'M',
    })
      .then((result) => {
        if (!cancelled) setDataUrl(result);
      })
      .catch(() => {
        if (!cancelled) setError('Could not generate QR code.');
      });
    return () => {
      cancelled = true;
    };
  }, [open, targetUrl]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="p-2 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:text-[var(--primary-color)] hover:border-[var(--primary-color)] focus:ring-2 focus:ring-[var(--primary-color)] focus:ring-offset-2 dark:focus:ring-offset-gray-950 transition-colors shrink-0"
        aria-label="Show QR code for this schedule"
        title="QR code"
      >
        <FaQrcode className="text-lg" />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Schedule QR code"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-white dark:bg-gray-900 rounded-xl shadow-xl p-5 max-w-sm w-full flex flex-col items-center gap-4 relative"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="absolute top-3 right-3 p-1.5 rounded text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)]"
              aria-label="Close"
            >
              <FaTimes />
            </button>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 pr-6">
              Scan to open schedule
            </h2>
            {error ? (
              <p className="text-sm text-red-600 dark:text-red-400" role="alert">
                {error}
              </p>
            ) : dataUrl ? (
              <img
                src={dataUrl}
                alt="QR code linking to this schedule"
                className="w-60 h-60 bg-white rounded"
              />
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400 py-16">Generating…</p>
            )}
            <p className="text-xs text-gray-500 dark:text-gray-400 text-center break-all">
              {targetUrl}
            </p>
          </div>
        </div>
      )}
    </>
  );
}
