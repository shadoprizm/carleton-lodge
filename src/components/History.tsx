import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { Calendar, ArrowRight } from 'lucide-react';
import { getOptimizedAssetUrl } from '../utils/assetUrls';

interface HistoryEra {
  id: string;
  title: string;
  year_start: number;
  year_end: number | null;
  slug: string;
  summary: string;
  image_url: string | null;
  display_order: number;
}

export const History = () => {
  const [eras, setEras] = useState<HistoryEra[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    const { data, error } = await supabase
      .from('history_eras')
      .select('*')
      .order('display_order', { ascending: true })
      .limit(3);

    if (!error && data) {
      setEras(data);
    }
    setLoading(false);
  };

  return (
    <section id="history" className="py-24 bg-slate-50 relative">
      <div
        className="absolute inset-0 opacity-[0.015]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='2.5' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-5xl md:text-6xl font-serif text-slate-900 mb-4">
            Our History
          </h2>
          <p className="text-xl text-slate-600 max-w-3xl mx-auto">
            Over a century of brotherhood, tradition, and service from 1904 to the present day
          </p>
        </motion.div>

        {loading ? (
          <div className="text-center text-slate-600">Loading history...</div>
        ) : (
          <>
            <div className="relative">
              <div className="hidden md:block absolute left-1/2 transform -translate-x-px h-full w-0.5 bg-amber-600/30"></div>

              {eras.map((era, index) => (
                <motion.div
                  key={era.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.15 }}
                  className={`relative mb-16 ${
                    index % 2 === 0 ? 'pr-8 md:pr-0 md:mr-auto md:w-1/2' : 'pl-8 md:pl-0 md:ml-auto md:w-1/2'
                  }`}
                >
                  <div className={`flex items-center mb-4 ${index % 2 === 1 ? 'md:justify-end' : ''}`}>
                    <div className="hidden md:flex absolute left-1/2 transform -translate-x-1/2 items-center justify-center">
                      <div className="w-12 h-12 bg-amber-600 rounded-full flex items-center justify-center shadow-lg">
                        <Calendar className="text-white" size={24} />
                      </div>
                    </div>
                    <div className={`${index % 2 === 0 ? 'md:mr-16' : 'md:ml-16'}`}>
                      <span className="inline-block bg-amber-600 text-white px-4 py-1 rounded-full text-sm font-semibold">
                        {era.year_start}
                        {era.year_end && era.year_end !== era.year_start && ` - ${era.year_end}`}
                      </span>
                    </div>
                  </div>

                  <div className={`${index % 2 === 0 ? 'md:mr-16' : 'md:ml-16'}`}>
                    <div className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-xl transition-shadow">
                      {era.image_url && (
                        <div className="h-48 overflow-hidden">
                          <img
                            src={getOptimizedAssetUrl(era.image_url)}
                            alt={era.title}
                            loading="lazy"
                            decoding="async"
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                      <div className="p-6">
                        <h3 className="text-2xl font-serif text-slate-900 mb-2">
                          {era.title}
                        </h3>
                        <p className="text-slate-600 mb-4">{era.summary}</p>
                        <Link
                          to={`/history/${era.slug}`}
                          className="inline-flex items-center space-x-2 text-amber-700 hover:text-amber-800 font-semibold"
                        >
                          <span>Learn More</span>
                          <ArrowRight size={16} />
                        </Link>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mt-16"
            >
              <Link
                to="/history"
                className="inline-flex items-center space-x-2 bg-amber-600 text-white px-8 py-3 rounded-md hover:bg-amber-700 transition-colors font-semibold"
              >
                <span>Explore Full Timeline</span>
                <ArrowRight size={20} />
              </Link>
            </motion.div>
          </>
        )}
      </div>
    </section>
  );
};
