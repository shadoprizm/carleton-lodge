import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase, Summons } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { X, Plus, Edit2, Send, Upload, FileText, Loader2, AlertCircle, ExternalLink } from 'lucide-react';

const BUCKET = 'summons-uploads';
const SUPABASE_STORAGE_PREFIX = '/storage/v1/object/public/summons-uploads/';
const NOTICES_CATEGORY_ID = 'ddb0c537-2166-4587-8302-ec2346842615';

function extractStoragePath(pdfUrl: string): string {
  if (!pdfUrl.startsWith('http')) return pdfUrl;
  const idx = pdfUrl.indexOf(SUPABASE_STORAGE_PREFIX);
  if (idx !== -1) return pdfUrl.slice(idx + SUPABASE_STORAGE_PREFIX.length);
  return pdfUrl;
}

export const SummonsManager = () => {
  const { user } = useAuth();
  const [summonsList, setSummonsList] = useState<Summons[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingSummons, setEditingSummons] = useState<Summons | null>(null);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState({
    title: '',
    month: '',
    content: '',
    pdf_url: '',
  });

  useEffect(() => {
    fetchSummons();
  }, []);

  const fetchSummons = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('summons')
      .select('*')
      .order('published_at', { ascending: false });
    if (data) setSummonsList(data);
    setLoading(false);
  };

  const titleFromFilename = (filename: string): string => {
    const base = filename.replace(/\.[^.]+$/, '');
    return base.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).trim();
  };

  const monthFromFilename = (filename: string): string => {
    const months = ['january','february','march','april','may','june','july','august','september','october','november','december'];
    const lower = filename.toLowerCase();
    const yearMatch = lower.match(/\b(20\d{2})\b/);
    const year = yearMatch ? yearMatch[1] : new Date().getFullYear().toString();
    for (const m of months) {
      if (lower.includes(m)) {
        return m.replace(/\b\w/g, c => c.toUpperCase()) + ' ' + year;
      }
    }
    const twoDigitMonth = lower.match(/[-_](\d{2})[-_]/);
    if (twoDigitMonth) {
      const idx = parseInt(twoDigitMonth[1], 10) - 1;
      if (idx >= 0 && idx < 12) {
        return new Date(parseInt(year), idx, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      }
    }
    return new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  const handleFileSelect = async (file: File) => {
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setUploadError('Please upload a PDF file.');
      return;
    }

    setUploadedFile(file);
    setUploadError(null);
    setUploading(true);

    try {
      const title = titleFromFilename(file.name);
      const month = monthFromFilename(file.name);

      const safeName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const storagePath = `summons/${safeName}`;

      const { error: uploadErr } = await supabase.storage
        .from('summons-uploads')
        .upload(storagePath, file, { contentType: 'application/pdf', upsert: false });

      if (uploadErr) throw uploadErr;

      const pdfUrl = storagePath;

      let content = '';
      try {
        const fd = new FormData();
        fd.append('file', file);
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/parse-summons`;
          const res = await fetch(apiUrl, {
            method: 'POST',
            headers: { Authorization: `Bearer ${session.access_token}` },
            body: fd,
          });
          if (res.ok) {
            const parsed = await res.json();
            content = parsed.content || '';
          }
        }
      } catch {
        // parsing failed, leave content empty for manual entry
      }

      setFormData({ title, month, content, pdf_url: pdfUrl });
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const summonsData = {
      title: formData.title,
      month: formData.month,
      content: formData.content,
      pdf_url: formData.pdf_url || null,
      created_by: user?.id,
    };

    if (editingSummons) {
      await supabase.from('summons').update(summonsData).eq('id', editingSummons.id);
    } else {
      const { data } = await supabase.from('summons').insert(summonsData).select().single();
      if (data) {
        await sendNotifications(data.id);
        if (summonsData.pdf_url && uploadedFile) {
          await supabase.from('documents').insert({
            title: formData.title,
            description: formData.month || null,
            category_id: NOTICES_CATEGORY_ID,
            file_url: summonsData.pdf_url,
            file_name: uploadedFile.name,
            file_size: uploadedFile.size,
            file_type: 'application/pdf',
            storage_bucket: BUCKET,
            tags: ['summons', formData.month.toLowerCase()].filter(Boolean),
            uploaded_by: user?.id,
          });
        }
      }
    }

    setShowForm(false);
    setEditingSummons(null);
    resetForm();
    fetchSummons();
  };

  const sendNotifications = async (summonsId: string) => {
    setSending(true);
    try {
      await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-summons-notification`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ summonsId }),
      });
    } catch (error) {
      console.error('Error sending notifications:', error);
    }
    setSending(false);
  };

  const handleEdit = (summons: Summons) => {
    setEditingSummons(summons);
    setFormData({
      title: summons.title,
      month: summons.month,
      content: summons.content,
      pdf_url: summons.pdf_url || '',
    });
    setShowForm(true);
  };

  const handleDelete = async (summonsId: string) => {
    if (confirm('Are you sure you want to delete this summons?')) {
      await supabase.from('summons').delete().eq('id', summonsId);
      fetchSummons();
    }
  };

  const resetForm = () => {
    setFormData({ title: '', month: '', content: '', pdf_url: '' });
    setUploadedFile(null);
    setUploadError(null);
  };

  const openNewForm = () => {
    resetForm();
    setEditingSummons(null);
    setShowForm(true);
  };

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

  const isReady = !!(formData.title && formData.month);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-serif text-gray-900">Summons Management</h3>
        <button
          onClick={openNewForm}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-900 text-white rounded-md hover:bg-blue-800 transition-colors"
        >
          <Plus size={18} />
          <span>Post New Summons</span>
        </button>
      </div>

      {showForm && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <div className="flex justify-between items-center mb-6">
            <h4 className="text-lg font-serif text-gray-900">
              {editingSummons ? 'Edit Summons' : 'New Summons'}
            </h4>
            <button onClick={() => { setShowForm(false); resetForm(); }} className="text-gray-400 hover:text-gray-600">
              <X size={20} />
            </button>
          </div>

          {!editingSummons && !uploadedFile && (
            <div className="mb-6">
              {uploading ? (
                <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-blue-300 rounded-lg bg-blue-50">
                  <Loader2 size={36} className="text-blue-900 animate-spin mb-3" />
                  <p className="text-blue-900 font-medium">Uploading PDF...</p>
                </div>
              ) : (
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`cursor-pointer flex flex-col items-center justify-center py-12 border-2 border-dashed rounded-lg transition-colors ${
                    dragOver
                      ? 'border-blue-900 bg-blue-50'
                      : 'border-gray-300 bg-white hover:border-blue-400 hover:bg-gray-50'
                  }`}
                >
                  <Upload size={36} className="text-gray-400 mb-3" />
                  <p className="text-gray-700 font-medium">Drop your PDF here or click to browse</p>
                  <p className="text-sm text-gray-500 mt-1">PDF files only</p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,application/pdf"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileSelect(file);
                    }}
                  />
                </div>
              )}

              {uploadError && (
                <div className="mt-3 flex items-start space-x-2 text-red-600 bg-red-50 border border-red-200 rounded-md p-3">
                  <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                  <p className="text-sm">{uploadError}</p>
                </div>
              )}
            </div>
          )}

          {(uploadedFile || editingSummons) && (
            <form onSubmit={handleSubmit} className="space-y-4">
              {uploadedFile && !editingSummons && (
                <div className="flex items-center space-x-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-md px-3 py-2">
                  <FileText size={14} />
                  <span>Uploaded: <strong>{uploadedFile.name}</strong></span>
                  {formData.pdf_url && (
                    <button
                      type="button"
                      onClick={(e) => openPdf(e, formData.pdf_url)}
                      disabled={openingPdf === formData.pdf_url}
                      className="ml-auto flex items-center space-x-1 text-blue-700 hover:text-blue-900 disabled:opacity-60"
                    >
                      {openingPdf === formData.pdf_url ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : (
                        <ExternalLink size={13} />
                      )}
                      <span>Preview</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => { setUploadedFile(null); setFormData({ title: '', month: '', content: '', pdf_url: '' }); }}
                    className="ml-2 text-gray-400 hover:text-gray-600"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="e.g., Monthly Summons — March 2026"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-900 focus:border-blue-900"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Month / Year</label>
                  <input
                    type="text"
                    required
                    value={formData.month}
                    onChange={(e) => setFormData({ ...formData, month: e.target.value })}
                    placeholder="e.g., March 2026"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-900 focus:border-blue-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Message from the East
                  <span className="ml-1 text-gray-400 font-normal">(optional — visible to members)</span>
                </label>
                <textarea
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  rows={10}
                  placeholder="Enter the message from the East here..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-900 focus:border-blue-900 font-mono text-sm"
                />
              </div>

              {editingSummons && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    PDF URL <span className="text-gray-400 font-normal">(optional)</span>
                  </label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="url"
                      value={formData.pdf_url}
                      onChange={(e) => setFormData({ ...formData, pdf_url: e.target.value })}
                      placeholder="https://..."
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-900 focus:border-blue-900"
                    />
                    {formData.pdf_url && (
                      <button
                        type="button"
                        onClick={(e) => openPdf(e, formData.pdf_url)}
                        disabled={openingPdf === formData.pdf_url}
                        className="flex items-center space-x-1 px-3 py-2 text-sm text-blue-900 border border-blue-200 rounded-md hover:bg-blue-50 disabled:opacity-60"
                      >
                        {openingPdf === formData.pdf_url ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <ExternalLink size={14} />
                        )}
                        <span>Open</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => { setShowForm(false); resetForm(); }}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={sending || !isReady}
                  className="flex items-center space-x-2 px-6 py-2 bg-blue-900 text-white rounded-md hover:bg-blue-800 transition-colors disabled:opacity-60"
                >
                  {sending ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      <span>Notifying members...</span>
                    </>
                  ) : editingSummons ? (
                    <span>Update Summons</span>
                  ) : (
                    <>
                      <Send size={18} />
                      <span>Publish & Notify</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {loading ? (
        <div className="text-center py-8 text-gray-600">Loading summons...</div>
      ) : (
        <div className="space-y-4">
          {summonsList.map(summons => (
            <div
              key={summons.id}
              className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1 min-w-0">
                  <h4 className="text-lg font-serif text-gray-900">{summons.title}</h4>
                  <div className="flex items-center space-x-4 mt-1 text-sm text-gray-600">
                    <span className="font-medium text-blue-900">{summons.month}</span>
                    <span>Published: {new Date(summons.published_at).toLocaleDateString()}</span>
                    {summons.pdf_url && (
                      <button
                        onClick={(e) => openPdf(e, summons.pdf_url!)}
                        disabled={openingPdf === summons.pdf_url}
                        className="flex items-center space-x-1 text-blue-700 hover:text-blue-900 disabled:opacity-60"
                      >
                        {openingPdf === summons.pdf_url ? (
                          <Loader2 size={13} className="animate-spin" />
                        ) : (
                          <ExternalLink size={13} />
                        )}
                        <span>View PDF</span>
                      </button>
                    )}
                  </div>
                  {summons.content && (
                    <p className="text-sm text-gray-600 mt-2 line-clamp-2">{summons.content}</p>
                  )}
                </div>
                <div className="flex items-center space-x-2 ml-4">
                  <button
                    onClick={() => handleEdit(summons)}
                    className="text-blue-900 hover:text-blue-700 p-2"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    onClick={() => handleDelete(summons.id)}
                    className="text-red-600 hover:text-red-800 text-sm font-medium px-2 py-1"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
          {summonsList.length === 0 && (
            <div className="text-center py-8 text-gray-500">No summons posted yet.</div>
          )}
        </div>
      )}
    </div>
  );
};
