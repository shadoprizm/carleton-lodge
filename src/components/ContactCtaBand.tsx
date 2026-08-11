import { Link } from 'react-router';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { SUPPORT_EMAIL, supportMailto } from '../lib/contact';

export const ContactCtaBand = () => {
  return (
    <section className="py-20 bg-gradient-to-br from-blue-900 to-blue-800 text-white relative overflow-hidden">
      <div
        className="absolute inset-0 opacity-5"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='2.5' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
      />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-4xl md:text-5xl font-serif mb-4">
            Questions about Freemasonry, visiting, or the Lodge?
          </h2>
          <p className="text-lg text-white/80 max-w-2xl mx-auto font-light mb-10">
            Whether you are curious about Freemasonry, planning a visit from another
            Lodge, or have a question about Carleton Lodge, we are glad to hear from you.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link
              to="/contact"
              className="inline-flex items-center space-x-2 px-8 py-4 bg-amber-600 text-white rounded-md hover:bg-amber-700 transition-all font-medium tracking-wide shadow-lg"
            >
              <span>Contact the Lodge</span>
              <ArrowRight size={18} />
            </Link>
            <a
              href={supportMailto()}
              className="inline-flex items-center px-8 py-4 border-2 border-amber-400 text-amber-100 rounded-md hover:bg-amber-400/10 transition-all font-medium tracking-wide"
            >
              {SUPPORT_EMAIL}
            </a>
          </div>
        </motion.div>
      </div>
    </section>
  );
};
