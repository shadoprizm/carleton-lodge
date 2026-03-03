import { useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { Navigation } from './components/Navigation';
import { AuthModal } from './components/AuthModal';
import { NotificationSettings } from './components/NotificationSettings';
import { HomePage } from './pages/HomePage';
import { CalendarPage } from './pages/CalendarPage';
import { SummonsPage } from './pages/SummonsPage';
import { MembersPage } from './pages/MembersPage';
import { HistoryPage } from './pages/HistoryPage';
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

function App() {
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isNotificationSettingsOpen, setIsNotificationSettingsOpen] = useState(false);

  return (
    <AuthProvider>
      <div className="min-h-screen bg-white">
        <Navigation
          onAuthClick={() => setIsAuthModalOpen(true)}
          onNotificationClick={() => setIsNotificationSettingsOpen(true)}
        />
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/summons" element={<SummonsPage />} />
          <Route path="/members" element={<MembersPage />} />
          <Route path="/library" element={<LibraryPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/history/:slug" element={<HistoryPage />} />
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
        <AuthModal
          isOpen={isAuthModalOpen}
          onClose={() => setIsAuthModalOpen(false)}
        />
        <NotificationSettings
          isOpen={isNotificationSettingsOpen}
          onClose={() => setIsNotificationSettingsOpen(false)}
        />
      </div>
    </AuthProvider>
  );
}

export default App;
