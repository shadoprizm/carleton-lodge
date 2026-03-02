import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, ExternalLink, Calendar, ChevronDown, ChevronUp, Scroll, Loader2 } from 'lucide-react';
import { supabase, Summons as SummonsType } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

const BUCKET = 'summons-uploads';
const SUPABASE_STORAGE_PREFIX = '/storage/v1/object/public/summons-uploads/';

function extractStoragePath(pdfUrl: string): string {
  if (!pdfUrl.startsWith('http')) return pdfUrl;
  const idx = pdfUrl.indexOf(SUPABASE_STORAGE_PREFIX);
  if (idx !== -1) return pdfUrl.slice(idx + SUPABASE_STORAGE_PREFIX.length);
  return pdfUrl;
}

const renderContent = (content: string) => {
  const paragraphs = content.split(/\n{2,}/);

  return paragraphs.map((para, i) => {
    const trimmed = para.trim();
    if (!trimmed) return null;

    const lines = trimmed.split('\n');

    const isHeading =
      lines.length === 1 &&
      trimmed.length < 80 &&
      (trimmed === trimmed.toUpperCase() ||
        /^(brethren|dear|lodge|worshipful|notice|agenda|business|greetings|salutation|order of|to all)/i.test(trimmed));

    const isListBlock = lines.every(l => /^[-•*]\s/.test(l.trim()) || /^\d+\.\s/.test(l.trim()));

    if (isHeading) {
      return (
        <h4 key={i} className="text-base font-semibold text-blue-900 uppercase tracking-wider mt-6 mb-2 first:mt-0">
          {trimmed}
        </h4>
      );
    }

    if (isListBlock) {
      return (
        <ul key={i} className="space-y-1 my-3 pl-4">
          {lines.map((line, j) => (
            <li key={j} className="flex items-start space-x-2 text-gray-700">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-blue-900 flex-shrink-0" />
              <span>{line.replace(/^[-•*]\s|^\d+\.\s/, '')}</span>
            </li>
          ))}
        </ul>
      );
    }

    return (
      <p key={i} className="text-gray-700 leading-relaxed my-3 first:mt-0">
        {lines.join(' ')}
      </p>
    );
  });
};

