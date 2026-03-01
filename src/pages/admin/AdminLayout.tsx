import { NavLink, Outlet, Navigate } from 'react-router-dom';
import { Shield, Users, UserCircle, Calendar, FileText, BookOpen, ChevronRight, Library, Images, MessageSquare } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const navItems = [
  { label: 'Users', path: '/admin/users', icon: Users },
  { label: 'Members', path: '/admin/members', icon: UserCircle },
  { label: 'Events', path: '/admin/events', icon: Calendar },
  { label: 'Summons', path: '/admin/summons', icon: FileText },
  { label: 'Library', path: '/admin/library', icon: Library },
  { label: 'History', path: '/admin/history', icon: BookOpen },
  { label: 'Gallery', path: '/admin/gallery', icon: Images },
  { label: 'Contact', path: '/admin/contact', icon: MessageSquare },
];

export const AdminLayout = () => {
  const { isAdmin, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center pt-20">
        <div className="text-slate-500">Loading...</div>
      </div>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />;
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
              {navItems.map(({ label, path, icon: Icon }) => (
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

          <main className="flex-1 min-w-0">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </div>
  );
};
