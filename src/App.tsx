import { lazy, Suspense, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router';
import { AuthProvider } from './contexts/AuthContext';
import { Navigation } from './components/Navigation';
import { AuthModal } from './components/AuthModal';
import { NotificationSettings } from './components/NotificationSettings';
import { ForcePasswordChangeModal } from './components/ForcePasswordChangeModal';
import { MemberGate } from './components/MemberGate';
import { LodgeGuidePilotGate } from './components/LodgeGuidePilotGate';
import { PageMetadata } from './components/PageMetadata';
import { LODGE_GUIDE_ENABLED } from './lib/lodgeGuide';

const HomePage = lazy(() => import('./pages/HomePage').then((module) => ({ default: module.HomePage })));
const CalendarPage = lazy(() => import('./pages/CalendarPage').then((module) => ({ default: module.CalendarPage })));
const SummonsPage = lazy(() => import('./pages/SummonsPage').then((module) => ({ default: module.SummonsPage })));
const DistrictPage = lazy(() => import('./pages/DistrictPage').then((module) => ({ default: module.DistrictPage })));
const MembersPage = lazy(() => import('./pages/MembersPage').then((module) => ({ default: module.MembersPage })));
const HistoryLandingPage = lazy(() => import('./pages/history/HistoryLandingPage').then((module) => ({ default: module.HistoryLandingPage })));
const FoundingPage = lazy(() => import('./pages/history/FoundingPage').then((module) => ({ default: module.FoundingPage })));
const FireAndDisplacementPage = lazy(() => import('./pages/history/FireAndDisplacementPage').then((module) => ({ default: module.FireAndDisplacementPage })));
const TemplePage = lazy(() => import('./pages/history/TemplePage').then((module) => ({ default: module.TemplePage })));
const LeHavrePage = lazy(() => import('./pages/history/LeHavrePage').then((module) => ({ default: module.LeHavrePage })));
const WarAndRemembrancePage = lazy(() => import('./pages/history/WarAndRemembrancePage').then((module) => ({ default: module.WarAndRemembrancePage })));
const PeoplePage = lazy(() => import('./pages/history/PeoplePage').then((module) => ({ default: module.PeoplePage })));
const HistoryGalleryPage = lazy(() => import('./pages/history/HistoryGalleryPage').then((module) => ({ default: module.HistoryGalleryPage })));
const HistorySourcesPage = lazy(() => import('./pages/history/HistorySourcesPage').then((module) => ({ default: module.HistorySourcesPage })));
const LibraryPage = lazy(() => import('./pages/LibraryPage').then((module) => ({ default: module.LibraryPage })));
const GalleryPage = lazy(() => import('./pages/GalleryPage').then((module) => ({ default: module.GalleryPage })));
const PrivacyPolicyPage = lazy(() => import('./pages/PrivacyPolicyPage').then((module) => ({ default: module.PrivacyPolicyPage })));
const TermsAndConditionsPage = lazy(() => import('./pages/TermsAndConditionsPage').then((module) => ({ default: module.TermsAndConditionsPage })));
const LinksPage = lazy(() => import('./pages/LinksPage').then((module) => ({ default: module.LinksPage })));
const MyLodgePage = lazy(() => import('./pages/MyLodgePage').then((module) => ({ default: module.MyLodgePage })));
const MailboxSetupPage = lazy(() => import('./pages/MailboxSetupPage').then((module) => ({ default: module.MailboxSetupPage })));
const MemberProfilePage = lazy(() => import('./pages/MemberProfilePage').then((module) => ({ default: module.MemberProfilePage })));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage').then((module) => ({ default: module.ResetPasswordPage })));
const SearchPage = lazy(() => import('./pages/SearchPage').then((module) => ({ default: module.SearchPage })));
const HelpPage = lazy(() => import('./pages/HelpPage').then((module) => ({ default: module.HelpPage })));
const AskCarletonPage = lazy(() => import('./pages/AskCarletonPage').then((module) => ({ default: module.AskCarletonPage })));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage').then((module) => ({ default: module.NotFoundPage })));
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout').then((module) => ({ default: module.AdminLayout })));
const AdminUsersPage = lazy(() => import('./pages/admin/AdminUsersPage').then((module) => ({ default: module.AdminUsersPage })));
const AdminMembersPage = lazy(() => import('./pages/admin/AdminMembersPage').then((module) => ({ default: module.AdminMembersPage })));
const AdminEmailAccountsPage = lazy(() => import('./pages/admin/AdminEmailAccountsPage').then((module) => ({ default: module.AdminEmailAccountsPage })));
const AdminEventsPage = lazy(() => import('./pages/admin/AdminEventsPage').then((module) => ({ default: module.AdminEventsPage })));
const AdminSummonsPage = lazy(() => import('./pages/admin/AdminSummonsPage').then((module) => ({ default: module.AdminSummonsPage })));
const AdminHistoryPage = lazy(() => import('./pages/admin/AdminHistoryPage').then((module) => ({ default: module.AdminHistoryPage })));
const AdminLibraryPage = lazy(() => import('./pages/admin/AdminLibraryPage').then((module) => ({ default: module.AdminLibraryPage })));
const AdminGalleryPage = lazy(() => import('./pages/admin/AdminGalleryPage').then((module) => ({ default: module.AdminGalleryPage })));
const AdminContactPage = lazy(() => import('./pages/admin/AdminContactPage').then((module) => ({ default: module.AdminContactPage })));
const AdminCommunicationsPage = lazy(() => import('./pages/admin/AdminCommunicationsPage').then((module) => ({ default: module.AdminCommunicationsPage })));
const AdminTrustedSourcesPage = lazy(() => import('./pages/admin/AdminTrustedSourcesPage').then((module) => ({ default: module.AdminTrustedSourcesPage })));

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
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <Navigation
        onAuthClick={() => setIsAuthModalOpen(true)}
        onNotificationClick={() => setIsNotificationSettingsOpen(true)}
      />
      <PageMetadata />
      <main id="main-content" tabIndex={-1}>
        <Suspense fallback={<PageLoading />}>
          <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/my-lodge" element={<MemberGate onSignIn={() => setIsAuthModalOpen(true)} title="My Lodge"><MyLodgePage /></MemberGate>} />
          <Route path="/my-lodge/email" element={<MemberGate onSignIn={() => setIsAuthModalOpen(true)} title="Your lodge email"><MailboxSetupPage /></MemberGate>} />
          {LODGE_GUIDE_ENABLED && (
            <>
              <Route path="/lodge-guide" element={<MemberGate onSignIn={() => setIsAuthModalOpen(true)} title="Lodge Guide"><LodgeGuidePilotGate><AskCarletonPage /></LodgeGuidePilotGate></MemberGate>} />
              <Route path="/ask-carleton" element={<Navigate to="/lodge-guide" replace />} />
            </>
          )}
          <Route path="/summons" element={<MemberGate onSignIn={() => setIsAuthModalOpen(true)} title="Summons"><SummonsPage /></MemberGate>} />
          <Route path="/district" element={<MemberGate onSignIn={() => setIsAuthModalOpen(true)} title="Ottawa Districts 1 and 2"><DistrictPage /></MemberGate>} />
          <Route path="/members" element={<MemberGate onSignIn={() => setIsAuthModalOpen(true)} title="The member directory"><MembersPage /></MemberGate>} />
          <Route path="/members/:memberId" element={<MemberGate onSignIn={() => setIsAuthModalOpen(true)} title="Member profiles"><MemberProfilePage /></MemberGate>} />
          <Route path="/library" element={<MemberGate onSignIn={() => setIsAuthModalOpen(true)} title="The lodge library"><LibraryPage /></MemberGate>} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/help" element={<HelpPage />} />
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
            <Route path="email-accounts" element={<AdminEmailAccountsPage />} />
            <Route path="events" element={<AdminEventsPage />} />
            <Route path="summons" element={<AdminSummonsPage />} />
            <Route path="library" element={<AdminLibraryPage />} />
            <Route path="history" element={<AdminHistoryPage />} />
            <Route path="gallery" element={<AdminGalleryPage />} />
            <Route path="contact" element={<AdminContactPage />} />
            <Route path="communications" element={<AdminCommunicationsPage />} />
            <Route path="trusted-sources" element={<AdminTrustedSourcesPage />} />
          </Route>
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </main>
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
