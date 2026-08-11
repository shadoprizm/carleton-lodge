import { Link } from 'react-router';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';

// The homepage history teaser is a single, curated invitation into the full
// public archive at /history (static data in src/lib/history). The public
// history section no longer reads from Supabase; the history_eras/
// history_milestones tables remain for the Lodge Guide knowledge search and
// admin editing.
export const History = () => {
  return (
    <section id="history" className="py-24 bg-slate-50 relative">
      <div
        className="absolute inset-0 opacity-[0.015]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='2.5' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="order-2 lg:order-1"
          >
            <h2 className="text-5xl md:text-6xl font-serif text-slate-900 mb-6">
              Since 1904
            </h2>
            <p className="text-lg text-slate-600 font-light leading-relaxed mb-4">
              Warranted in rooms above a Carp drug store, Carleton Lodge lost its first
              home in the great fire of 1920 and rose again — eventually making its
              temple of the former St. Andrew&rsquo;s Presbyterian Church on Carp Road.
            </p>
            <p className="text-lg text-slate-600 font-light leading-relaxed mb-8">
              Our source-grounded archive traces more than a century of West Carleton
              life: the founding, the fire, a wartime connection to France, and the
              people who built the Lodge.
            </p>
            <Link
              to="/history"
              className="inline-flex items-center space-x-2 bg-amber-600 text-white px-8 py-3 rounded-md hover:bg-amber-700 transition-colors font-semibold"
            >
              <span>Explore Our History</span>
              <ArrowRight size={20} />
            </Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="order-1 lg:order-2"
          >
            <img
              src="/history/legacy/historical-lodge-building/carleton-lodge-building-sepia.jpg"
              alt="Modern sepia-toned photograph of the Carleton Lodge Masonic Temple at 3704 Carp Road."
              loading="lazy"
              decoding="async"
              className="w-full rounded-lg shadow-xl object-cover"
            />
          </motion.div>
        </div>
      </div>
    </section>
  );
};
