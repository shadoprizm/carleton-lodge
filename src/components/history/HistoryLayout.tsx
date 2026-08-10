import type { ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { historyChapters } from '../../lib/history';

interface HistoryLayoutProps {
  /** Slug of the active chapter, used for the breadcrumb and sub-navigation. */
  activeSlug?: string;
  title: string;
  eyebrow?: string;
  intro?: string;
  children: ReactNode;
}

/**
 * Shared wrapper for every /history/* page: breadcrumb, chapter
 * sub-navigation, and a consistent content container. The restrained
 * archival cues (serif eyebrow, thin amber rule) stay inside this branch.
 */
export const HistoryLayout = ({ activeSlug, title, eyebrow, intro, children }: HistoryLayoutProps) => {
  const activeChapter = activeSlug
    ? historyChapters.find((chapter) => chapter.slug === activeSlug)
    : undefined;

  return (
    <div className="min-h-screen bg-slate-50 pt-20">
      <header className="bg-slate-950 px-4 pb-10 pt-12 text-white sm:px-6">
        <div className="mx-auto max-w-5xl">
          <nav aria-label="Breadcrumb" className="mb-5">
            <ol className="flex flex-wrap items-center gap-1 text-sm text-slate-300">
              <li>
                <Link to="/" className="hover:text-amber-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400">
                  Home
                </Link>
              </li>
              <li aria-hidden="true"><ChevronRight size={14} /></li>
              <li>
                {activeChapter ? (
                  <Link to="/history" className="hover:text-amber-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400">
                    History
                  </Link>
                ) : (
                  <span aria-current="page" className="text-amber-400">History</span>
                )}
              </li>
              {activeChapter && (
                <>
                  <li aria-hidden="true"><ChevronRight size={14} /></li>
                  <li>
                    <span aria-current="page" className="text-amber-400">{activeChapter.title}</span>
                  </li>
                </>
              )}
            </ol>
          </nav>
          {eyebrow && (
            <p className="mb-2 font-serif text-sm uppercase tracking-[0.2em] text-amber-400">{eyebrow}</p>
          )}
          <h1 className="text-4xl font-serif sm:text-5xl">{title}</h1>
          {activeChapter && (
            <p className="mt-2 text-sm font-semibold uppercase tracking-wider text-slate-400">
              {activeChapter.yearLabel}
            </p>
          )}
          {intro && (
            <p className="mt-4 max-w-3xl text-lg leading-relaxed text-slate-200">{intro}</p>
          )}
          <div className="mt-6 h-px w-24 bg-amber-600" aria-hidden="true" />
        </div>
      </header>

      <nav aria-label="History chapters" className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-5xl overflow-x-auto px-4 sm:px-6">
          <ul className="flex gap-2 py-3">
            <li>
              <NavLink
                to="/history"
                end
                className={({ isActive }) =>
                  `block whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 ${
                    isActive
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-amber-100 hover:text-amber-900'
                  }`
                }
              >
                Overview
              </NavLink>
            </li>
            {historyChapters.map((chapter) => (
              <li key={chapter.id}>
                <NavLink
                  to={`/history/${chapter.slug}`}
                  className={({ isActive }) =>
                    `block whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 ${
                      isActive
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-amber-100 hover:text-amber-900'
                    }`
                  }
                >
                  {chapter.title}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      </nav>

      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">{children}</div>
    </div>
  );
};
