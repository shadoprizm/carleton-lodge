import { HistoryLayout } from '../../components/history/HistoryLayout';
import { Timeline } from '../../components/history/Timeline';
import { HistoryFigure } from '../../components/history/HistoryFigure';
import { SourceNotes } from '../../components/history/SourceNotes';
import { ArtifactCard } from '../../components/history/ArtifactCard';
import {
  historyArtifacts,
  historyEvents,
  imageById,
} from '../../lib/history';

export const LeHavrePage = () => {
  const artifactIds = ['le-havre-furniture', 'setting-maul', 'altar-campbell', 'le-havre-minute-book'];
  const artifacts = historyArtifacts.filter((artifact) => artifactIds.includes(artifact.id));
  const interiorImage = imageById('LEG01');

  return (
    <HistoryLayout
      activeSlug="le-havre"
      eyebrow="Chapter 4"
      title="The Le Havre Connection"
      intro="During the First World War, Allied servicemen at Le Havre, France, established La Loge Le Havre de Grâce No. 4. When it closed, its furniture and records began an unlikely journey to Carp."
    >
      <div className="space-y-12">
        <section aria-labelledby="le-havre-story" className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <h2 id="le-havre-story" className="font-serif text-3xl text-slate-900">
            La Loge Le Havre de Grâce No. 4
          </h2>
          <div className="mt-4 space-y-4 leading-relaxed text-slate-700">
            <p>
              British, Dominion, American and other Allied servicemen at Le Havre established the
              Lodge under the French regular Grand Lodge. It was consecrated on 31 October 1916 and
              closed on 7 January 1919.
            </p>
            <p>
              According to the Ottawa District history, it had 71 founding members and 49
              affiliates. During its short existence it held 24 regular and 14 emergent meetings and
              conducted 89 initiations, 76 Fellowcraft degrees and 60 third degrees.
            </p>
            <p>
              After the Lodge closed, only two members reportedly remained in France, both Canadians
              from Montreal. Treasurer Bro. William Stuart was one of them.
            </p>
          </div>
        </section>

        <section aria-labelledby="the-journey" className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <h2 id="the-journey" className="font-serif text-3xl text-slate-900">
            Sixteen crates to London — and a rescue
          </h2>
          <div className="mt-4 space-y-4 leading-relaxed text-slate-700">
            <p>
              Stuart arranged for the Lodge furniture and documents to be packed into sixteen wooden
              crates and shipped to London aboard the <em>Perseverence</em>. The material was stored
              with Taylor &amp; Son in Pimlico.
            </p>
            <p>
              By about 1924–25, storage charges had gone unpaid and the collection faced auction.
              Carleton Lodge ultimately acquired the furniture and documents with clear title. On
              26 February 1926, Bro. Stuart, by then affiliated with Carleton Lodge, offered to pay
              the expenses associated with acquiring the historic furniture.
            </p>
            <p>
              The collection did not include an altar; Carleton Lodge later obtained one from
              A. F. Campbell &amp; Son of Arnprior.
            </p>
            <p>
              The District history also describes a wooden setting maul presented by Captain
              Firebrace, the first Master of La Loge Le Havre de Grâce. Its timber was said to have
              first formed part of a warship's rib and later spent more than a century in the frame
              of a Masonic Hall.
            </p>
            <p>
              The same District history lists the Minute Book and Register of Members of La Loge Le
              Havre de Grâce as held in the archives of Carleton Lodge. Whether those records
              survive today has not been established.
            </p>
          </div>
        </section>

        <section aria-labelledby="le-havre-artifacts">
          <h2 id="le-havre-artifacts" className="font-serif text-3xl text-slate-900">
            The artifacts
          </h2>
          <div className="mt-6 grid gap-5 md:grid-cols-2">
            {artifacts.map((artifact) => (
              <ArtifactCard key={artifact.id} artifact={artifact} />
            ))}
          </div>
        </section>

        {interiorImage && (
          <section aria-labelledby="le-havre-room">
            <h2 id="le-havre-room" className="font-serif text-3xl text-slate-900">
              The Lodge room today
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-600">
              The Le Havre furnishings remain in use in the Lodge room at Carp, photographed here
              during an official visit in 2014. Whether individual pieces in view descend from the
              Le Havre collection has not been established from the photograph alone.
            </p>
            <div className="mt-6">
              <HistoryFigure image={interiorImage} />
            </div>
          </section>
        )}

        <section aria-labelledby="le-havre-timeline">
          <h2 id="le-havre-timeline" className="font-serif text-3xl text-slate-900">
            1916–1926 in order
          </h2>
          <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <Timeline events={historyEvents} chapterId="le-havre" />
          </div>
        </section>

        <SourceNotes sourceIds={['S01', 'S07', 'S10']} />
      </div>
    </HistoryLayout>
  );
};
