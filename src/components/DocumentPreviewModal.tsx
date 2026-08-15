import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Download, ExternalLink, FileText, Loader2, AlertCircle } from 'lucide-react';
import { supabase, DocumentWithCategory } from '../lib/supabase';
import {
  buildOfficeViewerUrl,
  getDocumentFormat,
  isOfficeDocument,
} from '../lib/documentFiles';

const STANDARD_PREVIEW_URL_LIFETIME_SECONDS = 60;

type OfficePreviewResponse = {
  previewUrl?: string;
};

function enableCredentiallessIframe(frame: HTMLIFrameElement | null) {
  frame?.setAttribute('credentialless', '');
}

interface Props {
  doc: DocumentWithCategory | null;
  localFile?: File | null;
  onClose: () => void;
  onDownload?: (doc: DocumentWithCategory) => void;
}

export const DocumentPreviewModal = ({ doc, localFile = null, onClose, onDownload }: Props) => {
  const [displayUrl, setDisplayUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [textContent, setTextContent] = useState<string | null>(null);
  const previewTitle = doc?.title ?? localFile?.name ?? 'Document preview';
  const previewDescription = doc?.description ?? null;
  const previewFormat = getDocumentFormat(
    doc?.file_name ?? localFile?.name ?? '',
    doc?.file_type ?? localFile?.type ?? null,
  );
  const officeDocument = isOfficeDocument(previewFormat);
  const embeddedOfficePreview = Boolean(doc && officeDocument && !localFile);

  useEffect(() => {
    if (!doc && !localFile) return;

    let disposed = false;
    let objectUrl: string | null = null;
    const abortController = new AbortController();

    setDisplayUrl(null);
    setError(false);
    setIframeLoaded(false);
    setTextContent(null);
    setLoading(true);

    const setPreviewBlob = async (blob: Blob) => {
      objectUrl = URL.createObjectURL(blob);
      if (disposed) {
        URL.revokeObjectURL(objectUrl);
        objectUrl = null;
        return;
      }

      setDisplayUrl(objectUrl);
      if (previewFormat === 'text') {
        try {
          const text = await blob.text();
          if (!disposed) setTextContent(text);
        } catch {
          // The browser can still offer the file for opening or download.
        }
      }
      if (!disposed) setLoading(false);
    };

    const fetchFile = async () => {
      try {
        if (localFile) {
          await setPreviewBlob(localFile);
          return;
        }

        if (!doc) return;

        // Microsoft's viewer has a practical limit on source URL length. The
        // Edge Function exchanges the member's authenticated request for a
        // compact, signed, 15-minute proxy URL instead of exposing the much
        // longer private-storage URL in the viewer query string.
        if (officeDocument) {
          const { data, error: previewError } = await supabase.functions.invoke<OfficePreviewResponse>(
            'office-document-preview',
            { body: { documentId: doc.id } },
          );

          if (previewError || !data?.previewUrl) {
            if (!disposed) {
              setError(true);
              setLoading(false);
            }
            return;
          }

          if (!disposed) {
            setDisplayUrl(buildOfficeViewerUrl(data.previewUrl));
            setLoading(false);
          }
          return;
        }

        const bucket = doc.storage_bucket || 'lodge-documents';
        const { data: signedData, error: signedError } = await supabase.storage
          .from(bucket)
          .createSignedUrl(doc.file_url, STANDARD_PREVIEW_URL_LIFETIME_SECONDS);

        if (signedError || !signedData?.signedUrl) {
          if (!disposed) {
            setError(true);
            setLoading(false);
          }
          return;
        }

        const response = await fetch(signedData.signedUrl, { signal: abortController.signal });
        if (!response.ok) throw new Error('Failed to fetch file');

        await setPreviewBlob(await response.blob());
      } catch (err) {
        if (disposed || (err instanceof DOMException && err.name === 'AbortError')) return;
        console.error('Error fetching file:', err);
        setError(true);
        setLoading(false);
      }
    };

    void fetchFile();

    return () => {
      disposed = true;
      abortController.abort();
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
        objectUrl = null;
      }
    };
  }, [doc, localFile, officeDocument, previewFormat]);

  useEffect(() => {
    if (!doc && !localFile) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [doc, localFile, onClose]);

  const handleDownload = () => {
    if (doc && onDownload) {
      onDownload(doc);
      return;
    }
    if (!displayUrl) return;

    const link = document.createElement('a');
    link.href = displayUrl;
    link.download = doc?.file_name ?? localFile?.name ?? 'document';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const canDownload = Boolean((doc && onDownload) || displayUrl);

  return (
    <AnimatePresence>
      {(doc || localFile) && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`Preview ${previewTitle}`}
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
                    {previewTitle}
                  </h2>
                  {previewDescription && (
                    <p className="text-xs text-slate-500 truncate mt-0.5">
                      {previewDescription}
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
                {canDownload ? (
                  <button
                    onClick={handleDownload}
                    className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors"
                  >
                    <Download size={13} />
                    <span>Download</span>
                  </button>
                ) : null}
                <button
                  onClick={onClose}
                  aria-label="Close preview"
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
                  {canDownload ? (
                    <button
                      onClick={handleDownload}
                      className="mt-4 flex items-center space-x-1.5 px-4 py-2 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors"
                    >
                      <Download size={14} />
                      <span>Download instead</span>
                    </button>
                  ) : null}
                </div>
              )}

              {!loading && !error && displayUrl && (
                <>
                  {previewFormat === 'image' ? (
                    <div className="flex items-center justify-center h-full p-6 overflow-auto">
                      <img
                        src={displayUrl}
                        alt={previewTitle}
                        className="max-w-full max-h-full object-contain rounded-lg shadow-md"
                      />
                    </div>
                  ) : previewFormat === 'pdf' ? (
                    <div className="relative h-full" style={{ minHeight: '60vh' }}>
                      {!iframeLoaded && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 bg-slate-50 z-10">
                          <Loader2 size={32} className="animate-spin mb-3" />
                          <span className="text-sm">Loading PDF...</span>
                        </div>
                      )}
                      <iframe
                        src={displayUrl}
                        title={previewTitle}
                        className="w-full h-full rounded-b-2xl border-0"
                        style={{ minHeight: '60vh' }}
                        onLoad={() => setIframeLoaded(true)}
                        onError={() => setError(true)}
                      />
                    </div>
                  ) : previewFormat === 'text' && textContent !== null ? (
                    <div className="h-full overflow-auto p-6">
                      <pre className="text-sm text-slate-700 font-mono whitespace-pre-wrap leading-relaxed bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                        {textContent}
                      </pre>
                    </div>
                  ) : embeddedOfficePreview ? (
                    <div className="flex h-full min-h-[60vh] flex-col bg-white">
                      <div className="relative min-h-0 flex-1">
                        {!iframeLoaded && (
                          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-50 text-slate-400">
                            <Loader2 size={32} className="mb-3 animate-spin" />
                            <span className="text-sm">Loading Office preview...</span>
                          </div>
                        )}
                        <iframe
                          src={displayUrl}
                          title={`${previewTitle} preview`}
                          className="h-full w-full border-0"
                          style={{ minHeight: '56vh' }}
                          referrerPolicy="no-referrer"
                          ref={enableCredentiallessIframe}
                          onLoad={() => setIframeLoaded(true)}
                          onError={() => setError(true)}
                        />
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-slate-50 px-4 py-2 text-xs text-slate-500">
                        <span>Office previews are rendered by Microsoft using a temporary view-only link.</span>
                        {canDownload ? (
                          <button
                            onClick={handleDownload}
                            className="font-medium text-slate-700 hover:text-slate-900"
                          >
                            Preview not loading? Download the file
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ) : officeDocument ? (
                    <div className="flex flex-col items-center justify-center h-full py-16 px-6 text-slate-400">
                      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 max-w-sm w-full text-center">
                        <FileText size={44} className="mx-auto mb-4 text-blue-400" />
                        <p className="text-sm font-semibold text-slate-700 mb-1">
                          Upload this file to enable its Office preview
                        </p>
                        <p className="text-xs text-slate-400 mb-5 leading-relaxed">
                          Microsoft&apos;s viewer needs a temporary link to the stored file. You can still open the selected file locally before uploading.
                        </p>
                        <a
                          href={displayUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center space-x-1.5 px-4 py-2 text-sm font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                        >
                          <ExternalLink size={14} />
                          <span>Open selected file</span>
                        </a>
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
                      {canDownload ? (
                        <button
                          onClick={handleDownload}
                          className="flex items-center space-x-1.5 px-4 py-2 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors"
                        >
                          <Download size={14} />
                          <span>Download</span>
                        </button>
                      ) : null}
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
