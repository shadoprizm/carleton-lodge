import { ExternalLink } from 'lucide-react';
import { sourcesFor } from '../../lib/history';

interface SourceNotesProps {
  sourceIds: string[];
}

/**
 * Expandable "Sources & notes" disclosure listing a page's sources with
 * title, publisher, locator and link.
 */
export const SourceNotes = ({ sourceIds }: SourceNotesProps) => {
  const sources = sourcesFor(sourceIds);
  if (sources.length === 0) return null;

  return (
    <details className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <summary className="cursor-pointer select-none px-5 py-4 text-sm font-bold text-slate-900 hover:text-amber-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900">
        Sources &amp; notes ({sources.length})
      </summary>
      <ul className="space-y-4 border-t border-slate-100 px-5 py-4">
        {sources.map((source) => (
          <li key={source.id} className="text-sm leading-relaxed text-slate-600">
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="font-mono text-xs font-bold text-amber-800">{source.id}</span>
              <span className="font-semibold text-slate-900">{source.title}</span>
            </div>
            <p className="mt-0.5">
              {source.publisherAuthor} — {source.locator}
            </p>
            <a
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-flex items-center gap-1 text-amber-700 underline decoration-amber-300 underline-offset-2 hover:text-amber-800"
            >
              View source <ExternalLink size={12} aria-hidden="true" />
            </a>
          </li>
        ))}
      </ul>
    </details>
  );
};
