import { MapPin } from 'lucide-react';
import type { HistoryPlace } from '../../lib/history';

interface PlaceCardProps {
  place: HistoryPlace;
}

export const PlaceCard = ({ place }: PlaceCardProps) => (
  <article className="flex h-full flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="flex items-center gap-2">
      <MapPin size={18} className="shrink-0 text-amber-700" aria-hidden="true" />
      <h3 className="font-serif text-xl text-slate-900">{place.name}</h3>
    </div>
    {place.dateLabel && (
      <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
        {place.dateLabel}
      </p>
    )}
    <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-600">{place.description}</p>
    <p className="mt-3 text-xs text-slate-400">{place.sources.join(' · ')}</p>
  </article>
);
