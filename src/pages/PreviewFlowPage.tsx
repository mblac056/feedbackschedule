import { useMemo } from 'react';
import PublicFlowDocument from '../components/public/PublicFlowDocument';
import { buildPublishedPayload } from '../utils/buildPublishedPayload';
import { getEntrants, getJudges, getSessionBlocks, getSettings } from '../utils/localStorage';

export default function PreviewFlowPage() {
  const payload = useMemo(() => {
    window.dispatchEvent(new Event('evalmatrix:flush-persist'));
    return buildPublishedPayload({
      judges: getJudges(),
      entrants: getEntrants(),
      sessionBlocks: getSessionBlocks(),
      settings: getSettings(),
    });
  }, []);

  return <PublicFlowDocument payload={payload} hubPath="/preview" showBackToCreate />;
}
