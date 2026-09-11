import { useEffect, useState } from 'react';

type PersistFailureDetail = {
  operation: string;
  quotaExceeded: boolean;
};

export default function PersistFailureBanner() {
  const [failure, setFailure] = useState<PersistFailureDetail | null>(null);

  useEffect(() => {
    const onFail = (event: Event) => {
      const detail = (event as CustomEvent<PersistFailureDetail>).detail;
      if (!detail) return;
      setFailure(detail);
    };
    const onOk = () => setFailure(null);
    window.addEventListener('evalmatrix:persist-failed', onFail);
    window.addEventListener('evalmatrix:persist-ok', onOk);
    return () => {
      window.removeEventListener('evalmatrix:persist-failed', onFail);
      window.removeEventListener('evalmatrix:persist-ok', onOk);
    };
  }, []);

  if (!failure) return null;

  return (
    <div
      className="sticky top-0 z-[100] bg-red-700 text-white px-4 py-3 text-sm"
      role="alert"
    >
      {failure.quotaExceeded
        ? 'This browser is out of storage space. Recent edits may be lost on refresh. Export a backup now, then free space and try again.'
        : 'Could not save your schedule to this browser. Recent edits may be lost on refresh. Export a backup before closing this tab.'}
    </div>
  );
}
