import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router';
import {
  Bell,
  BookOpen,
  CalendarDays,
  ChevronDown,
  CircleHelp,
  House,
  Images,
  Landmark,
  Library,
  LogIn,
  LogOut,
  Menu,
  ScrollText,
  Search,
  Shield,
  UserRound,
  UsersRound,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { canAccessLodgeGuidePilot, LODGE_GUIDE_ENABLED } from '../lib/lodgeGuide';

interface NavigationProps {
  onAuthClick: () => void;
  onNotificationClick: () => void;
}

type DropdownName = 'about' | 'members' | 'account';

interface NavigationItem {
  label: string;
  path: string;
  icon: typeof House;
  description?: string;
}

const primaryNavItems: NavigationItem[] = [
  { label: 'Home', path: '/', icon: House },
  { label: 'Calendar', path: '/calendar', icon: CalendarDays },
  { label: 'Help', path: '/help', icon: CircleHelp },
];

const aboutNavItems: NavigationItem[] = [
  { label: 'Our History', path: '/history', icon: Landmark, description: 'Explore the story of the lodge' },
  { label: 'Photo Gallery', path: '/gallery', icon: Images, description: 'See moments from lodge life' },
];

const baseMemberNavItems: NavigationItem[] = [
  { label: 'Monthly Summons', path: '/summons', icon: ScrollText, description: 'Read meeting notices and agendas' },
  { label: 'Ottawa Districts', path: '/district', icon: Landmark, description: 'District 1 and 2 meetings, degrees, and summons' },
  { label: 'Member Directory', path: '/members', icon: UsersRound, description: 'Find officers and lodge members' },
  { label: 'Document Library', path: '/library', icon: Library, description: 'Access lodge documents and forms' },
];

const isPathActive = (pathname: string, path: string) => (
  path === '/' ? pathname === '/' : pathname === path || pathname.startsWith(`${path}/`)
);

const desktopLinkClass = (active: boolean) => (
  `flex min-h-11 items-center rounded-lg px-3 text-[0.78rem] font-medium uppercase tracking-[0.14em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/80 ${
    active
      ? 'bg-amber-400/10 text-amber-200'
      : 'text-amber-100/75 hover:bg-white/5 hover:text-amber-100'
  }`
);

const dropdownButtonClass = (active: boolean, open: boolean) => (
  `flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-[0.78rem] font-medium uppercase tracking-[0.14em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/80 ${
    active || open
      ? 'bg-amber-400/10 text-amber-200'
      : 'text-amber-100/75 hover:bg-white/5 hover:text-amber-100'
  }`
);

export const Navigation = ({ onAuthClick, onNotificationClick }: NavigationProps) => {
  const { user, isAdmin, canAccessAdmin, loading, signOut } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<DropdownName | null>(null);
  const navigationRef = useRef<HTMLElement>(null);
  const location = useLocation();
  const memberNavItems: NavigationItem[] = [
    ...(canAccessLodgeGuidePilot(LODGE_GUIDE_ENABLED, isAdmin)
      ? [{ label: 'Lodge Guide', path: '/lodge-guide', icon: BookOpen, description: 'Ask about approved lodge information' }]
      : []),
    ...baseMemberNavItems,
  ];

  const isAboutPathActive = aboutNavItems.some((item) => isPathActive(location.pathname, item.path));
  const isMemberPathActive = memberNavItems.some((item) => isPathActive(location.pathname, item.path));
  const isAccountPathActive = isPathActive(location.pathname, '/my-lodge') || isPathActive(location.pathname, '/admin');

  const toggleDropdown = (name: DropdownName) => {
    setOpenDropdown((current) => current === name ? null : name);
  };

  const closeNavigation = () => {
    setMobileMenuOpen(false);
    setOpenDropdown(null);
  };

  const handleSignOut = () => {
    closeNavigation();
    void signOut();
  };

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (navigationRef.current && !navigationRef.current.contains(event.target as Node)) {
        setOpenDropdown(null);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpenDropdown(null);
        setMobileMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  useEffect(() => {
    closeNavigation();
  }, [location.pathname]);

  return (
    <nav
      ref={navigationRef}
      aria-label="Main navigation"
      className="fixed inset-x-0 top-0 z-40 border-b border-amber-500/25 bg-slate-950/95 shadow-[0_1px_18px_rgba(2,6,23,0.14)] backdrop-blur-md"
    >
      <div className="mx-auto max-w-[90rem] px-4 sm:px-6 lg:px-8">
        <div className="flex h-20 items-center gap-5">
          <Link
            to="/"
            className="group flex flex-shrink-0 items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/80"
            aria-label="Carleton Lodge No. 465 home"
          >
            <img
              src="/logo-mark.webp"
              alt=""
              decoding="async"
              className="h-12 w-12 flex-shrink-0 object-contain"
            />
            <span className="block leading-tight">
              <span className="block whitespace-nowrap font-serif text-[1.05rem] text-amber-100 transition-colors group-hover:text-amber-200">
                Carleton Lodge
              </span>
              <span className="mt-0.5 block whitespace-nowrap text-[0.6rem] font-semibold uppercase tracking-[0.24em] text-amber-400/75">
                No. 465 · Carp, Ontario
              </span>
            </span>
          </Link>

          <div className="hidden min-w-0 flex-1 items-center justify-center gap-1 xl:flex xl:gap-2">
            <Link to="/" className={desktopLinkClass(location.pathname === '/')}>
              Home
            </Link>

            <div className="relative">
              <button
                type="button"
                onClick={() => toggleDropdown('about')}
                aria-expanded={openDropdown === 'about'}
                aria-haspopup="menu"
                aria-controls="about-navigation-menu"
                className={dropdownButtonClass(isAboutPathActive, openDropdown === 'about')}
              >
                <span>About</span>
                <ChevronDown
                  size={14}
                  aria-hidden="true"
                  className={`transition-transform duration-200 ${openDropdown === 'about' ? 'rotate-180' : ''}`}
                />
              </button>

              <AnimatePresence>
                {openDropdown === 'about' ? (
                  <motion.div
                    id="about-navigation-menu"
                    role="menu"
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.15 }}
                    className="absolute left-1/2 top-full mt-3 w-72 -translate-x-1/2 overflow-hidden rounded-xl border border-amber-500/25 bg-slate-900 p-2 shadow-2xl"
                  >
                    {aboutNavItems.map((item) => {
                      const Icon = item.icon;
                      const active = isPathActive(location.pathname, item.path);
                      return (
                        <Link
                          key={item.path}
                          to={item.path}
                          role="menuitem"
                          className={`flex items-start gap-3 rounded-lg px-3 py-3 transition-colors ${
                            active ? 'bg-amber-400/10 text-amber-100' : 'text-amber-50/80 hover:bg-white/5 hover:text-amber-100'
                          }`}
                        >
                          <Icon size={18} className="mt-0.5 flex-shrink-0 text-amber-400" aria-hidden="true" />
                          <span>
                            <span className="block text-sm font-semibold">{item.label}</span>
                            <span className="mt-0.5 block text-xs leading-5 text-slate-400">{item.description}</span>
                          </span>
                        </Link>
                      );
                    })}
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>

            {primaryNavItems.slice(1, 2).map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={desktopLinkClass(isPathActive(location.pathname, item.path))}
              >
                {item.label}
              </Link>
            ))}

            {user ? (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => toggleDropdown('members')}
                  aria-expanded={openDropdown === 'members'}
                  aria-haspopup="menu"
                  aria-controls="member-navigation-menu"
                  className={dropdownButtonClass(isMemberPathActive, openDropdown === 'members')}
                >
                  <span>Members</span>
                  <ChevronDown
                    size={14}
                    aria-hidden="true"
                    className={`transition-transform duration-200 ${openDropdown === 'members' ? 'rotate-180' : ''}`}
                  />
                </button>

                <AnimatePresence>
                  {openDropdown === 'members' ? (
                    <motion.div
                      id="member-navigation-menu"
                      role="menu"
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.15 }}
                      className="absolute left-1/2 top-full mt-3 w-80 -translate-x-1/2 overflow-hidden rounded-xl border border-amber-500/25 bg-slate-900 p-2 shadow-2xl"
                    >
                      {memberNavItems.map((item) => {
                        const Icon = item.icon;
                        const active = isPathActive(location.pathname, item.path);
                        return (
                          <Link
                            key={item.path}
                            to={item.path}
                            role="menuitem"
                            className={`flex items-start gap-3 rounded-lg px-3 py-3 transition-colors ${
                              active ? 'bg-amber-400/10 text-amber-100' : 'text-amber-50/80 hover:bg-white/5 hover:text-amber-100'
                            }`}
                          >
                            <Icon size={18} className="mt-0.5 flex-shrink-0 text-amber-400" aria-hidden="true" />
                            <span>
                              <span className="block text-sm font-semibold">{item.label}</span>
                              <span className="mt-0.5 block text-xs leading-5 text-slate-400">{item.description}</span>
                            </span>
                          </Link>
                        );
                      })}
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>
            ) : null}

            {primaryNavItems.slice(2).map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={desktopLinkClass(isPathActive(location.pathname, item.path))}
              >
                {item.label}
              </Link>
            ))}
          </div>

          <div className="ml-auto hidden flex-shrink-0 items-center gap-1 border-l border-white/10 pl-3 xl:flex">
            <Link
              to="/search"
              aria-label="Search lodge information"
              title="Search"
              className="flex min-h-11 min-w-11 items-center justify-center rounded-full text-amber-100/75 transition-colors hover:bg-white/5 hover:text-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/80"
            >
              <Search size={19} aria-hidden="true" />
            </Link>

            {user ? (
              <>
                <button
                  type="button"
                  onClick={onNotificationClick}
                  className="flex min-h-11 min-w-11 items-center justify-center rounded-full text-amber-100/75 transition-colors hover:bg-white/5 hover:text-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/80"
                  title="Notification settings"
                  aria-label="Notification settings"
                >
                  <Bell size={18} aria-hidden="true" />
                </button>

                <div className="relative ml-1">
                  <button
                    type="button"
                    onClick={() => toggleDropdown('account')}
                    aria-expanded={openDropdown === 'account'}
                    aria-haspopup="menu"
                    aria-controls="account-navigation-menu"
                    className={`flex min-h-11 items-center gap-2 rounded-full border px-3.5 text-xs font-semibold uppercase tracking-[0.12em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/80 ${
                      isAccountPathActive || openDropdown === 'account'
                        ? 'border-amber-400/55 bg-amber-400/15 text-amber-100'
                        : 'border-amber-400/30 bg-amber-400/5 text-amber-100/85 hover:border-amber-400/50 hover:bg-amber-400/10'
                    }`}
                  >
                    <UserRound size={16} aria-hidden="true" />
                    <span>My Lodge</span>
                    <ChevronDown
                      size={14}
                      aria-hidden="true"
                      className={`transition-transform duration-200 ${openDropdown === 'account' ? 'rotate-180' : ''}`}
                    />
                  </button>

                  <AnimatePresence>
                    {openDropdown === 'account' ? (
                      <motion.div
                        id="account-navigation-menu"
                        role="menu"
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.15 }}
                        className="absolute right-0 top-full mt-3 w-64 overflow-hidden rounded-xl border border-amber-500/25 bg-slate-900 p-2 shadow-2xl"
                      >
                        <div className="border-b border-white/10 px-3 py-2.5">
                          <span className="block text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-amber-400/80">Signed in</span>
                          <span className="mt-1 block truncate text-xs text-slate-300">{user.email}</span>
                        </div>
                        <Link
                          to="/my-lodge"
                          role="menuitem"
                          className="mt-2 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-amber-50/85 transition-colors hover:bg-white/5 hover:text-amber-100"
                        >
                          <House size={17} className="text-amber-400" aria-hidden="true" />
                          My Lodge home
                        </Link>
                        {!loading && canAccessAdmin ? (
                          <Link
                            to="/admin"
                            role="menuitem"
                            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-amber-300 transition-colors hover:bg-amber-400/10 hover:text-amber-200"
                          >
                            <Shield size={17} aria-hidden="true" />
                            Administration
                          </Link>
                        ) : null}
                        <button
                          type="button"
                          role="menuitem"
                          onClick={handleSignOut}
                          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-slate-300 transition-colors hover:bg-white/5 hover:text-white"
                        >
                          <LogOut size={17} aria-hidden="true" />
                          Sign out
                        </button>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </div>
              </>
            ) : (
              <button
                type="button"
                onClick={onAuthClick}
                className="ml-1 flex min-h-11 items-center gap-2 rounded-full border border-amber-400/35 bg-amber-400/5 px-4 text-xs font-semibold uppercase tracking-[0.12em] text-amber-100/90 transition-colors hover:border-amber-400/55 hover:bg-amber-400/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/80"
              >
                <LogIn size={16} aria-hidden="true" />
                <span>Member Login</span>
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => setMobileMenuOpen((current) => !current)}
            className="ml-auto flex min-h-11 min-w-11 items-center justify-center rounded-full text-amber-100 transition-colors hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/80 xl:hidden"
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-navigation-menu"
            aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
          >
            {mobileMenuOpen ? <X size={24} aria-hidden="true" /> : <Menu size={24} aria-hidden="true" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {mobileMenuOpen ? (
          <motion.div
            id="mobile-navigation-menu"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.16 }}
            className="max-h-[calc(100dvh-5rem)] overflow-y-auto border-t border-amber-500/20 bg-slate-950 xl:hidden"
          >
            <div className="mx-auto max-w-xl px-4 py-5 sm:px-6">
              <div className="grid gap-1">
                <Link
                  to="/"
                  className={desktopLinkClass(location.pathname === '/')}
                >
                  <House size={18} className="mr-3 text-amber-400" aria-hidden="true" /> Home
                </Link>
                <Link
                  to="/calendar"
                  className={desktopLinkClass(isPathActive(location.pathname, '/calendar'))}
                >
                  <CalendarDays size={18} className="mr-3 text-amber-400" aria-hidden="true" /> Calendar
                </Link>
                <Link
                  to="/help"
                  className={desktopLinkClass(isPathActive(location.pathname, '/help'))}
                >
                  <CircleHelp size={18} className="mr-3 text-amber-400" aria-hidden="true" /> Help
                </Link>
              </div>

              <div className="my-4 border-t border-white/10" />
              <p className="px-3 text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-amber-400/70">About the lodge</p>
              <div className="mt-2 grid gap-1">
                {aboutNavItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={desktopLinkClass(isPathActive(location.pathname, item.path))}
                    >
                      <Icon size={18} className="mr-3 text-amber-400" aria-hidden="true" /> {item.label}
                    </Link>
                  );
                })}
              </div>

              {user ? (
                <>
                  <div className="my-4 border-t border-white/10" />
                  <p className="px-3 text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-amber-400/70">Member area</p>
                  <div className="mt-2 grid gap-1">
                    <Link
                      to="/my-lodge"
                      className={desktopLinkClass(isPathActive(location.pathname, '/my-lodge'))}
                    >
                      <House size={18} className="mr-3 text-amber-400" aria-hidden="true" /> My Lodge
                    </Link>
                    {memberNavItems.map((item) => {
                      const Icon = item.icon;
                      return (
                        <Link
                          key={item.path}
                          to={item.path}
                          className={desktopLinkClass(isPathActive(location.pathname, item.path))}
                        >
                          <Icon size={18} className="mr-3 text-amber-400" aria-hidden="true" /> {item.label}
                        </Link>
                      );
                    })}
                  </div>
                </>
              ) : null}

              <div className="my-4 border-t border-white/10" />
              <p className="px-3 text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-amber-400/70">Account & tools</p>
              <div className="mt-2 grid gap-1">
                <Link to="/search" className={desktopLinkClass(isPathActive(location.pathname, '/search'))}>
                  <Search size={18} className="mr-3 text-amber-400" aria-hidden="true" /> Search
                </Link>
                {user ? (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        onNotificationClick();
                        closeNavigation();
                      }}
                      className={`${desktopLinkClass(false)} w-full`}
                    >
                      <Bell size={18} className="mr-3 text-amber-400" aria-hidden="true" /> Notifications
                    </button>
                    {!loading && canAccessAdmin ? (
                      <Link to="/admin" className={desktopLinkClass(isPathActive(location.pathname, '/admin'))}>
                        <Shield size={18} className="mr-3 text-amber-400" aria-hidden="true" /> Administration
                      </Link>
                    ) : null}
                    <button
                      type="button"
                      onClick={handleSignOut}
                      className={`${desktopLinkClass(false)} w-full`}
                    >
                      <LogOut size={18} className="mr-3 text-amber-400" aria-hidden="true" /> Sign out
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      onAuthClick();
                      closeNavigation();
                    }}
                    className={`${desktopLinkClass(false)} w-full`}
                  >
                    <LogIn size={18} className="mr-3 text-amber-400" aria-hidden="true" /> Member login
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </nav>
  );
};
