import { useParams } from 'react-router-dom';
import PublicPersonSchedule from '../components/public/PublicPersonSchedule';
import { buildPublishedPayload } from '../utils/buildPublishedPayload';
import { getEntrants, getJudges, getSessionBlocks, getSettings } from '../utils/localStorage';

export default function PreviewPersonPage() {
  const { personSlug = '' } = useParams<{ personSlug: string }>();

  const payload = buildPublishedPayload({
    judges: getJudges(),
    entrants: getEntrants(),
    sessionBlocks: getSessionBlocks(),
    settings: getSettings(),
  });

  return (
    <PublicPersonSchedule payload={payload} personSlug={personSlug} hubPath="/preview" />
  );
}
