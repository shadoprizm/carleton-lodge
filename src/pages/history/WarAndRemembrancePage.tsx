import { HistoryLayout } from '../../components/history/HistoryLayout';
import { Timeline } from '../../components/history/Timeline';
import { HistoryFigure } from '../../components/history/HistoryFigure';
import { SourceNotes } from '../../components/history/SourceNotes';
import { PersonCard } from '../../components/history/PersonCard';
import {
  historyEvents,
  imageById,
  keyFigures,
  type HistoryImage,
} from '../../lib/history';

export const WarAndRemembrancePage = () => {
  const panoramaImage = imageById('LEG02');
  const cornerstoneImages = ['LEG07', 'LEG08']
    .map((id) => imageById(id))
    .filter((img): img is HistoryImage => Boolean(img?.localPath));
  const wilson = keyFigures.find((person) => person.id === 'calvin-potters-wilson');
  const hughes = keyFigures.find((person) => person.id === 'sam-hughes');

  return (
    <HistoryLayout
      activeSlug="war-and-remembrance"
      eyebrow="Chapter 5"
      title="War and Remembrance"
      intro="Carleton Lodge's First World War service left permanent marks: letters and remitted dues for serving brethren, a memorial tablet unveiled in 1919, and a Le Havre setting maul that returned to remembrance duty a century later."
    >
      <div className="space-y-12">
        <section aria-labelledby="wwi-service" className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <h2 id="wwi-service" className="font-serif text-3xl text-slate-900">
            The First World War
          </h2>
          <div className="mt-4 space-y-4 leading-relaxed text-slate-700">
            <p>
              During the First World War, Carleton Lodge sent letters of appreciation to brethren
              serving in His Majesty's forces and remitted the dues of serving members.
            </p>
            <p>
              On 19 May 1919, a memorial tablet was unveiled in the Lodge by Lt.-Gen. Sir Sam
              Hughes, former Minister of Militia and Defence.
            </p>
            <p>
              Veterans Affairs Canada also documents a memorial connected with Carleton Lodge for
              Lt. Calvin Potters Wilson, a Carleton Lodge Mason who died from influenza while on
              military duty in Halifax in October 1918.
            </p>
          </div>
        </section>

        <section aria-labelledby="remembrance-people">
          <h2 id="remembrance-people" className="font-serif text-3xl text-slate-900">
            The names in the record
          </h2>
          <div className="mt-6 grid gap-5 md:grid-cols-2">
            {hughes && <PersonCard person={hughes} />}
            {wilson && <PersonCard person={wilson} />}
          </div>
        </section>

        {panoramaImage && (
          <section aria-labelledby="tablet-in-situ">
            <h2 id="tablet-in-situ" className="font-serif text-3xl text-slate-900">
              The memorial tablet in the Lodge room
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-600">
              This 2014 photograph of the Lodge room shows the framed Warrant and a bronze memorial
              tablet naming Bro. Calvin Potters Wilson, C.E. on the wall:
            </p>
            <div className="mt-6">
              <HistoryFigure image={panoramaImage} />
            </div>
          </section>
        )}

        <section aria-labelledby="modern-remembrance" className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <h2 id="modern-remembrance" className="font-serif text-3xl text-slate-900">
            A century later
          </h2>
          <p className="mt-4 leading-relaxed text-slate-700">
            A century after the creation of the Le Havre Lodge, the historic Le Havre setting maul
            was associated with Carleton Lodge's participation in the cornerstone ceremony for the
            West Carleton War Memorial in 2016 — the maul described in the District history as
            presented by Captain Firebrace, the wartime Lodge's first Master.
          </p>
          <p className="mt-4 leading-relaxed text-slate-700">
            The Lodge laid the memorial's cornerstone and time capsule on 28 May 2016, and the
            engraved granite stone was photographed that day:
          </p>
        </section>

        {cornerstoneImages.length > 0 && (
          <div className="grid gap-6 md:grid-cols-2">
            {cornerstoneImages.map((image) => (
              <HistoryFigure key={image.id} image={image} />
            ))}
          </div>
        )}

        <section aria-labelledby="remembrance-timeline">
          <h2 id="remembrance-timeline" className="font-serif text-3xl text-slate-900">
            Key dates
          </h2>
          <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <Timeline events={historyEvents} chapterId="war-and-remembrance" />
          </div>
        </section>

        <SourceNotes sourceIds={['S01', 'S10']} />
      </div>
    </HistoryLayout>
  );
};
