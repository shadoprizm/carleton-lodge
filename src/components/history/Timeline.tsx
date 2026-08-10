import { useMemo } from 'react';
import type { HistoryEvent } from '../../lib/history';

interface TimelineProps {
  events: HistoryEvent[];
  /** Restrict the timeline to a single chapter. */
  chapterId?: string;
  compact?: boolean;
}

/**
 * Vertical, chronological timeline of history events, rendered as an ordered
 * list with precision-aware date labels and subtle source citations.
 */
export const Timeline = ({ events, chapterId, compact = false }: TimelineProps) => {
  const visibleEvents = useMemo(
    () =>
      events
        .filter((event) => !chapterId || event.chapterIds?.includes(chapterId))
        .sort((a, b) => a.sortKey.localeCompare(b.sortKey)),
    [events, chapterId],
  );

  if (visibleEvents.length === 0) return null;

  return (
    <ol className={`relative ml-3 border-l-2 border-amber-600/40 ${compact ? 'space-y-5' : 'space-y-8'}`}>
      {visibleEvents.map((event) => (
        <li key={event.id} className="relative pl-6">
          <span
            aria-hidden="true"
            className="absolute -left-[7px] top-1.5 h-3 w-3 rounded-full border-2 border-amber-600 bg-white"
          />
          <time className="text-sm font-bold uppercase tracking-wide text-amber-800">
            {event.dateLabel}
          </time>
          <h3 className={`${compact ? 'text-base' : 'text-lg'} font-semibold text-slate-900`}>
            {event.title}
          </h3>
          {!compact && <p className="mt-1 leading-relaxed text-slate-600">{event.summary}</p>}
          <p className="mt-1 text-xs text-slate-400">
            {event.sources.join(' · ')}
          </p>
        </li>
      ))}
    </ol>
  );
};
