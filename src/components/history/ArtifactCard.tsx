import type { HistoryArtifact } from '../../lib/history';

interface ArtifactCardProps {
  artifact: HistoryArtifact;
}

export const ArtifactCard = ({ artifact }: ArtifactCardProps) => (
  <article className="flex h-full flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
    <h3 className="font-serif text-xl text-slate-900">{artifact.name}</h3>
    <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-600">{artifact.description}</p>
    <p className="mt-3 text-xs text-slate-400">{artifact.sources.join(' · ')}</p>
  </article>
);
