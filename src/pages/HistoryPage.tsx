import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Calendar, ArrowLeft, Clock } from 'lucide-react';
import { motion } from 'framer-motion';
import { getOptimizedAssetUrl } from '../utils/assetUrls';

interface HistoryEra {
  id: string;
  title: string;
  year_start: number;
  year_end: number | null;
  slug: string;
  summary: string;
  content: string;
  image_url: string | null;
  display_order: number;
}

interface Milestone {
  id: string;
  title: string;
  date: string;
  description: string;
  image_url: string | null;
}

export const HistoryPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const [era, setEra] = useState<HistoryEra | null>(null);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [allEras, setAllEras] = useState<HistoryEra[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHistoryData();
  }, [slug]);

  const fetchHistoryData = async () => {
    setLoading(true);

    const { data: erasData } = await supabase
      .from('history_eras')
      .select('*')
      .order('display_order');

    if (erasData) {
      setAllEras(erasData);

      if (slug) {
        const currentEra = erasData.find((e) => e.slug === slug);
        if (currentEra) {
          setEra(currentEra);

          const { data: milestonesData } = await supabase
            .from('history_milestones')
            .select('*')
            .eq('era_id', currentEra.id)
            .order('date');

          if (milestonesData) {
            setMilestones(milestonesData);
          }
        }
      } else {
        setEra(null);
      }
    }

    setLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen pt-20 bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-amber-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600">Loading history...</p>
        </div>
      </div>
    );
  }

  if (slug && !era) {
    return (
      <div className="min-h-screen pt-20 bg-slate-50">
        <div className="max-w-4xl mx-auto px-4 py-16 text-center">
          <h1 className="text-3xl font-serif text-slate-900 mb-4">Era Not Found</h1>
          <Link
            to="/history"
            className="inline-flex items-center space-x-2 text-amber-700 hover:text-amber-800"
          >
            <ArrowLeft size={20} />
            <span>Back to Timeline</span>
          </Link>
        </div>
      </div>
    );
  }

  if (!slug) {
    return (
      <div className="min-h-screen pt-20 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-16"
          >
            <h1 className="text-5xl font-serif text-slate-900 mb-4">
              Our History
            </h1>
            <p className="text-xl text-slate-600 max-w-3xl mx-auto">
              Explore over a century of Masonic tradition in the Carp Valley,
              from the founding of Carleton Lodge in 1904 to the present day.
            </p>
          </motion.div>

          <div className="relative">
            <div className="absolute left-1/2 transform -translate-x-px h-full w-0.5 bg-amber-600/30"></div>

            {allEras.map((era, index) => (
              <motion.div
                key={era.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className={`relative mb-16 ${
                  index % 2 === 0 ? 'pr-8 md:pr-0 md:mr-auto md:w-1/2' : 'pl-8 md:pl-0 md:ml-auto md:w-1/2'
                }`}
              >
                <div className={`flex items-center mb-4 ${index % 2 === 1 ? 'md:justify-end' : ''}`}>
                  <div className="absolute left-1/2 transform -translate-x-1/2 flex items-center justify-center">
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

                <Link
                  to={`/history/${era.slug}`}
                  className={`block group ${index % 2 === 0 ? 'md:mr-16' : 'md:ml-16'}`}
                >
                  <div className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-xl transition-shadow">
                    {era.image_url && (
                      <div className="h-48 overflow-hidden">
                        <img
                          src={getOptimizedAssetUrl(era.image_url)}
                          alt={era.title}
                          loading="lazy"
                          decoding="async"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      </div>
                    )}
                    <div className="p-6">
                      <h3 className="text-2xl font-serif text-slate-900 mb-2 group-hover:text-amber-700 transition-colors">
                        {era.title}
                      </h3>
                      <p className="text-slate-600 mb-4">{era.summary}</p>
                      <span className="text-amber-700 group-hover:text-amber-800 font-semibold">
                        Read More →
                      </span>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!era) return null;

  return (
    <div className="min-h-screen pt-20 bg-slate-50">
      <div
        className="h-96 bg-cover bg-center relative"
        style={{
          backgroundImage: era.image_url
            ? `url(${getOptimizedAssetUrl(era.image_url)})`
            : 'linear-gradient(135deg, #92400e 0%, #b45309 100%)',
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-slate-900/70 to-slate-900/50"></div>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center text-white max-w-4xl px-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-4"
            >
              <span className="inline-block bg-amber-600 px-4 py-2 rounded-full text-sm font-semibold">
                {era.year_start}
                {era.year_end && era.year_end !== era.year_start && ` - ${era.year_end}`}
              </span>
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-5xl md:text-6xl font-serif mb-4"
            >
              {era.title}
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-xl text-amber-100"
            >
              {era.summary}
            </motion.p>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-16">
        <Link
          to="/history"
          className="inline-flex items-center space-x-2 text-amber-700 hover:text-amber-800 mb-8"
        >
          <ArrowLeft size={20} />
          <span>Back to Timeline</span>
        </Link>

        <div className="bg-white rounded-lg shadow-md p-8 mb-12">
          <div className="prose prose-lg max-w-none">
            {era.content.split('\n\n').map((paragraph, index) => (
              <p key={index} className="text-slate-700 leading-relaxed mb-4">
                {paragraph}
              </p>
            ))}
          </div>
        </div>

        {milestones.length > 0 && (
          <div className="bg-white rounded-lg shadow-md p-8">
            <h2 className="text-3xl font-serif text-slate-900 mb-8 flex items-center">
              <Clock className="mr-3 text-amber-700" size={32} />
              Key Milestones
            </h2>
            <div className="space-y-6">
              {milestones.map((milestone) => (
                <motion.div
                  key={milestone.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="border-l-4 border-amber-600 pl-6 py-2"
                >
                  <div className="flex items-baseline justify-between mb-2">
                    <h3 className="text-xl font-semibold text-slate-900">
                      {milestone.title}
                    </h3>
                    <span className="text-sm text-slate-500">
                      {new Date(milestone.date).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </span>
                  </div>
                  <p className="text-slate-600">{milestone.description}</p>
                  {milestone.image_url && (
                    <img
                      src={getOptimizedAssetUrl(milestone.image_url)}
                      alt={milestone.title}
                      loading="lazy"
                      decoding="async"
                      className="mt-4 rounded-lg shadow-md max-w-md"
                    />
                  )}
                </motion.div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-12 flex justify-between items-center">
          {allEras.map((e, index) => {
            if (e.id === era.id) {
              const prevEra = index > 0 ? allEras[index - 1] : null;
              const nextEra = index < allEras.length - 1 ? allEras[index + 1] : null;

              return (
                <div key={e.id} className="flex justify-between w-full">
                  {prevEra ? (
                    <Link
                      to={`/history/${prevEra.slug}`}
                      className="group flex items-center space-x-2 text-amber-700 hover:text-amber-800"
                    >
                      <ArrowLeft size={20} />
                      <div>
                        <div className="text-sm text-slate-500">Previous Era</div>
                        <div className="font-semibold">{prevEra.title}</div>
                      </div>
                    </Link>
                  ) : (
                    <div></div>
                  )}

                  {nextEra ? (
                    <Link
                      to={`/history/${nextEra.slug}`}
                      className="group flex items-center space-x-2 text-amber-700 hover:text-amber-800 text-right"
                    >
                      <div>
                        <div className="text-sm text-slate-500">Next Era</div>
                        <div className="font-semibold">{nextEra.title}</div>
                      </div>
                      <ArrowLeft size={20} className="rotate-180" />
                    </Link>
                  ) : (
                    <div></div>
                  )}
                </div>
              );
            }
            return null;
          })}
        </div>
      </div>
    </div>
  );
};
