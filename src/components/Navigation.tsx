import { useState, useRef, useEffect } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { LogIn, LogOut, Menu, X, Shield, Bell, ChevronDown } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';

interface NavigationProps {
  onAuthClick: () => void;
  onNotificationClick: () => void;
}

export const Navigation = ({ onAuthClick, onNotificationClick }: NavigationProps) => {
  const { user, isAdmin, loading, signOut } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [membersDropdownOpen, setMembersDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const location = useLocation();

  const navItems = [
    { label: 'Home', path: '/' },
    { label: 'History', path: '/history' },
    { label: 'Gallery', path: '/gallery' },
    { label: 'Calendar', path: '/calendar' },
  ];

  const memberNavItems = [
    { label: 'Summons', path: '/summons' },
    { label: 'Members', path: '/members' },
    { label: 'Library', path: '/library' },
  ];

  const isMemberPathActive = memberNavItems.some(item => location.pathname === item.path);

  const handleNavClick = () => {
    setMobileMenuOpen(false);
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setMembersDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <nav className="fixed top-0 left-0 right-0 z-40 bg-slate-900 backdrop-blur-sm border-b border-amber-600/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          <Link
            to="/"
            className="flex items-center space-x-3 group flex-shrink-0"
          >
            <img
              src="/Screenshot_2026-03-01_at_08.13.26.png"
              alt="Carleton Lodge 465"
              className="h-12 w-12 object-contain flex-shrink-0"
            />
            <span className="text-lg font-serif text-amber-100 tracking-tight group-hover:text-amber-200 transition-colors hidden lg:block whitespace-nowrap">
              Carleton Lodge 465
            </span>
          </Link>

          <div className="hidden lg:flex items-center space-x-6 xl:space-x-8">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`text-sm tracking-widest uppercase transition-colors whitespace-nowrap ${
                  location.pathname === item.path
                    ? 'text-amber-200'
                    : 'text-amber-100/80 hover:text-amber-200'
                }`}
              >
                {item.label}
              </Link>
            ))}

            {user && (
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setMembersDropdownOpen(!membersDropdownOpen)}
                  className={`flex items-center space-x-1 text-sm tracking-widest uppercase transition-colors whitespace-nowrap ${
                    isMemberPathActive ? 'text-amber-200' : 'text-amber-100/80 hover:text-amber-200'
                  }`}
                >
                  <span>Members</span>
                  <ChevronDown
                    size={14}
                    className={`transition-transform duration-200 ${membersDropdownOpen ? 'rotate-180' : ''}`}
                  />
                </button>

                <AnimatePresence>
                  {membersDropdownOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.15 }}
                      className="absolute top-full left-1/2 -translate-x-1/2 mt-3 w-44 bg-slate-900 border border-amber-600/30 rounded shadow-xl overflow-hidden"
                    >
                      {memberNavItems.map((item) => (
                        <Link
                          key={item.path}
                          to={item.path}
                          onClick={() => setMembersDropdownOpen(false)}
                          className={`block px-5 py-3 text-xs tracking-widest uppercase transition-colors border-b border-amber-600/10 last:border-0 ${
                            location.pathname === item.path
                              ? 'text-amber-200 bg-amber-600/10'
                              : 'text-amber-100/80 hover:text-amber-200 hover:bg-amber-600/10'
                          }`}
                        >
                          {item.label}
                        </Link>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {user ? (
              <>
                <button
                  onClick={onNotificationClick}
                  className="text-amber-100/80 hover:text-amber-200 transition-colors"
                  title="Notification Settings"
                >
                  <Bell size={18} />
                </button>
                {!loading && isAdmin && (
                  <NavLink
                    to="/admin"
                    className={({ isActive }) =>
                      `flex items-center space-x-1.5 text-sm tracking-widest uppercase transition-colors whitespace-nowrap ${
                        isActive ? 'text-amber-300' : 'text-amber-400 hover:text-amber-300'
                      }`
                    }
                  >
                    <Shield size={15} />
                    <span>Admin</span>
                  </NavLink>
                )}
                <button
                  onClick={() => signOut()}
                  className="flex items-center space-x-1.5 text-sm tracking-widest uppercase text-amber-100/80 hover:text-amber-200 transition-colors whitespace-nowrap"
                >
                  <LogOut size={15} />
                  <span>Sign Out</span>
                </button>
              </>
            ) : (
              <button
                onClick={onAuthClick}
                className="flex items-center space-x-1.5 text-sm tracking-widest uppercase text-amber-100/80 hover:text-amber-200 transition-colors whitespace-nowrap"
              >
                <LogIn size={16} />
                <span>Member Login</span>
              </button>
            )}
          </div>

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden text-amber-100"
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="lg:hidden bg-slate-900 border-t border-amber-600/30"
        >
          <div className="px-4 py-4 space-y-3">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                onClick={handleNavClick}
                className={`block w-full text-left text-sm tracking-widest uppercase transition-colors py-2 ${
                  location.pathname === item.path
                    ? 'text-amber-200'
                    : 'text-amber-100/80 hover:text-amber-200'
                }`}
              >
                {item.label}
              </Link>
            ))}
            {user && memberNavItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                onClick={handleNavClick}
                className={`block w-full text-left text-sm tracking-widest uppercase transition-colors py-2 pl-4 border-l border-amber-600/30 ${
                  location.pathname === item.path
                    ? 'text-amber-200'
                    : 'text-amber-100/80 hover:text-amber-200'
                }`}
              >
                {item.label}
              </Link>
            ))}
            {user ? (
              <>
                <button
                  onClick={() => {
                    onNotificationClick();
                    setMobileMenuOpen(false);
                  }}
                  className="flex items-center space-x-2 text-sm tracking-widest uppercase text-amber-100/80 hover:text-amber-200 transition-colors py-2"
                >
                  <Bell size={16} />
                  <span>Notifications</span>
                </button>
                {!loading && isAdmin && (
                  <NavLink
                    to="/admin"
                    onClick={handleNavClick}
                    className={({ isActive }) =>
                      `flex items-center space-x-2 text-sm tracking-widest uppercase transition-colors py-2 ${
                        isActive ? 'text-amber-300' : 'text-amber-400 hover:text-amber-300'
                      }`
                    }
                  >
                    <Shield size={16} />
                    <span>Admin</span>
                  </NavLink>
                )}
                <button
                  onClick={() => signOut()}
                  className="flex items-center space-x-2 text-sm tracking-widest uppercase text-amber-100/80 hover:text-amber-200 transition-colors py-2"
                >
                  <LogOut size={16} />
                  <span>Sign Out</span>
                </button>
              </>
            ) : (
              <button
                onClick={onAuthClick}
                className="flex items-center space-x-2 text-sm tracking-widest uppercase text-amber-100/80 hover:text-amber-200 transition-colors py-2"
              >
                <LogIn size={16} />
                <span>Member Login</span>
              </button>
            )}
          </div>
        </motion.div>
      )}
    </nav>
  );
};
