import { useMemo } from 'react';
import PublicScheduleHub from '../components/public/PublicScheduleHub';
import { buildPublishedPayload } from '../utils/buildPublishedPayload';
import { getEntrants, getJudges, getSessionBlocks, getSettings } from '../utils/localStorage';

export default function PreviewHubPage() {
  const payload = useMemo(() => {
    window.dispatchEvent(new Event('evalmatrix:flush-persist'));
    return buildPublishedPayload({
      judges: getJudges(),
      entrants: getEntrants(),
      sessionBlocks: getSessionBlocks(),
      settings: getSettings(),
    });
  }, []);

  return <PublicScheduleHub payload={payload} personBasePath="/preview" showBackToCreate />;
}
