import { lazy, Suspense, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { Navigation } from './components/Navigation';
import { AuthModal } from './components/AuthModal';
import { NotificationSettings } from './components/NotificationSettings';
import { ForcePasswordChangeModal } from './components/ForcePasswordChangeModal';
import { PageMetadata } from './components/PageMetadata';
import { HomePage } from './pages/HomePage';
import { CalendarPage } from './pages/CalendarPage';
import { SummonsPage } from './pages/SummonsPage';
import { MembersPage } from './pages/MembersPage';
import { LibraryPage } from './pages/LibraryPage';
import { GalleryPage } from './pages/GalleryPage';
import { PrivacyPolicyPage } from './pages/PrivacyPolicyPage';
import { TermsAndConditionsPage } from './pages/TermsAndConditionsPage';
import { LinksPage } from './pages/LinksPage';
import { AdminLayout } from './pages/admin/AdminLayout';
import { AdminUsersPage } from './pages/admin/AdminUsersPage';
import { AdminMembersPage } from './pages/admin/AdminMembersPage';
import { AdminEventsPage } from './pages/admin/AdminEventsPage';
import { AdminSummonsPage } from './pages/admin/AdminSummonsPage';
import { AdminHistoryPage } from './pages/admin/AdminHistoryPage';
import { AdminLibraryPage } from './pages/admin/AdminLibraryPage';
import { AdminGalleryPage } from './pages/admin/AdminGalleryPage';
import { AdminContactPage } from './pages/admin/AdminContactPage';

// The public history archive is static curated data (src/lib/history) and is
// lazy-loaded so it never weighs down the main site bundle.
const HistoryLandingPage = lazy(() => import('./pages/history/HistoryLandingPage').then((module) => ({ default: module.HistoryLandingPage })));
const FoundingPage = lazy(() => import('./pages/history/FoundingPage').then((module) => ({ default: module.FoundingPage })));
const FireAndDisplacementPage = lazy(() => import('./pages/history/FireAndDisplacementPage').then((module) => ({ default: module.FireAndDisplacementPage })));
const TemplePage = lazy(() => import('./pages/history/TemplePage').then((module) => ({ default: module.TemplePage })));
const LeHavrePage = lazy(() => import('./pages/history/LeHavrePage').then((module) => ({ default: module.LeHavrePage })));
const WarAndRemembrancePage = lazy(() => import('./pages/history/WarAndRemembrancePage').then((module) => ({ default: module.WarAndRemembrancePage })));
const PeoplePage = lazy(() => import('./pages/history/PeoplePage').then((module) => ({ default: module.PeoplePage })));
const HistoryGalleryPage = lazy(() => import('./pages/history/HistoryGalleryPage').then((module) => ({ default: module.HistoryGalleryPage })));
const HistorySourcesPage = lazy(() => import('./pages/history/HistorySourcesPage').then((module) => ({ default: module.HistorySourcesPage })));

const PageLoading = () => <div className="min-h-screen bg-slate-50 px-4 pt-32 text-center text-base text-slate-600" role="status">Loading page…</div>;

function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}

const AppShell = () => {
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isNotificationSettingsOpen, setIsNotificationSettingsOpen] = useState(false);

  return (
    <div className="min-h-screen bg-white">
      <Navigation
        onAuthClick={() => setIsAuthModalOpen(true)}
        onNotificationClick={() => setIsNotificationSettingsOpen(true)}
      />
      <PageMetadata />
      <Suspense fallback={<PageLoading />}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/summons" element={<SummonsPage />} />
        <Route path="/members" element={<MembersPage />} />
        <Route path="/library" element={<LibraryPage />} />
        <Route path="/history" element={<HistoryLandingPage />} />
        <Route path="/history/founding" element={<FoundingPage />} />
        <Route path="/history/fire-and-displacement" element={<FireAndDisplacementPage />} />
        <Route path="/history/temple" element={<TemplePage />} />
        <Route path="/history/le-havre" element={<LeHavrePage />} />
        <Route path="/history/war-and-remembrance" element={<WarAndRemembrancePage />} />
        <Route path="/history/people" element={<PeoplePage />} />
        <Route path="/history/gallery" element={<HistoryGalleryPage />} />
        <Route path="/history/sources" element={<HistorySourcesPage />} />
        <Route path="/history/formative-era-1904-1920" element={<Navigate to="/history/founding" replace />} />
        <Route path="/history/great-fire-1920" element={<Navigate to="/history/fire-and-displacement" replace />} />
        <Route path="/history/international-connection-1916-1930" element={<Navigate to="/history/le-havre" replace />} />
        <Route path="/history/architectural-heritage-1872-1925" element={<Navigate to="/history/temple" replace />} />
        <Route path="/history/modern-era-2000-2026" element={<Navigate to="/history" replace />} />
        <Route path="/gallery" element={<GalleryPage />} />
        <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
        <Route path="/terms-and-conditions" element={<TermsAndConditionsPage />} />
        <Route path="/links" element={<LinksPage />} />
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Navigate to="/admin/users" replace />} />
          <Route path="users" element={<AdminUsersPage />} />
          <Route path="members" element={<AdminMembersPage />} />
          <Route path="events" element={<AdminEventsPage />} />
          <Route path="summons" element={<AdminSummonsPage />} />
          <Route path="library" element={<AdminLibraryPage />} />
          <Route path="history" element={<AdminHistoryPage />} />
          <Route path="gallery" element={<AdminGalleryPage />} />
          <Route path="contact" element={<AdminContactPage />} />
        </Route>
      </Routes>
      </Suspense>
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
      />
      <NotificationSettings
        isOpen={isNotificationSettingsOpen}
        onClose={() => setIsNotificationSettingsOpen(false)}
      />
      <ForcePasswordChangeModal />
    </div>
  );
};

export default App;
