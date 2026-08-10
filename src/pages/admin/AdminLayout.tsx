import { NavLink, Outlet, Navigate, useLocation } from 'react-router';
import { Shield, Users, UserCircle, Calendar, FileText, BookOpen, ChevronRight, Library, Images, MessageSquare, Mail } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { AdminSection } from '../../lib/adminPermissions';

const navItems = [
  { label: 'Users', path: '/admin/users', icon: Users, fullAdminOnly: true },
  { label: 'Members', path: '/admin/members', icon: UserCircle, section: 'members' },
  { label: 'Lodge Email', path: '/admin/email-accounts', icon: Mail, section: 'members' },
  { label: 'Events', path: '/admin/events', icon: Calendar, section: 'events' },
  { label: 'Summons', path: '/admin/summons', icon: FileText, section: 'summons' },
  { label: 'Library', path: '/admin/library', icon: Library, section: 'library' },
  { label: 'History', path: '/admin/history', icon: BookOpen, section: 'history' },
  { label: 'Gallery', path: '/admin/gallery', icon: Images, section: 'gallery' },
  { label: 'Contact', path: '/admin/contact', icon: MessageSquare, section: 'contact' },
  { label: 'Communications', path: '/admin/communications', icon: Mail, section: 'communications' },
];

export const AdminLayout = () => {
  const { isAdmin, canAccessAdmin, hasAdminPermission, loading } = useAuth();
  const location = useLocation();

  const permittedItems = navItems.filter((item) =>
    item.fullAdminOnly ? isAdmin : hasAdminPermission(item.section as AdminSection)
  );
  const firstPermittedPath = permittedItems[0]?.path ?? '/';

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center pt-20">
        <div className="text-slate-500">Loading...</div>
      </div>
    );
  }

  if (!canAccessAdmin) {
    return <Navigate to="/" replace />;
  }

  const currentItem = navItems.find((item) =>
    location.pathname === item.path || location.pathname.startsWith(`${item.path}/`)
  );

  if (currentItem) {
    const allowed = currentItem.fullAdminOnly
      ? isAdmin
      : hasAdminPermission(currentItem.section as AdminSection);

    if (!allowed) {
      return <Navigate to={firstPermittedPath} replace />;
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 pt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center space-x-3 mb-8">
          <div className="p-2 bg-slate-900 rounded-lg">
            <Shield size={22} className="text-amber-400" />
          </div>
          <div>
            <h1 className="text-2xl font-serif text-slate-900">Admin Panel</h1>
            <p className="text-sm text-slate-500">Manage your lodge</p>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-6">
          <aside className="md:w-56 flex-shrink-0">
            <nav className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              {permittedItems.map(({ label, path, icon: Icon }) => (
                <NavLink
                  key={path}
                  to={path}
                  className={({ isActive }) =>
                    `flex items-center justify-between px-4 py-3 text-sm font-medium border-b border-slate-100 last:border-0 transition-colors ${
                      isActive
                        ? 'bg-slate-900 text-amber-300'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <div className="flex items-center space-x-3">
                        <Icon size={17} className={isActive ? 'text-amber-400' : 'text-slate-400'} />
                        <span>{label}</span>
                      </div>
                      <ChevronRight size={14} className={isActive ? 'text-amber-500' : 'text-slate-300'} />
                    </>
                  )}
                </NavLink>
              ))}
            </nav>
          </aside>

          <section className="flex-1 min-w-0" aria-label="Administration workspace">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
              <Outlet />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
