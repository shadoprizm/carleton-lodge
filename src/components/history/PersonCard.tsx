import type { HistoryPerson } from '../../lib/history';

interface PersonCardProps {
  person: HistoryPerson;
}

export const PersonCard = ({ person }: PersonCardProps) => (
  <article className="flex h-full flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <h3 className="font-serif text-xl text-slate-900">{person.name}</h3>
      {person.dateLabel && (
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          {person.dateLabel}
        </span>
      )}
    </div>
    <p className="mt-1 text-sm font-semibold text-amber-800">{person.role}</p>
    <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-600">{person.bio}</p>
    <p className="mt-3 text-xs text-slate-400">
      {person.confidence !== 'high' && (
        <span className="mr-2 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 font-semibold text-amber-800">
          {person.confidence === 'medium' ? 'Under research' : 'Unresolved'}
        </span>
      )}
      {person.sources.join(' · ')}
    </p>
  </article>
);
