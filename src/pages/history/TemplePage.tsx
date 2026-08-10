import { HistoryLayout } from '../../components/history/HistoryLayout';
import { Timeline } from '../../components/history/Timeline';
import { HistoryFigure } from '../../components/history/HistoryFigure';
import { SourceNotes, UnresolvedCallout } from '../../components/history/SourceNotes';
import {
  historyEvents,
  imageById,
  openQuestions,
} from '../../lib/history';

export const TemplePage = () => {
  const modernPhoto = imageById('local-temple-modern');
  const churchPhoto = imageById('IMG03');
  const legacyExteriors = ['LEG03', 'LEG04', 'LEG05']
    .map((id) => imageById(id))
    .filter((img): img is NonNullable<typeof img> => Boolean(img));
  const deedQuestion = openQuestions.find((question) => question.id === 'church-deed-date');

  return (
    <HistoryLayout
      activeSlug="temple"
      eyebrow="Chapter 3"
      title="From Church to Temple"
      intro="Church Union in 1925 left a former Presbyterian church in Carp without a congregation. Within five years it had become the Masonic Temple the Lodge still calls home."
    >
      <div className="space-y-12">
        <section aria-labelledby="temple-story" className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <h2 id="temple-story" className="font-serif text-3xl text-slate-900">
            A new permanent home
          </h2>
          <div className="mt-4 space-y-4 leading-relaxed text-slate-700">
            <p>
              Church Union in 1925 brought together local Methodist and Presbyterian congregations
              under the United Church of Canada. The former Presbyterian congregation considered
              alternatives for St. Andrew's Church but was reportedly unhappy with the possibility
              of ordinary commercial use.
            </p>
            <p>
              Members of Carleton Lodge approached the congregation. The District history records
              that the church building and land were to be deeded to the Freemasons for $250 plus
              legal transfer fees.
            </p>
            <p>
              The building was extensively refurbished. Importantly, the former church was
              physically raised to create a basement refreshment facility below the Lodge room.
            </p>
            <p>
              Carleton Lodge held its first meeting in the present Masonic Temple on 15 April 1927.
              Grand Lodge formally dedicated the Masonic Temple at Carp on 18 October 1930.
            </p>
            <p className="text-sm text-slate-500">
              St. Andrew's is dated 1876 by local-history source S03 (Carp Heritage Walk). An
              earlier 1872–1875 construction claim has been set aside until primary records settle
              the chronology.
            </p>
          </div>
        </section>

        {deedQuestion && <UnresolvedCallout question={deedQuestion} />}

        <section aria-labelledby="temple-images">
          <h2 id="temple-images" className="font-serif text-3xl text-slate-900">
            The building, then and now
          </h2>
          <div className="mt-6 grid gap-6 md:grid-cols-2">
            {churchPhoto && <HistoryFigure image={churchPhoto} />}
            {modernPhoto && <HistoryFigure image={modernPhoto} />}
          </div>
          <p className="mt-4 text-sm leading-relaxed text-slate-600">
            The archival slot is reserved for Library and Archives Canada photograph C-12167, the
            church before its Masonic conversion; the modern photograph shows the Temple as it
            stands at 3704 Carp Road.
          </p>
        </section>

        <section aria-labelledby="temple-today">
          <h2 id="temple-today" className="font-serif text-3xl text-slate-900">
            The Temple today
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-600">
            Modern exterior photographs of the Temple, recovered from the Lodge's retired website:
          </p>
          <div className="mt-6 grid gap-6 md:grid-cols-3">
            {legacyExteriors.map((image) => (
              <HistoryFigure key={image.id} image={image} />
            ))}
          </div>
        </section>

        <section aria-labelledby="temple-timeline">
          <h2 id="temple-timeline" className="font-serif text-3xl text-slate-900">
            1925–1930 in order
          </h2>
          <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <Timeline events={historyEvents} chapterId="temple" />
          </div>
        </section>

        <SourceNotes sourceIds={['S01', 'S03', 'S04', 'S09']} />
      </div>
    </HistoryLayout>
  );
};
