import { Routes, Route } from 'react-router-dom';
import ErrorBoundary from './components/ErrorBoundary';
import PersistFailureBanner from './components/PersistFailureBanner';
import PWAUpdatePrompt from './components/PWAUpdatePrompt';
import GoogleAnalytics from './components/GoogleAnalytics';
import AdminGuidePage from './pages/AdminGuidePage';
import CreatePage from './pages/CreatePage';
import HomePage from './pages/HomePage';
import PreviewFlowPage from './pages/PreviewFlowPage';
import PreviewHubPage from './pages/PreviewHubPage';
import PreviewPersonPage from './pages/PreviewPersonPage';
import PublishedFlowPage from './pages/PublishedFlowPage';
import PublishedHubPage from './pages/PublishedHubPage';
import PublishedPersonPage from './pages/PublishedPersonPage';

export default function App() {
  return (
    <ErrorBoundary>
      <GoogleAnalytics />
      <PersistFailureBanner />
      <PWAUpdatePrompt />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/create" element={<CreatePage />} />
        <Route path="/admin-guide" element={<AdminGuidePage />} />
        <Route path="/preview" element={<PreviewHubPage />} />
        <Route path="/preview/flow" element={<PreviewFlowPage />} />
        <Route path="/preview/:personSlug" element={<PreviewPersonPage />} />
        <Route path="/:code" element={<PublishedHubPage />} />
        <Route path="/:code/flow" element={<PublishedFlowPage />} />
        <Route path="/:code/:personSlug" element={<PublishedPersonPage />} />
      </Routes>
    </ErrorBoundary>
  );
}
