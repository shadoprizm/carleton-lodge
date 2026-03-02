import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Download, ExternalLink, FileText, Loader2, AlertCircle, FileSpreadsheet, FileType } from 'lucide-react';
import { supabase, DocumentWithCategory } from '../lib/supabase';

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
const PDF_TYPE = 'application/pdf';
const TEXT_TYPE = 'text/plain';
const OFFICE_TYPES = [
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

function isImage(mimeType: string | null) {
  return IMAGE_TYPES.includes(mimeType ?? '');
}

function isPdf(mimeType: string | null) {
  return mimeType === PDF_TYPE;
}

function isText(mimeType: string | null) {
  return mimeType === TEXT_TYPE;
}

function isOffice(mimeType: string | null) {
  return OFFICE_TYPES.includes(mimeType ?? '');
}

interface Props {
  doc: DocumentWithCategory | null;
  onClose: () => void;
  onDownload: (doc: DocumentWithCategory) => void;
}

export const DocumentPreviewModal = ({ doc, onClose, onDownload }: Props) => {
  const [displayUrl, setDisplayUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [textContent, setTextContent] = useState<string | null>(null);
  const blobUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!doc) return;
    
    // Clean up previous blob URL
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
    
    setDisplayUrl(null);
    setError(false);
    setIframeLoaded(false);
    setTextContent(null);
    setLoading(true);

    const bucket = doc.storage_bucket || 'lodge-documents';
    
    // Fetch file through proxy to hide Supabase URL
    const fetchFile = async () => {
      try {
        const { data: signedData, error: signedError } = await supabase.storage
          .from(bucket)
          .createSignedUrl(doc.file_url, 60);
        
        if (signedError || !signedData?.signedUrl) {
          setError(true);
          setLoading(false);
          return;
        }

        // Fetch the actual file content
        const response = await fetch(signedData.signedUrl);
        if (!response.ok) throw new Error('Failed to fetch file');
        
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        blobUrlRef.current = blobUrl;
        setDisplayUrl(blobUrl);
        
        // For text files, also extract the content
        if (isText(doc.file_type)) {
          try {
            const text = await blob.text();
            setTextContent(text);
          } catch {
            // fallback to iframe
          }
        }
        
        setLoading(false);
      } catch (err) {
        console.error('Error fetching file:', err);
        setError(true);
        setLoading(false);
      }
    };

    fetchFile();
    
    // Cleanup on unmount or when doc changes
    return () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, [doc?.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <AnimatePresence>
      {doc && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />

          <motion.div
            className="relative z-10 bg-white rounded-2xl shadow-2xl flex flex-col w-full max-w-5xl"
            style={{ maxHeight: 'calc(100vh - 2rem)' }}
            initial={{ scale: 0.95, opacity: 0, y: 16 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 16 }}
            transition={{ duration: 0.2 }}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 flex-shrink-0">
              <div className="flex items-center space-x-3 min-w-0">
                <FileText size={20} className="text-slate-400 flex-shrink-0" />
                <div className="min-w-0">
                  <h2 className="font-semibold text-slate-900 truncate text-sm leading-tight">
                    {doc.title}
                  </h2>
                  {doc.description && (
                    <p className="text-xs text-slate-500 truncate mt-0.5">
                      {doc.description}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center space-x-2 ml-4 flex-shrink-0">
                {displayUrl && (
                  <a
                    href={displayUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    <ExternalLink size={13} />
                    <span>Open</span>
                  </a>
                )}
                <button
                  onClick={() => onDownload(doc)}
                  className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors"
                >
                  <Download size={13} />
                  <span>Download</span>
                </button>
                <button
                  onClick={onClose}
                  className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-hidden rounded-b-2xl bg-slate-50 min-h-0" style={{ minHeight: '60vh' }}>
              {loading && (
                <div className="flex flex-col items-center justify-center h-full py-20 text-slate-400">
                  <Loader2 size={32} className="animate-spin mb-3" />
                  <span className="text-sm">Loading preview...</span>
                </div>
              )}

              {!loading && error && (
                <div className="flex flex-col items-center justify-center h-full py-20 text-slate-400">
                  <AlertCircle size={32} className="mb-3 text-slate-300" />
                  <p className="text-sm font-medium text-slate-500">Unable to load preview</p>
                  <button
                    onClick={() => onDownload(doc)}
                    className="mt-4 flex items-center space-x-1.5 px-4 py-2 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors"
                  >
                    <Download size={14} />
                    <span>Download instead</span>
                  </button>
                </div>
              )}

              {!loading && !error && displayUrl && (
                <>
                  {isImage(doc.file_type) ? (
                    <div className="flex items-center justify-center h-full p-6 overflow-auto">
                      <img
                        src={displayUrl}
                        alt={doc.title}
                        className="max-w-full max-h-full object-contain rounded-lg shadow-md"
                      />
                    </div>
                  ) : isPdf(doc.file_type) ? (
                    <div className="relative h-full" style={{ minHeight: '60vh' }}>
                      {!iframeLoaded && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 bg-slate-50 z-10">
                          <Loader2 size={32} className="animate-spin mb-3" />
                          <span className="text-sm">Loading PDF...</span>
                        </div>
                      )}
                      <iframe
                        src={displayUrl}
                        title={doc.title}
                        className="w-full h-full rounded-b-2xl border-0"
                        style={{ minHeight: '60vh' }}
                        onLoad={() => setIframeLoaded(true)}
                      />
                    </div>
                  ) : isText(doc.file_type) && textContent !== null ? (
                    <div className="h-full overflow-auto p-6">
                      <pre className="text-sm text-slate-700 font-mono whitespace-pre-wrap leading-relaxed bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                        {textContent}
                      </pre>
                    </div>
                  ) : isOffice(doc.file_type) ? (
                    <div className="flex flex-col items-center justify-center h-full py-16 px-6 text-slate-400">
                      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 max-w-sm w-full text-center">
                        {doc.file_type?.includes('spreadsheet') || doc.file_type?.includes('excel') ? (
                          <FileSpreadsheet size={44} className="mx-auto mb-4 text-green-400" />
                        ) : (
                          <FileType size={44} className="mx-auto mb-4 text-blue-400" />
                        )}
                        <p className="text-sm font-semibold text-slate-700 mb-1">
                          Office documents cannot be previewed inline
                        </p>
                        <p className="text-xs text-slate-400 mb-5 leading-relaxed">
                          Open the file in a new tab to view it, or download it to your device.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-2 justify-center">
                          <a
                            href={displayUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-center space-x-1.5 px-4 py-2 text-sm font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                          >
                            <ExternalLink size={14} />
                            <span>Open in new tab</span>
                          </a>
                          <button
                            onClick={() => onDownload(doc)}
                            className="flex items-center justify-center space-x-1.5 px-4 py-2 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors"
                          >
                            <Download size={14} />
                            <span>Download</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full py-20 text-slate-400">
                      <FileText size={40} className="mb-3 text-slate-300" />
                      <p className="text-sm font-medium text-slate-500">
                        Preview not available for this file type
                      </p>
                      <p className="text-xs text-slate-400 mt-1 mb-4">
                        Download the file to view it on your device
                      </p>
                      <button
                        onClick={() => onDownload(doc)}
                        className="flex items-center space-x-1.5 px-4 py-2 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors"
                      >
                        <Download size={14} />
                        <span>Download</span>
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
