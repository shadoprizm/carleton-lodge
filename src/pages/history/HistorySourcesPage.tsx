import { ExternalLink } from 'lucide-react';
import { HistoryLayout } from '../../components/history/HistoryLayout';
import { historySources } from '../../lib/history';

export const HistorySourcesPage = () => (
  <HistoryLayout
    activeSlug="sources"
    eyebrow="The archive"
    title="Sources & Research"
    intro="How this history was researched, and the published and archival sources on which it rests."
  >
    <div className="space-y-12">
      <section aria-labelledby="methodology" className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <h2 id="methodology" className="font-serif text-3xl text-slate-900">
          How this history was researched
        </h2>
        <div className="mt-4 space-y-4 leading-relaxed text-slate-700">
          <p>
            This account is grounded first in the records closest to the events: Grand Lodge
            proceedings and Lodge records, as drawn together in the Ottawa District history, and
            original archival records. Beyond those, it relies on institutional archives such as
            Library and Archives Canada and Veterans Affairs Canada, on the work of the Huntley
            Township Historical Society and the Carp Heritage Walk, on district and lodge
            histories, and on contemporary newspapers.
          </p>
          <p>
            Where the surviving record is incomplete or sources disagree, the text says so plainly
            rather than offering a precision the evidence does not support.
          </p>
        </div>
      </section>

      <section aria-labelledby="source-register">
        <h2 id="source-register" className="font-serif text-3xl text-slate-900">
          The sources
        </h2>
        <div className="mt-6 grid gap-5 md:grid-cols-2">
          {historySources.map((source) => (
            <article
              key={source.id}
              className="flex h-full flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="font-mono text-xs font-bold text-amber-800">{source.id}</span>
                <h3 className="font-serif text-lg text-slate-900">{source.title}</h3>
              </div>
              <p className="mt-1 flex-1 text-sm text-slate-600">
                {source.publisherAuthor} — {source.locator}
              </p>
              <a
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-amber-700 underline decoration-amber-300 underline-offset-2 hover:text-amber-800"
              >
                View source <ExternalLink size={13} aria-hidden="true" />
              </a>
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="acknowledgements" className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <h2 id="acknowledgements" className="font-serif text-3xl text-slate-900">
          Acknowledgements
        </h2>
        <div className="mt-4 space-y-4 leading-relaxed text-slate-700">
          <p>
            This archive draws on the work of the Ottawa District historians, particularly the
            district history <em>Ottawa District — Then and Now: Freemasonry in Eastern Ontario
            1855–2010</em>; the Huntley Township Historical Society; the Carp Heritage Walk; and
            Library and Archives Canada, whose catalogues document the village and congregation
            among which the Lodge has always lived.
          </p>
          <p>
            The modern photographs are from the Lodge's own archive, including images carried
            over from its earlier website — thanks to the members who photographed and kept them
            over the years.
          </p>
        </div>
      </section>
    </div>
  </HistoryLayout>
);
