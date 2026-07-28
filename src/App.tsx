import { Routes, Route } from 'react-router-dom';
import GoogleAnalytics from './components/GoogleAnalytics';
import CreatePage from './pages/CreatePage';
import HomePage from './pages/HomePage';
import PreviewHubPage from './pages/PreviewHubPage';
import PreviewPersonPage from './pages/PreviewPersonPage';
import PublishedHubPage from './pages/PublishedHubPage';
import PublishedPersonPage from './pages/PublishedPersonPage';

export default function App() {
  return (
    <>
      <GoogleAnalytics />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/create" element={<CreatePage />} />
        <Route path="/preview" element={<PreviewHubPage />} />
        <Route path="/preview/:personSlug" element={<PreviewPersonPage />} />
        <Route path="/:code" element={<PublishedHubPage />} />
        <Route path="/:code/:personSlug" element={<PublishedPersonPage />} />
      </Routes>
    </>
  );
}
