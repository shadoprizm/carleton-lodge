import { motion } from 'framer-motion';
import { CalendarDays, MapPin } from 'lucide-react';
import { LODGE_ADDRESS, LODGE_MEETING_SCHEDULE } from '../lib/lodge';

export const AboutLodge = () => {
  return (
    <section className="py-24 bg-white relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <motion.div
            initial={{ opacity: 0, x: -24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <img
              src="/history/legacy/historical-lodge-building/carleton-lodge-building-exterior-colour.jpg"
              alt="Modern colour exterior photograph of the Carleton Lodge Masonic Temple in summer."
              loading="lazy"
              decoding="async"
              className="w-full rounded-lg shadow-xl object-cover"
            />
            <p className="mt-3 text-xs text-slate-500">
              The Masonic Temple at 3704 Carp Road — the former St. Andrew&rsquo;s Presbyterian Church.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            <h2 className="text-4xl md:text-5xl font-serif text-slate-900 mb-6">
              A country lodge in the heart of West Carleton
            </h2>
            <p className="text-lg text-slate-600 font-light leading-relaxed mb-4">
              Warranted in 1904, Carleton Lodge has met in Carp ever since — through the
              great fire that took its first home in 1920, and into the former
              St. Andrew&rsquo;s Presbyterian Church that has served as its Masonic Temple
              for generations.
            </p>
            <p className="text-lg text-slate-600 font-light leading-relaxed mb-8">
              We are neighbours, friends, and brothers: men of Carp and the surrounding
              West Carleton community who share fellowship, tradition, and a commitment
              to becoming better men.
            </p>

            <div className="space-y-4 border-t border-slate-200 pt-6">
              <div className="flex items-start gap-3">
                <CalendarDays size={20} className="mt-0.5 flex-shrink-0 text-amber-700" aria-hidden="true" />
                <p className="text-slate-700">
                  Regular communications are held on{' '}
                  <span className="font-semibold">{LODGE_MEETING_SCHEDULE}</span>.
                </p>
              </div>
              <div className="flex items-start gap-3">
                <MapPin size={20} className="mt-0.5 flex-shrink-0 text-amber-700" aria-hidden="true" />
                <p className="text-slate-700">
                  Masonic Hall, <span className="font-semibold">{LODGE_ADDRESS}</span>
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};
