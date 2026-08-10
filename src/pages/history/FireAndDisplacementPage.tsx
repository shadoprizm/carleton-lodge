import { HistoryLayout } from '../../components/history/HistoryLayout';
import { Timeline } from '../../components/history/Timeline';
import { HistoryFigure } from '../../components/history/HistoryFigure';
import { SourceNotes, UnresolvedCallout } from '../../components/history/SourceNotes';
import { PlaceCard } from '../../components/history/PlaceCard';
import {
  historyEvents,
  historyPlaces,
  imageById,
  openQuestions,
  type HistoryImage,
} from '../../lib/history';

export const FireAndDisplacementPage = () => {
  const places = historyPlaces.filter((place) =>
    ['kidd-block', 'orange-hall-carp', 'russell-store'].includes(place.id),
  );
  const imageSlots = ['IMG05', 'IMG06']
    .map((id) => imageById(id))
    .filter((img): img is HistoryImage => Boolean(img));
  const fireQuestion = openQuestions.find((question) => question.id === 'fire-newspaper-coverage');

  return (
    <HistoryLayout
      activeSlug="fire-and-displacement"
      eyebrow="Chapter 2"
      title="Fire and Displacement"
      intro="On 20 July 1920 a major fire destroyed the Kidd Block and Carleton Lodge's original Lodge rooms. Six years of temporary accommodation followed."
    >
      <div className="space-y-12">
        <section aria-labelledby="the-fire" className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <h2 id="the-fire" className="font-serif text-3xl text-slate-900">
            The fire — 20 July 1920
          </h2>
          <div className="mt-4 space-y-4 leading-relaxed text-slate-700">
            <p>
              The Masonic District history states that the fire apparently began in the tin shop of
              Joe Rishaur and spread rapidly through adjacent buildings. The entire Kidd Block was
              destroyed. The fire then crossed the main street and burned Austin Younghusband's
              dry-goods business.
            </p>
            <p>
              Carleton Lodge lost its original Lodge space and furnishings. The local Orange Lodge
              immediately offered use of its hall, giving Carleton Lodge a temporary place to
              continue meeting.
            </p>
          </div>
          <p className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm leading-relaxed text-slate-600">
            No authentic photograph of the fire or its aftermath is known to survive. The search of
            contemporary newspaper coverage continues — until an authentic image is confirmed, this
            page shows placeholders rather than any reconstruction.
          </p>
        </section>

        {fireQuestion && <UnresolvedCallout question={fireQuestion} />}

        <section aria-labelledby="without-a-home">
          <h2 id="without-a-home" className="font-serif text-3xl text-slate-900">
            A Lodge without a permanent home — 1920–1926
          </h2>
          <div className="mt-4 max-w-3xl space-y-4 leading-relaxed text-slate-700">
            <p>
              By May 1921, a stock company had been created in an attempt to finance a memorial
              hall that would include a Lodge room on an upper storey. Enough money was raised for
              a single-storey hall, but not for the proposed second-storey Lodge facility.
            </p>
            <p>
              By May 1923, Carleton Lodge was meeting temporarily in the upper portion of
              Bro. F. C. Russell's store. The years following the 1920 fire therefore involved
              several temporary arrangements before a permanent solution emerged.
            </p>
          </div>
          <div className="mt-6 grid gap-5 md:grid-cols-3">
            {places.map((place) => (
              <PlaceCard key={place.id} place={place} />
            ))}
          </div>
        </section>

        <section aria-labelledby="displacement-images">
          <h2 id="displacement-images" className="font-serif text-3xl text-slate-900">
            Reserved image slots
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-600">
            These slots are held for authentic Huntley Township Historical Society photographs of
            the post-fire era, pending provenance confirmation and reproduction permission:
          </p>
          <div className="mt-6 grid gap-6 md:grid-cols-2">
            {imageSlots.map((image) => (
              <HistoryFigure key={image.id} image={image} />
            ))}
          </div>
        </section>

        <section aria-labelledby="displacement-timeline">
          <h2 id="displacement-timeline" className="font-serif text-3xl text-slate-900">
            1920–1926 in order
          </h2>
          <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <Timeline events={historyEvents} chapterId="fire-and-displacement" />
          </div>
        </section>

        <SourceNotes sourceIds={['S01', 'S05']} />
      </div>
    </HistoryLayout>
  );
};
