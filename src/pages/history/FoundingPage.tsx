import { Link } from 'react-router';
import { HistoryLayout } from '../../components/history/HistoryLayout';
import { Timeline } from '../../components/history/Timeline';
import { HistoryFigure } from '../../components/history/HistoryFigure';
import { SourceNotes } from '../../components/history/SourceNotes';
import { PlaceCard } from '../../components/history/PlaceCard';
import {
  historyEvents,
  historyPlaces,
  imageById,
  knownCharterMembers,
  type HistoryImage,
} from '../../lib/history';

const figure = (id: string): HistoryImage | undefined => imageById(id);

export const FoundingPage = () => {
  const kiddBlock = historyPlaces.find((place) => place.id === 'kidd-block');
  const authenticSlots = ['IMG01', 'IMG02', 'IMG04'].map(figure).filter((img): img is HistoryImage => Boolean(img));
  const aiReconstruction = figure('local-formative-ai');

  return (
    <HistoryLayout
      activeSlug="founding"
      eyebrow="Chapter 1"
      title="The Founding Years"
      intro="In the fall of 1903, the effort to establish a Masonic Lodge at Carp was supported by Mississippi Lodge No. 147 in Almonte. Within a year, Carleton Lodge No. 465 was instituted, warranted, and consecrated."
    >
      <div className="space-y-12">
        <section aria-labelledby="founding-story" className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <h2 id="founding-story" className="font-serif text-3xl text-slate-900">
            A Lodge for Carp
          </h2>
          <div className="mt-4 space-y-4 leading-relaxed text-slate-700">
            <p>
              A dispensation to form Carleton Lodge at Carp, in Ottawa District No. 16, was issued
              on 24 October 1903. The Lodge was instituted on 12 January 1904 with twenty-three
              charter members; Grand Lodge records described the new Lodge as having good prospects
              and being very well furnished. Within weeks, on 28 January 1904, the first three
              applications for initiation and two for affiliation were received and balloted on.
            </p>
            <p>
              The warrant for Carleton Lodge No. 465 was signed and dated 20 July 1904, and on
              4 October 1904 the Lodge was consecrated by R.W. Bro. Sidney Albert Luke, who later
              served as Grand Master.
            </p>
            <p>
              The Lodge initially met upstairs in the Kidd Block, above the drug store in the heart
              of Carp's commercial district.
            </p>
          </div>
        </section>

        <section aria-labelledby="charter-members">
          <h2 id="charter-members" className="font-serif text-3xl text-slate-900">
            The charter members
          </h2>
          <p className="mt-3 max-w-3xl leading-relaxed text-slate-700">
            Carleton Lodge was instituted with twenty-three charter members. The District history
            names only twelve of them — the remaining eleven names have not yet been identified,
            and this list must not be treated as complete:
          </p>
          <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {knownCharterMembers.map((member) => (
              <li
                key={member.id}
                className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 shadow-sm"
              >
                {member.name}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm text-slate-500">
            Identified in the Ottawa District history (S01). Research into the complete roster
            continues — see <Link to="/history/sources" className="text-amber-700 underline decoration-amber-300 underline-offset-2">Sources &amp; research</Link>.
          </p>
        </section>

        <section aria-labelledby="kidd-block">
          <h2 id="kidd-block" className="font-serif text-3xl text-slate-900">
            The Kidd Block
          </h2>
          <div className="mt-5">
            {kiddBlock && <PlaceCard place={kiddBlock} />}
          </div>
          <p className="mt-4 text-sm leading-relaxed text-slate-600">
            Grand Lodge-derived history identifies the Bank of Nova Scotia, the Carp Review
            Printing Office, the Huntley Public Library, and the Carp Drug Store as occupants of
            the Kidd Block when it was destroyed. Carp Heritage Walk material identifies authentic
            circa-1910 photographs of the Kidd Block and nearby Kidd Street in the Huntley Township
            Historical Society collection.
          </p>
        </section>

        <section aria-labelledby="founding-images">
          <h2 id="founding-images" className="font-serif text-3xl text-slate-900">
            The founding era in images
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-600">
            Authentic photographs of the Kidd Block and founding-era Carp are known to exist in the
            Huntley Township Historical Society and Library and Archives Canada collections. These
            slots are reserved for them pending reproduction permission:
          </p>
          <div className="mt-6 grid gap-6 md:grid-cols-3">
            {authenticSlots.map((image) => (
              <HistoryFigure key={image.id} image={image} />
            ))}
          </div>
          {aiReconstruction && (
            <div className="mt-8 max-w-xl">
              <HistoryFigure image={aiReconstruction} />
            </div>
          )}
        </section>

        <section aria-labelledby="founding-timeline">
          <h2 id="founding-timeline" className="font-serif text-3xl text-slate-900">
            1903–1904 in order
          </h2>
          <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <Timeline events={historyEvents} chapterId="founding" />
          </div>
        </section>

        <SourceNotes sourceIds={['S01', 'S03', 'S04']} />
      </div>
    </HistoryLayout>
  );
};
