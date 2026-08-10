import { ExternalLink } from 'lucide-react';
import { sourcesFor, type OpenQuestion } from '../../lib/history';

interface SourceNotesProps {
  sourceIds: string[];
}

/**
 * Expandable "Sources & notes" disclosure listing a page's sources with
 * title, publisher, locator, link and confidence.
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
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                {source.confidence} confidence
              </span>
            </div>
            <p className="mt-0.5">
              {source.publisherAuthor} — {source.locator}
            </p>
            <p className="mt-0.5 text-slate-500">{source.notes}</p>
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

interface UnresolvedCalloutProps {
  question: OpenQuestion;
}

/**
 * Subtle callout marking a point where the historical record is still
 * unresolved, so uncertainty is visible exactly where it applies.
 */
export const UnresolvedCallout = ({ question }: UnresolvedCalloutProps) => (
  <aside className="rounded-xl border border-amber-300 bg-amber-50 p-5">
    <p className="text-xs font-bold uppercase tracking-wide text-amber-800">
      Unresolved — under research
    </p>
    <h3 className="mt-1 font-serif text-lg text-slate-900">{question.title}</h3>
    {question.known.length > 0 && (
      <>
        <p className="mt-3 text-sm font-semibold text-slate-800">What the record shows</p>
        <ul className="mt-1 list-disc space-y-1 pl-5 text-sm leading-relaxed text-slate-700">
          {question.known.map((fact) => (
            <li key={fact}>{fact}</li>
          ))}
        </ul>
      </>
    )}
    {question.bestLead && (
      <p className="mt-3 text-sm leading-relaxed text-slate-600">
        <span className="font-semibold text-slate-800">Best lead: </span>
        {question.bestLead}
      </p>
    )}
  </aside>
);
