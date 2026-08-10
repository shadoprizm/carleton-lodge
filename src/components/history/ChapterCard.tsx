import { Link } from 'react-router';
import { ArrowRight, BookOpen, Church, Flame, Images, Landmark, Medal, Ship, Users } from 'lucide-react';
import type { HistoryChapter } from '../../lib/history';

const chapterIcons: Record<string, typeof Landmark> = {
  landmark: Landmark,
  flame: Flame,
  church: Church,
  ship: Ship,
  medal: Medal,
  users: Users,
  images: Images,
  'book-open': BookOpen,
};

interface ChapterCardProps {
  chapter: HistoryChapter;
}

export const ChapterCard = ({ chapter }: ChapterCardProps) => {
  const Icon = chapterIcons[chapter.icon] ?? Landmark;

  return (
    <Link
      to={`/history/${chapter.slug}`}
      className="group flex h-full flex-col rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
    >
      <div className="flex items-center gap-3">
        <span className="rounded-lg bg-amber-100 p-2 text-amber-800">
          <Icon size={22} aria-hidden="true" />
        </span>
        <span className="text-xs font-bold uppercase tracking-wide text-amber-800">
          {chapter.yearLabel}
        </span>
      </div>
      <h3 className="mt-3 font-serif text-2xl text-slate-900 group-hover:text-amber-800">
        {chapter.title}
      </h3>
      <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-600">{chapter.tagline}</p>
      <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-amber-700 group-hover:text-amber-800">
        Read the chapter <ArrowRight size={15} aria-hidden="true" />
      </span>
    </Link>
  );
};
