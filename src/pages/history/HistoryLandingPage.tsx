import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { HistoryLayout } from '../../components/history/HistoryLayout';
import { Timeline } from '../../components/history/Timeline';
import { ChapterCard } from '../../components/history/ChapterCard';
import { imageById, landingTimelineEvents, narrativeChapters } from '../../lib/history';

// Restrained authentic-photo strip (rights-cleared, Lodge-owned) — kept quiet
// per the master prompt; the homepage proper remains untouched.
const photoStripIds = ['LEG03', 'LEG01', 'LEG07'];

export const HistoryLandingPage = () => {
  const reduceMotion = useReducedMotion();
  const photoStrip = photoStripIds
    .map((id) => imageById(id))
    .filter((img): img is NonNullable<typeof img> => Boolean(img));

  return (
    <HistoryLayout
      eyebrow="Carleton Lodge No. 465 — Historical Archive"
      title="More than a century in Carp"
      intro="From an upstairs Lodge room in the commercial centre of early twentieth-century Carp, through fire and displacement, to a former Presbyterian church raised on new foundations — and a wartime connection to Le Havre, France."
    >
      <motion.section
        initial={reduceMotion ? false : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        aria-labelledby="history-overview"
        className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
      >
        <h2 id="history-overview" className="font-serif text-3xl text-slate-900">
          The archive
        </h2>
        <div className="mt-4 space-y-4 leading-relaxed text-slate-700">
          <p>
            Carleton Lodge No. 465 has been part of the Carp and Huntley Township community for more
            than a century. Its history reaches from an upstairs Lodge room in the commercial centre
            of early twentieth-century Carp, through a devastating 1920 fire and years of temporary
            accommodation, to the conversion of a former Presbyterian church into the Lodge's
            permanent home.
          </p>
          <p>
            One of the most unusual threads in the story began thousands of kilometres away during
            the First World War. A military Masonic Lodge created by Allied servicemen at Le Havre,
            France, closed in 1919. Its furniture and records were packed into sixteen crates and
            shipped to London. Years later, as Carleton Lodge was preparing its new home in Carp,
            the historic collection was acquired and brought to the Lodge.
          </p>
          <p>
            The result is a Lodge history inseparable from the history of Carp itself: local
            merchants and farmers, village fires, churches, wartime service, community institutions,
            and artifacts that connect Carp with the Western Front.
          </p>
        </div>
      </motion.section>

      <section aria-labelledby="key-dates" className="mt-12">
        <h2 id="key-dates" className="font-serif text-3xl text-slate-900">
          Key dates
        </h2>
        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <Timeline events={landingTimelineEvents()} compact />
        </div>
      </section>

      <section aria-labelledby="history-chapters" className="mt-12">
        <h2 id="history-chapters" className="font-serif text-3xl text-slate-900">
          The story, chapter by chapter
        </h2>
        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          {narrativeChapters.map((chapter) => (
            <ChapterCard key={chapter.id} chapter={chapter} />
          ))}
        </div>
      </section>

      <section aria-labelledby="archive-photographs" className="mt-12">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="archive-photographs" className="font-serif text-3xl text-slate-900">
            From the Lodge's own archive
          </h2>
          <Link
            to="/history/gallery"
            className="inline-flex items-center gap-1 text-sm font-semibold text-amber-700 hover:text-amber-800"
          >
            View the gallery <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </div>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600">
          Photographs recovered from the Lodge's retired website — the Temple, the Lodge room, and
          the 2016 West Carleton War Memorial cornerstone.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {photoStrip.map((image) => (
            <Link
              key={image.id}
              to="/history/gallery"
              className="group overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
            >
              <img
                src={image.localPath}
                alt={image.alt}
                loading="lazy"
                decoding="async"
                className="h-44 w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
              />
              <p className="p-3 text-sm font-semibold text-slate-900 group-hover:text-amber-800">
                {image.title}
              </p>
            </Link>
          ))}
        </div>
      </section>

      <section aria-labelledby="explore-archive" className="mt-12">
        <h2 id="explore-archive" className="font-serif text-3xl text-slate-900">
          Explore the archive
        </h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <Link
            to="/history/people"
            className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
          >
            <h3 className="font-serif text-xl text-slate-900">People of the Lodge</h3>
            <p className="mt-1 text-sm text-slate-600">
              Founders, known charter members, and key figures.
            </p>
          </Link>
          <Link
            to="/history/gallery"
            className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
          >
            <h3 className="font-serif text-xl text-slate-900">Gallery</h3>
            <p className="mt-1 text-sm text-slate-600">
              Photographs, documents, and artifacts — honestly labelled.
            </p>
          </Link>
          <Link
            to="/history/sources"
            className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
          >
            <h3 className="font-serif text-xl text-slate-900">Sources &amp; research</h3>
            <p className="mt-1 text-sm text-slate-600">
              How this history is evidenced, and what remains unresolved.
            </p>
          </Link>
        </div>
        <p className="mt-8 text-sm leading-relaxed text-slate-500">
          Every claim in this archive carries its sources and a confidence level. Items still under
          research are flagged rather than smoothed over — see the{' '}
          <Link to="/history/sources" className="font-semibold text-amber-700 hover:text-amber-800">
            source register
          </Link>{' '}
          for the full picture.
          <ArrowRight size={13} className="ml-1 inline text-amber-700" aria-hidden="true" />
        </p>
      </section>
    </HistoryLayout>
  );
};
