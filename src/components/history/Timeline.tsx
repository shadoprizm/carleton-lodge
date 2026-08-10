import { useMemo } from 'react';
import type { HistoryEvent } from '../../lib/history';

interface TimelineProps {
  events: HistoryEvent[];
  /** Restrict the timeline to a single chapter. */
  chapterId?: string;
  compact?: boolean;
}

const confidenceChip = (event: HistoryEvent) => {
  if (event.confidence === 'medium') return 'Under research';
  if (event.confidence === 'unresolved') return 'Unresolved';
  return null;
};

/**
 * Vertical, chronological timeline of history events. Renders as an ordered
 * list with precision-aware date labels and subtle confidence chips for
 * anything not fully confirmed.
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
      {visibleEvents.map((event) => {
        const chip = confidenceChip(event);
        return (
          <li key={event.id} className="relative pl-6">
            <span
              aria-hidden="true"
              className="absolute -left-[7px] top-1.5 h-3 w-3 rounded-full border-2 border-amber-600 bg-white"
            />
            <div className="flex flex-wrap items-center gap-2">
              <time className="text-sm font-bold uppercase tracking-wide text-amber-800">
                {event.dateLabel}
              </time>
              {chip && (
                <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800">
                  {chip}
                </span>
              )}
            </div>
            <h3 className={`${compact ? 'text-base' : 'text-lg'} font-semibold text-slate-900`}>
              {event.title}
            </h3>
            {!compact && <p className="mt-1 leading-relaxed text-slate-600">{event.summary}</p>}
            <p className="mt-1 text-xs text-slate-400">
              {event.sources.join(' · ')}
            </p>
          </li>
        );
      })}
    </ol>
  );
};
