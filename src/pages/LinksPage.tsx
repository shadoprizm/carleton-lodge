import { motion } from 'framer-motion';
import { Link2, Clock } from 'lucide-react';

export const LinksPage = () => {
  return (
    <div className="min-h-screen bg-slate-50 pt-20">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center"
        >
          <div className="inline-flex items-center justify-center w-20 h-20 bg-amber-100 rounded-full mb-6">
            <Link2 size={40} className="text-amber-600" />
          </div>
          <h1 className="text-4xl md:text-5xl font-serif text-slate-900 mb-4">
            Masonic Links
          </h1>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto mb-8">
            A curated collection of Masonic resources, including Grand Lodge, 
            District organizations, and affiliated bodies.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="bg-white rounded-lg shadow-lg p-8 md:p-12 text-center border border-amber-200"
        >
          <div className="inline-flex items-center justify-center w-16 h-16 bg-amber-50 rounded-full mb-4">
            <Clock size={32} className="text-amber-500" />
          </div>
          <h2 className="text-2xl font-serif text-slate-800 mb-3">
            Coming Soon
          </h2>
          <p className="text-slate-600 max-w-lg mx-auto">
            We are currently compiling and verifying permissions for our list of 
            Masonic links. This page will include links to Grand Lodge, Ottawa 
            Masons, Ottawa Districts 1 and 2, St. Lawrence Districts, Tunis Shrine, 
            RAM, Scottish Rite, and more.
          </p>
          <p className="text-slate-500 text-sm mt-4">
            Please check back soon for updates.
          </p>
        </motion.div>
      </div>
    </div>
  );
};