export const Summons = () => {
  const { user } = useAuth();
  const [summonsList, setSummonsList] = useState<SummonsType[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [openingPdf, setOpeningPdf] = useState<string | null>(null);
  const blobUrlRef = useRef<string | null>(null);

  // Cleanup blob URL on unmount
  useEffect(() => {
    return () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (user) fetchSummons();
  }, [user]);

  const fetchSummons = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('summons')
      .select('*')
      .order('published_at', { ascending: false });

    if (!error && data) {
      setSummonsList(data);
      if (data.length > 0) setExpandedId(data[0].id);
    }
    setLoading(false);
  };

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const openPdf = useCallback(async (e: React.MouseEvent, pdfUrl: string) => {
    e.stopPropagation();
    setOpeningPdf(pdfUrl);
    
    try {
      const path = extractStoragePath(pdfUrl);
      const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60);
      
      if (error || !data?.signedUrl) {
        setOpeningPdf(null);
        return;
      }

      // Fetch the PDF content to hide the Supabase URL
      const response = await fetch(data.signedUrl);
      if (!response.ok) {
        setOpeningPdf(null);
        return;
      }

      const blob = await response.blob();
      
      // Revoke previous blob URL if exists
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
      }
      
      const blobUrl = URL.createObjectURL(blob);
      blobUrlRef.current = blobUrl;
      
      // Open in new tab - URL will be blob:... not the Supabase URL
      window.open(blobUrl, '_blank', 'noopener,noreferrer');
    } catch (err) {
      console.error('Error opening PDF:', err);
    } finally {
      setOpeningPdf(null);
    }
  }, []);

  if (!user) return null;

  return (
    <section id="summons" className="py-20 bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <div className="flex items-center justify-center space-x-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-blue-900 flex items-center justify-center">
              <Scroll className="text-white" size={20} />
            </div>
            <h2 className="text-4xl font-serif text-gray-900">Monthly Summons</h2>
          </div>
          <p className="text-gray-500 max-w-2xl mx-auto">
            Official lodge communications and meeting notices for members
          </p>
        </motion.div>

        {loading ? (
          <div className="text-center py-16">
            <div className="inline-block w-8 h-8 border-2 border-blue-900 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : summonsList.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <FileText size={48} className="mx-auto mb-4 opacity-40" />
            <p>No summons have been posted yet.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {summonsList.map((summons, index) => {
              const isExpanded = expandedId === summons.id;
              return (
                <motion.div
                  key={summons.id}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: index * 0.08 }}
                  className={`bg-white rounded-xl border transition-all duration-200 ${
                    isExpanded ? 'border-blue-200 shadow-lg' : 'border-gray-200 shadow-sm hover:shadow-md'
                  }`}
                >
                  <button
                    onClick={() => toggleExpand(summons.id)}
                    className="w-full px-6 py-5 flex items-center justify-between text-left"
                  >
                    <div className="flex items-center space-x-4 flex-1 min-w-0">
                      <div className={`flex-shrink-0 w-12 h-12 rounded-lg flex items-center justify-center transition-colors ${
                        isExpanded ? 'bg-blue-900' : 'bg-blue-50'
                      }`}>
                        <FileText className={isExpanded ? 'text-white' : 'text-blue-900'} size={22} />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-lg font-serif text-gray-900 truncate">{summons.title}</h3>
                        <div className="flex items-center space-x-3 mt-0.5">
                          <span className="text-sm font-semibold text-blue-900">{summons.month}</span>
                          <span className="text-gray-300">·</span>
                          <span className="flex items-center text-sm text-gray-400">
                            <Calendar size={12} className="mr-1" />
                            {new Date(summons.published_at).toLocaleDateString('en-US', {
                              day: 'numeric', month: 'short', year: 'numeric'
                            })}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 ml-4 flex-shrink-0">
                      {summons.pdf_url && (
                        <button
                          onClick={(e) => openPdf(e, summons.pdf_url!)}
                          disabled={openingPdf === summons.pdf_url}
                          className="flex items-center space-x-1.5 px-3 py-1.5 text-sm font-medium text-blue-900 border border-blue-200 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors disabled:opacity-60"
                        >
                          {openingPdf === summons.pdf_url ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <ExternalLink size={14} />
                          )}
                          <span>View PDF</span>
                        </button>
                      )}
                      <div className="w-8 h-8 flex items-center justify-center text-gray-400">
                        {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                      </div>
                    </div>
                  </button>

                  <AnimatePresence initial={false}>
                    {isExpanded && (
                      <motion.div
                        key="content"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: 'easeInOut' }}
                        className="overflow-hidden"
                      >
                        <div className="border-t border-gray-100 px-6 py-6">
                          <div className="max-w-2xl">
                            {summons.content && (
                              <>
                                <p className="text-xs font-semibold tracking-widest uppercase text-blue-900 mb-4">Message from the East</p>
                                <div className="text-[15px] leading-[1.75]">
                                  {renderContent(summons.content)}
                                </div>
                              </>
                            )}

                            {summons.pdf_url && (
                              <div className={`${summons.content ? 'mt-8 pt-6 border-t border-gray-100' : ''}`}>
                                <button
                                  onClick={(e) => openPdf(e, summons.pdf_url!)}
                                  disabled={openingPdf === summons.pdf_url}
                                  className="inline-flex items-center space-x-2 px-5 py-2.5 bg-blue-900 text-white rounded-lg hover:bg-blue-800 transition-colors text-sm font-medium disabled:opacity-60"
                                >
                                  {openingPdf === summons.pdf_url ? (
                                    <Loader2 size={16} className="animate-spin" />
                                  ) : (
                                    <ExternalLink size={16} />
                                  )}
                                  <span>Open Full Summons (PDF)</span>
                                </button>
                                <p className="text-xs text-gray-400 mt-2">Opens in your browser — no download required</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};
