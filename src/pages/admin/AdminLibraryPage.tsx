import { useState, useEffect, useRef } from 'react';
import {
  Trash2, Edit2, Upload, FileText, X, Loader2, FolderPlus,
  Tag, ChevronDown, ChevronRight, Folder, FolderOpen, AlertCircle,
  Files, CheckCircle2
} from 'lucide-react';
import { supabase, DocumentCategory, DocumentWithCategory } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

const DOCUMENTS_BUCKET = 'lodge-documents';
const BULK_INTAKE_CATEGORY_NAME = 'Needs Sorting';

function documentTitleFromFilename(filename: string): string {
  return filename.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ').trim();
}

export const AdminLibraryPage = () => {
  const { user, hasAdminPermission } = useAuth();
  const canWrite = hasAdminPermission('library', 'write');
  const [categories, setCategories] = useState<DocumentCategory[]>([]);
  const [documents, setDocuments] = useState<DocumentWithCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'documents' | 'categories'>('documents');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  const [showDocForm, setShowDocForm] = useState(false);
  const [editingDoc, setEditingDoc] = useState<DocumentWithCategory | null>(null);
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [showCatForm, setShowCatForm] = useState(false);
  const [editingCat, setEditingCat] = useState<DocumentCategory | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const [catRes, docRes] = await Promise.all([
      supabase.from('document_categories').select('*').order('display_order'),
      supabase
        .from('documents')
        .select('*, document_categories(*)')
        .order('created_at', { ascending: false }),
    ]);
    if (catRes.data) {
      setCategories(catRes.data);
      setExpandedCategories(new Set(catRes.data.map((c) => c.id)));
    }
    if (docRes.data) setDocuments(docRes.data as DocumentWithCategory[]);
    setLoading(false);
  };

  const toggleCategory = (id: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const deleteDocument = async (doc: DocumentWithCategory) => {
    if (!confirm(`Delete "${doc.title}"?`)) return;
    if (!doc.source_mailroom_import_id) {
      const bucket = doc.storage_bucket || DOCUMENTS_BUCKET;
      await supabase.storage.from(bucket).remove([doc.file_url]);
    }
    await supabase.from('documents').delete().eq('id', doc.id);
    fetchData();
  };

  const deleteCategory = async (cat: DocumentCategory) => {
    if (!confirm(`Delete category "${cat.name}"? Documents in it will become uncategorised.`)) return;
    await supabase.from('document_categories').delete().eq('id', cat.id);
    fetchData();
  };

  const docsByCategory = categories.reduce<Record<string, DocumentWithCategory[]>>((acc, cat) => {
    acc[cat.id] = documents.filter((d) => d.category_id === cat.id);
    return acc;
  }, {});
  const uncategorised = documents.filter((d) => !d.category_id);

  return (
    <div>
      <div className="flex justify-between items-start mb-6">
        <div>
          <h2 className="text-xl font-serif text-slate-900">Document Library</h2>
          <p className="text-sm text-slate-500 mt-1">Upload and organise lodge documents</p>
        </div>
        {canWrite ? <div className="flex items-center space-x-2">
          <button
            onClick={() => { setEditingCat(null); setShowCatForm(true); setShowDocForm(false); setShowBulkUpload(false); setActiveTab('categories'); }}
            className="flex items-center space-x-2 px-3 py-2 border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
          >
            <FolderPlus size={15} />
            <span>Add Category</span>
          </button>
          <button
            onClick={() => { setShowBulkUpload(true); setShowDocForm(false); setShowCatForm(false); setEditingDoc(null); setActiveTab('documents'); }}
            className="flex items-center space-x-2 px-3 py-2 border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
          >
            <Files size={15} />
            <span>Bulk Upload</span>
          </button>
          <button
            onClick={() => { setEditingDoc(null); setShowDocForm(true); setShowBulkUpload(false); setShowCatForm(false); setActiveTab('documents'); }}
            className="flex items-center space-x-2 px-4 py-2 bg-slate-900 text-amber-300 rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors"
          >
            <Upload size={15} />
            <span>Upload Document</span>
          </button>
        </div> : (
          <span className="text-xs font-medium text-slate-500 bg-slate-100 border border-slate-200 rounded-full px-3 py-1">
            Read only
          </span>
        )}
      </div>

      <div className="flex border-b border-slate-200 mb-6">
        {(['documents', 'categories'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium capitalize border-b-2 transition-colors ${
              activeTab === tab
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab}
            <span className="ml-2 text-xs px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600">
              {tab === 'documents' ? documents.length : categories.length}
            </span>
          </button>
        ))}
      </div>

      {canWrite && showDocForm && (
        <DocumentForm
          categories={categories}
          editingDoc={editingDoc}
          userId={user?.id ?? null}
          onDone={() => { setShowDocForm(false); setEditingDoc(null); fetchData(); }}
          onCancel={() => { setShowDocForm(false); setEditingDoc(null); }}
        />
      )}

      {canWrite && showBulkUpload && (
        <BulkUploadForm
          categories={categories}
          defaultCategoryId={categories.find((cat) => cat.name === BULK_INTAKE_CATEGORY_NAME)?.id ?? ''}
          userId={user?.id ?? null}
          onDone={() => { setShowBulkUpload(false); fetchData(); }}
          onCancel={() => setShowBulkUpload(false)}
        />
      )}

      {canWrite && showCatForm && (
        <CategoryForm
          editingCat={editingCat}
          onDone={() => { setShowCatForm(false); setEditingCat(null); fetchData(); }}
          onCancel={() => { setShowCatForm(false); setEditingCat(null); }}
        />
      )}

      {loading ? (
        <div className="text-center py-12 text-slate-500">Loading...</div>
      ) : activeTab === 'documents' ? (
        <div className="space-y-3">
          {categories.map((cat) => {
            const catDocs = docsByCategory[cat.id] || [];
            const isExpanded = expandedCategories.has(cat.id);
            return (
              <div key={cat.id} className="border border-slate-200 rounded-xl overflow-hidden">
                <button
                  onClick={() => toggleCategory(cat.id)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors"
                >
                  <div className="flex items-center space-x-2">
                    {isExpanded ? <FolderOpen size={17} className="text-amber-500" /> : <Folder size={17} className="text-slate-400" />}
                    <span className="font-semibold text-sm text-slate-800">{cat.name}</span>
                    <span className="text-xs text-slate-400 bg-white px-2 py-0.5 rounded-full border border-slate-200">{catDocs.length}</span>
                  </div>
                  {isExpanded ? <ChevronDown size={15} className="text-slate-400" /> : <ChevronRight size={15} className="text-slate-400" />}
                </button>
                {isExpanded && (
                  <div className="divide-y divide-slate-100">
                    {catDocs.length === 0 ? (
                      <div className="px-4 py-4 text-sm text-slate-400 italic">No documents in this category.</div>
                    ) : (
                      catDocs.map((doc) => (
                        <AdminDocRow
                          key={doc.id}
                          doc={doc}
                          canWrite={canWrite}
                          onEdit={() => { setEditingDoc(doc); setShowDocForm(true); setShowBulkUpload(false); }}
                          onDelete={() => deleteDocument(doc)}
                        />
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {uncategorised.length > 0 && (
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <div className="flex items-center space-x-2 px-4 py-3 bg-slate-50">
                <Folder size={17} className="text-slate-400" />
                <span className="font-semibold text-sm text-slate-800">Uncategorised</span>
                <span className="text-xs text-slate-400 bg-white px-2 py-0.5 rounded-full border border-slate-200">{uncategorised.length}</span>
              </div>
              <div className="divide-y divide-slate-100">
                {uncategorised.map((doc) => (
                  <AdminDocRow
                    key={doc.id}
                    doc={doc}
                    canWrite={canWrite}
                    onEdit={() => { setEditingDoc(doc); setShowDocForm(true); setShowBulkUpload(false); }}
                    onDelete={() => deleteDocument(doc)}
                  />
                ))}
              </div>
            </div>
          )}
          {documents.length === 0 && (
            <div className="text-center py-16 text-slate-400">
              <FileText size={36} className="mx-auto mb-3 text-slate-300" />
              <p>No documents uploaded yet.</p>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {categories.map((cat) => (
            <div key={cat.id} className="flex items-center justify-between p-4 border border-slate-200 rounded-xl hover:border-slate-300 transition-colors">
              <div>
                <div className="flex items-center space-x-2">
                  <Folder size={16} className="text-amber-500" />
                  <span className="font-medium text-slate-900">{cat.name}</span>
                  <span className="text-xs text-slate-400">Order: {cat.display_order}</span>
                </div>
                {cat.description && <p className="text-sm text-slate-500 mt-1 ml-6">{cat.description}</p>}
              </div>
              {canWrite && <div className="flex items-center space-x-1">
                <button
                  onClick={() => { setEditingCat(cat); setShowCatForm(true); }}
                  className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <Edit2 size={15} />
                </button>
                <button
                  onClick={() => deleteCategory(cat)}
                  className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 size={15} />
                </button>
              </div>}
            </div>
          ))}
          {categories.length === 0 && (
            <div className="text-center py-12 text-slate-400">No categories yet.</div>
          )}
        </div>
      )}
    </div>
  );
};

const AdminDocRow = ({
  doc,
  canWrite,
  onEdit,
  onDelete,
}: {
  doc: DocumentWithCategory;
  canWrite: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) => (
  <div className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors">
    <div className="flex items-center space-x-3 flex-1 min-w-0">
      <FileText size={16} className="text-slate-400 flex-shrink-0" />
      <div className="min-w-0">
        <span className="text-sm font-medium text-slate-900 truncate block">{doc.title}</span>
        <span className="text-xs text-slate-400">{doc.file_name}</span>
      </div>
    </div>
    {canWrite && <div className="flex items-center space-x-1 ml-4">
      <button
        onClick={onEdit}
        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
      >
        <Edit2 size={14} />
      </button>
      <button
        onClick={onDelete}
        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
      >
        <Trash2 size={14} />
      </button>
    </div>}
  </div>
);

const DocumentForm = ({
  categories,
  editingDoc,
  userId,
  onDone,
  onCancel,
}: {
  categories: DocumentCategory[];
  editingDoc: DocumentWithCategory | null;
  userId: string | null;
  onDone: () => void;
  onCancel: () => void;
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [formData, setFormData] = useState({
    title: editingDoc?.title ?? '',
    description: editingDoc?.description ?? '',
    category_id: editingDoc?.category_id ?? '',
    tags: editingDoc?.tags?.join(', ') ?? '',
    source_issuer: editingDoc?.source_issuer ?? '',
    source_url: editingDoc?.source_url ?? '',
    rights_reviewed: editingDoc?.rights_reviewed ?? false,
    include_in_lodge_guide: editingDoc?.include_in_lodge_guide ?? false,
  });

  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
    if (!formData.title) {
      setFormData((prev) => ({
        ...prev,
        title: documentTitleFromFilename(file.name),
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setUploading(true);

    try {
      let fileUrl = editingDoc?.file_url ?? '';
      let fileName = editingDoc?.file_name ?? '';
      let fileSize = editingDoc?.file_size ?? null;
      let fileType = editingDoc?.file_type ?? null;

      if (selectedFile) {
        const ext = selectedFile.name.split('.').pop();
        const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from(DOCUMENTS_BUCKET)
          .upload(path, selectedFile);
        if (uploadError) throw uploadError;

        if (editingDoc?.file_url && !editingDoc.source_mailroom_import_id) {
          const oldBucket = editingDoc.storage_bucket || DOCUMENTS_BUCKET;
          await supabase.storage.from(oldBucket).remove([editingDoc.file_url]);
        }

        fileUrl = path;
        fileName = selectedFile.name;
        fileSize = selectedFile.size;
        fileType = selectedFile.type;
      }

      const tags = formData.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      const payload = {
        title: formData.title,
        description: formData.description || null,
        category_id: formData.category_id || null,
        file_url: fileUrl,
        file_name: fileName,
        file_size: fileSize,
        file_type: fileType,
        storage_bucket: selectedFile ? DOCUMENTS_BUCKET : editingDoc?.storage_bucket ?? DOCUMENTS_BUCKET,
        tags,
        source_issuer: formData.source_issuer || null,
        source_url: formData.source_url || null,
        rights_reviewed: formData.rights_reviewed,
        include_in_lodge_guide: formData.rights_reviewed && formData.include_in_lodge_guide,
        uploaded_by: userId,
      };

      if (editingDoc) {
        await supabase.from('documents').update(payload).eq('id', editingDoc.id);
      } else {
        if (!selectedFile) throw new Error('Please select a file to upload.');
        await supabase.from('documents').insert(payload);
      }

      onDone();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 mb-6">
      <div className="flex justify-between items-center mb-5">
        <h3 className="font-semibold text-slate-900">{editingDoc ? 'Edit Document' : 'Upload Document'}</h3>
        <button onClick={onCancel} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {!editingDoc && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">File</label>
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFileSelect(f); }}
              onClick={() => fileInputRef.current?.click()}
              className={`cursor-pointer flex flex-col items-center justify-center py-8 border-2 border-dashed rounded-xl transition-colors ${
                dragOver ? 'border-slate-900 bg-slate-100' : selectedFile ? 'border-green-400 bg-green-50' : 'border-slate-300 hover:border-slate-400 hover:bg-white'
              }`}
            >
              {selectedFile ? (
                <>
                  <FileText size={28} className="text-green-500 mb-2" />
                  <p className="text-sm font-medium text-green-700">{selectedFile.name}</p>
                  <p className="text-xs text-green-500">{(selectedFile.size / 1024).toFixed(1)} KB — click to change</p>
                </>
              ) : (
                <>
                  <Upload size={28} className="text-slate-400 mb-2" />
                  <p className="text-sm text-slate-600 font-medium">Drop file here or click to browse</p>
                  <p className="text-xs text-slate-400 mt-1">PDF, Word, Excel, images up to 50 MB</p>
                </>
              )}
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }}
              />
            </div>
          </div>
        )}

        {editingDoc && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Replace File (optional)</label>
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFileSelect(f); }}
              onClick={() => fileInputRef.current?.click()}
              className={`cursor-pointer flex items-center space-x-3 px-4 py-3 border-2 border-dashed rounded-xl transition-colors ${
                selectedFile ? 'border-green-400 bg-green-50' : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <Upload size={16} className={selectedFile ? 'text-green-500' : 'text-slate-400'} />
              <span className="text-sm text-slate-600">{selectedFile ? selectedFile.name : `Current: ${editingDoc.file_name}`}</span>
              <input ref={fileInputRef} type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }} />
            </div>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Title</label>
          <input
            type="text"
            required
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            rows={2}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
            <select
              value={formData.category_id}
              onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
            >
              <option value="">Uncategorised</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              <span className="flex items-center space-x-1"><Tag size={13} /><span>Tags (comma-separated)</span></span>
            </label>
            <input
              type="text"
              value={formData.tags}
              onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
              placeholder="e.g. 2024, annual, minutes"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Source or issuing organization</label>
            <input type="text" value={formData.source_issuer} onChange={(e) => setFormData({ ...formData, source_issuer: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Source URL</label>
            <input type="url" value={formData.source_url} onChange={(e) => setFormData({ ...formData, source_url: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" />
          </div>
          <label className="flex min-h-11 items-center gap-2 text-sm font-medium text-slate-700"><input type="checkbox" checked={formData.rights_reviewed} onChange={(e) => setFormData({ ...formData, rights_reviewed: e.target.checked, include_in_lodge_guide: e.target.checked ? formData.include_in_lodge_guide : false })} /> Sharing rights reviewed</label>
          <label className="flex min-h-11 items-center gap-2 text-sm font-medium text-slate-700"><input type="checkbox" checked={formData.include_in_lodge_guide} disabled={!formData.rights_reviewed} onChange={(e) => setFormData({ ...formData, include_in_lodge_guide: e.target.checked })} /> Include in Lodge Guide</label>
        </div>

        {error && (
          <div className="flex items-start space-x-2 text-red-600 bg-red-50 border border-red-200 rounded-lg p-3 text-sm">
            <AlertCircle size={15} className="mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex justify-end space-x-3 pt-2">
          <button type="button" onClick={onCancel} className="px-4 py-2 text-sm text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors">
            Cancel
          </button>
          <button
            type="submit"
            disabled={uploading}
            className="flex items-center space-x-2 px-5 py-2 text-sm bg-slate-900 text-amber-300 rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-60"
          >
            {uploading ? <><Loader2 size={15} className="animate-spin" /><span>Uploading...</span></> : <span>{editingDoc ? 'Save Changes' : 'Upload'}</span>}
          </button>
        </div>
      </form>
    </div>
  );
};

const BulkUploadForm = ({
  categories,
  defaultCategoryId,
  userId,
  onDone,
  onCancel,
}: {
  categories: DocumentCategory[];
  defaultCategoryId: string;
  userId: string | null;
  onDone: () => void;
  onCancel: () => void;
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [categoryId, setCategoryId] = useState(defaultCategoryId);
  const [tags, setTags] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadedCount, setUploadedCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const addFiles = (fileList: FileList | null) => {
    if (!fileList?.length) return;
    setFiles((prev) => [...prev, ...Array.from(fileList)]);
    setError(null);
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    addFiles(e.dataTransfer.files);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (files.length === 0) {
      setError('Choose at least one document to upload.');
      return;
    }

    setUploading(true);
    setUploadedCount(0);

    const parsedTags = tags
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);

    try {
      for (const file of files) {
        const ext = file.name.split('.').pop();
        const path = `bulk/${Date.now()}-${Math.random().toString(36).slice(2)}${ext ? `.${ext}` : ''}`;
        const { error: uploadError } = await supabase.storage
          .from(DOCUMENTS_BUCKET)
          .upload(path, file, file.type ? { contentType: file.type } : undefined);

        if (uploadError) throw uploadError;

        const { error: insertError } = await supabase.from('documents').insert({
          title: documentTitleFromFilename(file.name) || file.name,
          description: null,
          category_id: categoryId || null,
          file_url: path,
          file_name: file.name,
          file_size: file.size,
          file_type: file.type || null,
          storage_bucket: DOCUMENTS_BUCKET,
          tags: parsedTags,
          uploaded_by: userId,
        });

        if (insertError) {
          await supabase.storage.from(DOCUMENTS_BUCKET).remove([path]);
          throw insertError;
        }

        setUploadedCount((count) => count + 1);
      }

      onDone();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Bulk upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 mb-6">
      <div className="flex justify-between items-start mb-5">
        <div>
          <h3 className="font-semibold text-slate-900">Bulk Upload Documents</h3>
          <p className="text-sm text-slate-500 mt-1">Files are added as individual library records so you can edit titles, descriptions, tags, and categories afterward.</p>
        </div>
        <button onClick={onCancel} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Files</label>
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`cursor-pointer flex flex-col items-center justify-center py-8 border-2 border-dashed rounded-xl transition-colors ${
              dragOver ? 'border-slate-900 bg-slate-100' : files.length > 0 ? 'border-green-400 bg-green-50' : 'border-slate-300 hover:border-slate-400 hover:bg-white'
            }`}
          >
            <Files size={30} className={files.length > 0 ? 'text-green-500 mb-2' : 'text-slate-400 mb-2'} />
            <p className="text-sm font-medium text-slate-700">
              {files.length > 0 ? `${files.length} file${files.length === 1 ? '' : 's'} selected` : 'Drop files here or click to browse'}
            </p>
            <p className="text-xs text-slate-400 mt-1">PDF, Word, Excel, text, and image files up to 50 MB each</p>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => addFiles(e.target.files)}
            />
          </div>
        </div>

        {files.length > 0 && (
          <div className="border border-slate-200 rounded-xl bg-white divide-y divide-slate-100 max-h-56 overflow-y-auto">
            {files.map((file, index) => (
              <div key={`${file.name}-${file.lastModified}-${index}`} className="flex items-center justify-between px-3 py-2">
                <div className="flex items-center space-x-2 min-w-0">
                  <FileText size={15} className="text-slate-400 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{file.name}</p>
                    <p className="text-xs text-slate-400">{(file.size / 1024).toFixed(1)} KB</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => removeFile(index)}
                  disabled={uploading}
                  className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Initial Category</label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
            >
              <option value="">Uncategorised</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              <span className="flex items-center space-x-1"><Tag size={13} /><span>Shared Tags (optional)</span></span>
            </label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="e.g. archive, to review"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>
        </div>

        {uploading && (
          <div className="flex items-center space-x-2 text-sm text-slate-600 bg-white border border-slate-200 rounded-lg p-3">
            <Loader2 size={15} className="animate-spin text-slate-400" />
            <span>Uploaded {uploadedCount} of {files.length}</span>
          </div>
        )}

        {uploadedCount > 0 && !uploading && !error && (
          <div className="flex items-center space-x-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg p-3">
            <CheckCircle2 size={15} />
            <span>Uploaded {uploadedCount} file{uploadedCount === 1 ? '' : 's'}.</span>
          </div>
        )}

        {error && (
          <div className="flex items-start space-x-2 text-red-600 bg-red-50 border border-red-200 rounded-lg p-3 text-sm">
            <AlertCircle size={15} className="mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex justify-end space-x-3 pt-2">
          <button type="button" onClick={onCancel} disabled={uploading} className="px-4 py-2 text-sm text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-60">
            Cancel
          </button>
          <button
            type="submit"
            disabled={uploading}
            className="flex items-center space-x-2 px-5 py-2 text-sm bg-slate-900 text-amber-300 rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-60"
          >
            {uploading ? <><Loader2 size={15} className="animate-spin" /><span>Uploading...</span></> : <><Upload size={15} /><span>Upload Files</span></>}
          </button>
        </div>
      </form>
    </div>
  );
};

const CategoryForm = ({
  editingCat,
  onDone,
  onCancel,
}: {
  editingCat: DocumentCategory | null;
  onDone: () => void;
  onCancel: () => void;
}) => {
  const [formData, setFormData] = useState({
    name: editingCat?.name ?? '',
    description: editingCat?.description ?? '',
    display_order: editingCat?.display_order?.toString() ?? '0',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      name: formData.name,
      description: formData.description || null,
      display_order: parseInt(formData.display_order) || 0,
    };
    if (editingCat) {
      await supabase.from('document_categories').update(payload).eq('id', editingCat.id);
    } else {
      await supabase.from('document_categories').insert(payload);
    }
    onDone();
  };

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 mb-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold text-slate-900">{editingCat ? 'Edit Category' : 'New Category'}</h3>
        <button onClick={onCancel} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Display Order</label>
            <input
              type="number"
              value={formData.display_order}
              onChange={(e) => setFormData({ ...formData, display_order: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
          <input
            type="text"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
          />
        </div>
        <div className="flex justify-end space-x-3">
          <button type="button" onClick={onCancel} className="px-4 py-2 text-sm text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors">Cancel</button>
          <button type="submit" className="px-5 py-2 text-sm bg-slate-900 text-amber-300 rounded-lg hover:bg-slate-800 transition-colors">
            {editingCat ? 'Save Changes' : 'Create Category'}
          </button>
        </div>
      </form>
    </div>
  );
};
