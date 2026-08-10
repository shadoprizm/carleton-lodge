import { ExternalLink } from 'lucide-react';
import { HistoryLayout } from '../../components/history/HistoryLayout';
import { historyImages, historySources, openQuestions } from '../../lib/history';

const evidenceHierarchy = [
  'Grand Lodge Proceedings / Lodge records / original archival records',
  'Library and Archives Canada / Veterans Affairs Canada / municipal or institutional archives',
  'Huntley Township Historical Society / Carp Heritage Walk with explicit provenance',
  'Ottawa District histories and lodge histories',
  'Contemporary newspapers',
  'Secondary historical writing',
  'Oral tradition / current lodge website',
  'AI-generated reconstruction — visual only, never evidence',
];

const rightsLabels: Record<string, string> = {
  cleared: 'Rights cleared',
  permission_required: 'Permission required',
  rights_check_required: 'Rights check required',
  lodge_owned: 'Lodge-owned / Lodge-controlled',
};

export const HistorySourcesPage = () => (
  <HistoryLayout
    activeSlug="sources"
    eyebrow="The archive"
    title="Sources & Research"
    intro="How this history is evidenced, where every claim comes from, who holds the images — and the questions that remain honestly open."
  >
    <div className="space-y-12">
      <section aria-labelledby="methodology" className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <h2 id="methodology" className="font-serif text-3xl text-slate-900">
          Source methodology
        </h2>
        <p className="mt-4 leading-relaxed text-slate-700">
          Every claim in this archive is tied to the sources below and carries a confidence level:
          high, medium, or unresolved. Where evidence conflicts or is incomplete, the uncertainty is
          shown on the page rather than smoothed over. Evidence is preferred in this order:
        </p>
        <ol className="mt-4 list-decimal space-y-1.5 pl-6 text-sm leading-relaxed text-slate-700">
          {evidenceHierarchy.map((tier) => (
            <li key={tier}>{tier}</li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="source-register">
        <h2 id="source-register" className="font-serif text-3xl text-slate-900">
          The source register
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
              <p className="mt-1 text-sm text-slate-600">
                {source.publisherAuthor} — {source.locator}
              </p>
              <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                {source.sourceType} · {source.confidence} confidence
              </p>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-600">{source.notes}</p>
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

      <section aria-labelledby="image-rights">
        <h2 id="image-rights" className="font-serif text-3xl text-slate-900">
          Image rights &amp; acknowledgements
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-600">
          No third-party historical photograph is published here without confirmed reproduction
          rights. Slots awaiting permission render as neutral placeholders — never AI stand-ins.
          The full register, in acquisition priority order:
        </p>
        <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-xs font-bold uppercase tracking-wide text-slate-600">
                <th scope="col" className="px-4 py-3">Slot</th>
                <th scope="col" className="px-4 py-3">Image</th>
                <th scope="col" className="px-4 py-3">Source / owner</th>
                <th scope="col" className="px-4 py-3">Rights status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {historyImages.map((image) => (
                <tr key={image.id}>
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-xs font-bold text-amber-800">
                    {image.id}
                  </td>
                  <td className="px-4 py-3 font-semibold text-slate-900">{image.title}</td>
                  <td className="px-4 py-3 text-slate-600">{image.sourceInstitution}</td>
                  <td className="px-4 py-3 text-slate-600">{rightsLabels[image.rightsStatus] ?? image.rightsStatus}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5 text-sm leading-relaxed text-slate-600 shadow-sm">
          <p>
            <span className="font-semibold text-slate-900">Legacy archive acknowledgement (S10): </span>
            The images with LEG-prefixed slots were recovered in August 2026 from Internet Archive
            captures of the Lodge's retired website, carletonlodge465.com, and are confirmed
            Lodge-owned. Captions on these photographs state only what is visibly shown plus
            EXIF or filename dates; names, years and occasions marked “to be confirmed” await
            member identification — 72 of the 89 recovered files still need that confirmation.
            Byte-identical preservation copies are held in the Lodge's archive and are not served
            on this website.
          </p>
        </div>
      </section>

      <section aria-labelledby="open-questions">
        <h2 id="open-questions" className="font-serif text-3xl text-slate-900">
          Open research questions
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-600">
          These items remain flagged in the site data until resolved. Nothing below is presented as
          settled fact anywhere in the archive.
        </p>
        <div className="mt-6 space-y-5">
          {openQuestions.map((question, index) => (
            <article
              key={question.id}
              className="rounded-xl border border-amber-300 bg-amber-50 p-5"
            >
              <h3 className="font-serif text-xl text-slate-900">
                {index + 1}. {question.title}
              </h3>
              <div className="mt-3 grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-sm font-semibold text-slate-800">Known</p>
                  <ul className="mt-1 list-disc space-y-1 pl-5 text-sm leading-relaxed text-slate-700">
                    {question.known.map((fact) => (
                      <li key={fact}>{fact}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800">Still needed</p>
                  <ul className="mt-1 list-disc space-y-1 pl-5 text-sm leading-relaxed text-slate-700">
                    {question.needed.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              </div>
              {question.bestLead && (
                <p className="mt-3 text-sm leading-relaxed text-slate-600">
                  <span className="font-semibold text-slate-800">Best lead: </span>
                  {question.bestLead}
                </p>
              )}
            </article>
          ))}
        </div>
      </section>
    </div>
  </HistoryLayout>
);
