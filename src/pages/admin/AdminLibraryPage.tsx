import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router';
import {
  Trash2, Edit2, Upload, FileText, X, Loader2, FolderPlus,
  Tag, ChevronDown, ChevronRight, Folder, FolderOpen, AlertCircle,
  Files, CheckCircle2, Eye, ArrowUp, ArrowDown
} from 'lucide-react';
import { supabase, DocumentCategory, DocumentWithCategory } from '../../lib/supabase';
import { moveDocumentInList, type DocumentMoveDirection } from '../../lib/documentOrdering';
import { useAuth } from '../../contexts/AuthContext';
import { DocumentPreviewModal } from '../../components/DocumentPreviewModal';
import {
  DOCUMENT_UPLOAD_ACCEPT,
  resolveDocumentMimeType,
  validateDocumentUpload,
} from '../../lib/documentFiles';

const DOCUMENTS_BUCKET = 'lodge-documents';
const BULK_INTAKE_CATEGORY_NAME = 'Needs Sorting';
const SUMMONS_CATEGORY_NAME = 'Summons';

function documentTitleFromFilename(filename: string): string {
  return filename.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ').trim();
}

export const AdminLibraryPage = () => {
  const { user, hasAdminPermission } = useAuth();
  const canWrite = hasAdminPermission('library', 'write');
  const canManageSummons = hasAdminPermission('summons', 'write');
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
  const [previewDoc, setPreviewDoc] = useState<DocumentWithCategory | null>(null);
  const [reorderingCategoryKey, setReorderingCategoryKey] = useState<string | null>(null);
  const [reorderError, setReorderError] = useState<string | null>(null);

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
        .order('display_order', { ascending: true }),
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
    if (doc.summons_id) return;
    if (!confirm(`Delete "${doc.title}"?`)) return;
    if (!doc.source_mailroom_import_id) {
      const bucket = doc.storage_bucket || DOCUMENTS_BUCKET;
      await supabase.storage.from(bucket).remove([doc.file_url]);
    }
    await supabase.from('documents').delete().eq('id', doc.id);
    fetchData();
  };

  const deleteCategory = async (cat: DocumentCategory) => {
    if (cat.name === SUMMONS_CATEGORY_NAME) return;
    if (!confirm(`Delete category "${cat.name}"? Documents in it will become uncategorised.`)) return;
    await supabase.from('document_categories').delete().eq('id', cat.id);
    fetchData();
  };

  const downloadDocument = async (doc: DocumentWithCategory) => {
    const bucket = doc.storage_bucket || DOCUMENTS_BUCKET;
    const { data } = await supabase.storage
      .from(bucket)
      .createSignedUrl(doc.file_url, 60);
    if (!data?.signedUrl) return;

    try {
      const response = await fetch(data.signedUrl);
      if (!response.ok) throw new Error('Failed to fetch file');

      const blobUrl = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = doc.file_name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    } catch (downloadError) {
      console.error('Error downloading file:', downloadError);
      window.open(data.signedUrl, '_blank');
    }
  };

  const moveDocument = async (
    categoryId: string | null,
    categoryDocuments: DocumentWithCategory[],
    documentId: string,
    direction: DocumentMoveDirection,
  ) => {
    const reordered = moveDocumentInList(categoryDocuments, documentId, direction);
    if (reordered === categoryDocuments) return;

    const previousDocuments = documents;
    const positions = new Map(
      reordered.map((document, index) => [document.id, index]),
    );
    const categoryKey = categoryId ?? 'uncategorised';

    setReorderingCategoryKey(categoryKey);
    setReorderError(null);
    setDocuments((currentDocuments) => currentDocuments.map((document) => {
      const displayOrder = positions.get(document.id);
      return displayOrder === undefined
        ? document
        : { ...document, display_order: displayOrder };
    }));

    try {
      const { error } = await supabase.rpc('reorder_library_documents', {
        target_category_id: categoryId,
        ordered_document_ids: reordered.map((document) => document.id),
      });
      if (error) throw error;
    } catch (error: unknown) {
      setDocuments(previousDocuments);
      setReorderError(
        error instanceof Error
          ? error.message
          : 'The new document order could not be saved.',
      );
    } finally {
      setReorderingCategoryKey(null);
    }
  };

  const docsByCategory = categories.reduce<Record<string, DocumentWithCategory[]>>((acc, cat) => {
    acc[cat.id] = documents
      .filter((document) => document.category_id === cat.id)
      .sort((a, b) => a.display_order - b.display_order);
    return acc;
  }, {});
  const uncategorised = documents
    .filter((document) => !document.category_id)
    .sort((a, b) => a.display_order - b.display_order);
  const editableCategories = categories.filter((cat) => cat.name !== SUMMONS_CATEGORY_NAME);

  return (
    <div>
      <div className="flex justify-between items-start mb-6">
        <div>
          <h2 className="text-xl font-serif text-slate-900">Document Library</h2>
          <p className="text-sm text-slate-500 mt-1">
            Upload documents, then use the arrows to arrange each category in the order members should see.
          </p>
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
          categories={editableCategories}
          editingDoc={editingDoc}
          userId={user?.id ?? null}
          onDone={() => { setShowDocForm(false); setEditingDoc(null); fetchData(); }}
          onCancel={() => { setShowDocForm(false); setEditingDoc(null); }}
        />
      )}

      {canWrite && showBulkUpload && (
        <BulkUploadForm
          categories={editableCategories}
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

      {reorderError ? (
        <div role="alert" className="mb-6 flex items-start space-x-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle size={15} className="mt-0.5 flex-shrink-0" />
          <span>{reorderError}</span>
        </div>
      ) : null}

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
                      catDocs.map((doc, index) => (
                        <AdminDocRow
                          key={doc.id}
                          doc={doc}
                          canWrite={canWrite}
                          canManageSummons={canManageSummons}
                          isFirst={index === 0}
                          isLast={index === catDocs.length - 1}
                          isReordering={reorderingCategoryKey === cat.id}
                          reorderDisabled={reorderingCategoryKey !== null}
                          onMoveUp={() => moveDocument(cat.id, catDocs, doc.id, 'up')}
                          onMoveDown={() => moveDocument(cat.id, catDocs, doc.id, 'down')}
                          onPreview={() => setPreviewDoc(doc)}
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
                {uncategorised.map((doc, index) => (
                  <AdminDocRow
                    key={doc.id}
                    doc={doc}
                    canWrite={canWrite}
                    canManageSummons={canManageSummons}
                    isFirst={index === 0}
                    isLast={index === uncategorised.length - 1}
                    isReordering={reorderingCategoryKey === 'uncategorised'}
                    reorderDisabled={reorderingCategoryKey !== null}
                    onMoveUp={() => moveDocument(null, uncategorised, doc.id, 'up')}
                    onMoveDown={() => moveDocument(null, uncategorised, doc.id, 'down')}
                    onPreview={() => setPreviewDoc(doc)}
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
              {cat.name === SUMMONS_CATEGORY_NAME ? (
                <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-800">
                  Managed from Summons
                </span>
              ) : canWrite && <div className="flex items-center space-x-1">
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

      <DocumentPreviewModal
        doc={previewDoc}
        onClose={() => setPreviewDoc(null)}
        onDownload={downloadDocument}
      />
    </div>
  );
};

const AdminDocRow = ({
  doc,
  canWrite,
  canManageSummons,
  isFirst,
  isLast,
  isReordering,
  reorderDisabled,
  onMoveUp,
  onMoveDown,
  onPreview,
  onEdit,
  onDelete,
}: {
  doc: DocumentWithCategory;
  canWrite: boolean;
  canManageSummons: boolean;
  isFirst: boolean;
  isLast: boolean;
  isReordering: boolean;
  reorderDisabled: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onPreview: () => void;
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
    <div className="flex items-center space-x-1 ml-4">
      {canWrite ? (
        <div className="flex items-center rounded-lg border border-slate-200 bg-white">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={isFirst || reorderDisabled}
            aria-label={`Move ${doc.title} up`}
            className="p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:text-slate-300"
          >
            <ArrowUp size={14} />
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={isLast || reorderDisabled}
            aria-label={`Move ${doc.title} down`}
            className="border-l border-slate-200 p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:text-slate-300"
          >
            {isReordering ? <Loader2 size={14} className="animate-spin" /> : <ArrowDown size={14} />}
          </button>
        </div>
      ) : null}
      <button
        type="button"
        onClick={onPreview}
        aria-label={`Preview ${doc.title}`}
        className="flex items-center space-x-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:border-slate-900 hover:bg-slate-900 hover:text-amber-300"
      >
        <Eye size={13} />
        <span>Preview</span>
      </button>
      {doc.summons_id ? (
        canManageSummons ? (
          <Link
            to="/admin/summons"
            className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-800 hover:bg-blue-100"
          >
            Manage in Summons
          </Link>
        ) : (
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
            Linked summons
          </span>
        )
      ) : canWrite ? <>
      <button
        onClick={onEdit}
        aria-label={`Edit ${doc.title}`}
        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
      >
        <Edit2 size={14} />
      </button>
      <button
        onClick={onDelete}
        aria-label={`Delete ${doc.title}`}
        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
      >
        <Trash2 size={14} />
      </button>
      </> : null}
    </div>
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
  const [previewFile, setPreviewFile] = useState<File | null>(null);
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
    const validationError = validateDocumentUpload(file);
    if (validationError) {
      setError(validationError);
      setSelectedFile(null);
      setPreviewFile(null);
      return;
    }

    setError(null);
    setSelectedFile(file);
    setPreviewFile(null);
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
        const resolvedMimeType = resolveDocumentMimeType(selectedFile.name, selectedFile.type);
        const { error: uploadError } = await supabase.storage
          .from(DOCUMENTS_BUCKET)
          .upload(
            path,
            selectedFile,
            resolvedMimeType ? { contentType: resolvedMimeType } : undefined,
          );
        if (uploadError) throw uploadError;

        if (editingDoc?.file_url && !editingDoc.source_mailroom_import_id) {
          const oldBucket = editingDoc.storage_bucket || DOCUMENTS_BUCKET;
          await supabase.storage.from(oldBucket).remove([editingDoc.file_url]);
        }

        fileUrl = path;
        fileName = selectedFile.name;
        fileSize = selectedFile.size;
        fileType = resolvedMimeType;
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
    <>
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
                  <p className="text-xs text-slate-400 mt-1">PDF, Word, PowerPoint, Excel, text, CSV, and image files up to 25 MB</p>
                </>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept={DOCUMENT_UPLOAD_ACCEPT}
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
              <input ref={fileInputRef} type="file" accept={DOCUMENT_UPLOAD_ACCEPT} className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }} />
            </div>
          </div>
        )}

        {selectedFile ? (
          <div className="flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-blue-900">Ready to preview: {selectedFile.name}</p>
              <p className="text-xs text-blue-700">Review the selected file before uploading it.</p>
            </div>
            <button
              type="button"
              onClick={() => setPreviewFile(selectedFile)}
              className="ml-3 flex flex-shrink-0 items-center space-x-1.5 rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-xs font-medium text-blue-800 transition-colors hover:bg-blue-100"
            >
              <Eye size={13} />
              <span>Preview selected file</span>
            </button>
          </div>
        ) : null}

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
    <DocumentPreviewModal
      doc={null}
      localFile={previewFile}
      onClose={() => setPreviewFile(null)}
    />
    </>
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
  const [previewFile, setPreviewFile] = useState<File | null>(null);

  const addFiles = (fileList: FileList | null) => {
    if (!fileList?.length) return;
    const nextFiles = Array.from(fileList);
    const validationError = nextFiles
      .map((file) => validateDocumentUpload(file))
      .find((message): message is string => Boolean(message));

    if (validationError) {
      setError(validationError);
      return;
    }

    setFiles((prev) => [...prev, ...nextFiles]);
    setError(null);
  };

  const removeFile = (index: number) => {
    const removedFile = files[index];
    if (previewFile === removedFile) setPreviewFile(null);
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
        const resolvedMimeType = resolveDocumentMimeType(file.name, file.type);
        const { error: uploadError } = await supabase.storage
          .from(DOCUMENTS_BUCKET)
          .upload(
            path,
            file,
            resolvedMimeType ? { contentType: resolvedMimeType } : undefined,
          );

        if (uploadError) throw uploadError;

        const { error: insertError } = await supabase.from('documents').insert({
          title: documentTitleFromFilename(file.name) || file.name,
          description: null,
          category_id: categoryId || null,
          file_url: path,
          file_name: file.name,
          file_size: file.size,
          file_type: resolvedMimeType,
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
    <>
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
            <p className="text-xs text-slate-400 mt-1">PDF, Word, PowerPoint, Excel, text, CSV, and image files up to 25 MB each</p>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={DOCUMENT_UPLOAD_ACCEPT}
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
                <div className="ml-3 flex flex-shrink-0 items-center space-x-1">
                  <button
                    type="button"
                    onClick={() => setPreviewFile(file)}
                    aria-label={`Preview ${file.name}`}
                    className="flex items-center space-x-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:border-slate-900 hover:bg-slate-900 hover:text-amber-300"
                  >
                    <Eye size={13} />
                    <span>Preview</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => removeFile(index)}
                    disabled={uploading}
                    aria-label={`Remove ${file.name}`}
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                  >
                    <X size={14} />
                  </button>
                </div>
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
    <DocumentPreviewModal
      doc={null}
      localFile={previewFile}
      onClose={() => setPreviewFile(null)}
    />
    </>
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
