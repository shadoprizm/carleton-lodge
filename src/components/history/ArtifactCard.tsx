import type { HistoryArtifact } from '../../lib/history';

const statusLabels: Record<HistoryArtifact['status'], string> = {
  held: 'Held by the Lodge',
  reported_unconfirmed: 'Reported — unconfirmed',
  pending_documentation: 'Documentation pending',
};

interface ArtifactCardProps {
  artifact: HistoryArtifact;
}

export const ArtifactCard = ({ artifact }: ArtifactCardProps) => (
  <article className="flex h-full flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 className="font-serif text-xl text-slate-900">{artifact.name}</h3>
      <span
        className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
          artifact.status === 'held'
            ? 'bg-emerald-50 text-emerald-800'
            : 'border border-amber-300 bg-amber-50 text-amber-800'
        }`}
      >
        {statusLabels[artifact.status]}
      </span>
    </div>
    <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-600">{artifact.description}</p>
    <p className="mt-3 text-xs text-slate-400">{artifact.sources.join(' · ')}</p>
  </article>
);
