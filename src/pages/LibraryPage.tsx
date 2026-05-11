import { useState, useEffect, useMemo } from 'react';
import { Navigate } from 'react-router-dom';
import { Search, FileText, Download, Tag, ChevronDown, ChevronRight, Folder, FolderOpen, File, Eye, Filter, ArrowUpDown, X } from 'lucide-react';
import { supabase, DocumentCategory, DocumentWithCategory } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { DocumentPreviewModal } from '../components/DocumentPreviewModal';

const FILE_TYPE_LABELS: Record<string, string> = {
  'application/pdf': 'PDF',
  'application/msword': 'DOC',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
  'application/vnd.ms-excel': 'XLS',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'XLSX',
  'text/plain': 'TXT',
  'image/jpeg': 'JPG',
  'image/png': 'PNG',
  'image/gif': 'GIF',
};

const FILE_TYPE_COLORS: Record<string, string> = {
  'application/pdf': 'bg-red-100 text-red-700',
  'application/msword': 'bg-blue-100 text-blue-700',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'bg-blue-100 text-blue-700',
  'application/vnd.ms-excel': 'bg-green-100 text-green-700',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'bg-green-100 text-green-700',
  'text/plain': 'bg-slate-100 text-slate-700',
};

const ALL_FILTER_VALUE = 'all';

type DocumentSortOption = 'newest' | 'oldest' | 'title-asc' | 'title-desc' | 'largest' | 'smallest';

const DOCUMENT_SORT_OPTIONS: Array<{ value: DocumentSortOption; label: string }> = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'title-asc', label: 'Title A-Z' },
  { value: 'title-desc', label: 'Title Z-A' },
  { value: 'largest', label: 'Largest file' },
  { value: 'smallest', label: 'Smallest file' },
];

function formatFileSize(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileTypeLabel(mimeType: string | null): string {
  if (!mimeType) return 'FILE';
  return FILE_TYPE_LABELS[mimeType] || mimeType.split('/')[1]?.toUpperCase() || 'FILE';
}

function getFileTypeColor(mimeType: string | null): string {
  if (!mimeType) return 'bg-slate-100 text-slate-700';
  return FILE_TYPE_COLORS[mimeType] || 'bg-slate-100 text-slate-700';
}

function sortDocuments(docs: DocumentWithCategory[], sortBy: DocumentSortOption): DocumentWithCategory[] {
  return [...docs].sort((a, b) => {
    switch (sortBy) {
      case 'oldest':
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      case 'title-asc':
        return a.title.localeCompare(b.title);
      case 'title-desc':
        return b.title.localeCompare(a.title);
      case 'largest':
        return (b.file_size ?? 0) - (a.file_size ?? 0);
      case 'smallest':
        return (a.file_size ?? 0) - (b.file_size ?? 0);
      case 'newest':
      default:
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    }
  });
}

export const LibraryPage = () => {
  const { user, loading: authLoading } = useAuth();
  const [categories, setCategories] = useState<DocumentCategory[]>([]);
  const [documents, setDocuments] = useState<DocumentWithCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedFileType, setSelectedFileType] = useState(ALL_FILTER_VALUE);
  const [selectedTag, setSelectedTag] = useState(ALL_FILTER_VALUE);
  const [sortBy, setSortBy] = useState<DocumentSortOption>('newest');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [previewDoc, setPreviewDoc] = useState<DocumentWithCategory | null>(null);

  useEffect(() => {
    if (user) fetchLibrary();
  }, [user]);

  const fetchLibrary = async () => {
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

  const handleDownload = async (doc: DocumentWithCategory) => {
    const bucket = doc.storage_bucket || 'lodge-documents';
    const { data } = await supabase.storage
      .from(bucket)
      .createSignedUrl(doc.file_url, 60);
    if (data?.signedUrl) {
      try {
        // Fetch the file content to hide the Supabase URL
        const response = await fetch(data.signedUrl);
        if (!response.ok) throw new Error('Failed to fetch file');
        
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        
        // Create a temporary link to trigger download
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = doc.file_name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Clean up the blob URL after a delay
        setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
      } catch (err) {
        console.error('Error downloading file:', err);
        // Fallback to opening in new tab
        window.open(data.signedUrl, '_blank');
      }
    }
  };

  const toggleCategory = (id: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const fileTypeOptions = useMemo(() => {
    const uniqueTypes = Array.from(new Set(documents.map((doc) => doc.file_type).filter(Boolean) as string[]));
    return uniqueTypes.sort((a, b) => getFileTypeLabel(a).localeCompare(getFileTypeLabel(b)));
  }, [documents]);

  const tagOptions = useMemo(() => {
    const uniqueTags = Array.from(new Set(documents.flatMap((doc) => doc.tags ?? [])));
    return uniqueTags.sort((a, b) => a.localeCompare(b));
  }, [documents]);

  const filteredDocs = sortDocuments(documents.filter((doc) => {
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      doc.title.toLowerCase().includes(q) ||
      doc.description?.toLowerCase().includes(q) ||
      doc.file_name.toLowerCase().includes(q) ||
      doc.document_categories?.name.toLowerCase().includes(q) ||
      doc.tags.some((t) => t.toLowerCase().includes(q));
    const matchesCategory = !selectedCategory || doc.category_id === selectedCategory;
    const matchesFileType = selectedFileType === ALL_FILTER_VALUE || doc.file_type === selectedFileType;
    const matchesTag = selectedTag === ALL_FILTER_VALUE || doc.tags.includes(selectedTag);
    return matchesSearch && matchesCategory && matchesFileType && matchesTag;
  }), sortBy);

  const docsByCategory = categories.reduce<Record<string, DocumentWithCategory[]>>((acc, cat) => {
    acc[cat.id] = filteredDocs.filter((d) => d.category_id === cat.id);
    return acc;
  }, {});
  const uncategorised = filteredDocs.filter((d) => !d.category_id);

  const totalDocs = documents.length;
  const hasActiveFilters =
    search.trim().length > 0 ||
    !!selectedCategory ||
    selectedFileType !== ALL_FILTER_VALUE ||
    selectedTag !== ALL_FILTER_VALUE ||
    sortBy !== 'newest';

  const clearFilters = () => {
    setSearch('');
    setSelectedCategory(null);
    setSelectedFileType(ALL_FILTER_VALUE);
    setSelectedTag(ALL_FILTER_VALUE);
    setSortBy('newest');
  };

  if (authLoading) return null;
  if (!user) return <Navigate to="/" replace />;

  return (
    <>
    <div className="min-h-screen bg-slate-50 pt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-serif text-slate-900">Document Library</h1>
          <p className="text-slate-500 mt-1">
            {totalDocs} document{totalDocs !== 1 ? 's' : ''} archived for lodge members
          </p>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          <aside className="lg:w-60 flex-shrink-0 space-y-2">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <button
                onClick={() => setSelectedCategory(null)}
                className={`w-full flex items-center justify-between px-4 py-3 text-sm font-medium border-b border-slate-100 transition-colors ${
                  !selectedCategory ? 'bg-slate-900 text-amber-300' : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <Folder size={16} className={!selectedCategory ? 'text-amber-400' : 'text-slate-400'} />
                  <span>All Documents</span>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${!selectedCategory ? 'bg-amber-500/20 text-amber-300' : 'bg-slate-100 text-slate-500'}`}>
                  {totalDocs}
                </span>
              </button>

              {categories.map((cat) => {
                const count = documents.filter((d) => d.category_id === cat.id).length;
                const isActive = selectedCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(isActive ? null : cat.id)}
                    className={`w-full flex items-center justify-between px-4 py-3 text-sm font-medium border-b border-slate-100 last:border-0 transition-colors ${
                      isActive ? 'bg-slate-900 text-amber-300' : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <Folder size={16} className={isActive ? 'text-amber-400' : 'text-slate-400'} />
                      <span className="text-left leading-tight">{cat.name}</span>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ml-2 ${isActive ? 'bg-amber-500/20 text-amber-300' : 'bg-slate-100 text-slate-500'}`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </aside>

          <div className="flex-1 min-w-0 space-y-4">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-3">
              <div className="grid md:grid-cols-[minmax(0,1fr)_auto] gap-3">
                <div className="relative">
                  <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search title, description, filename, category, or tag..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>
                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="inline-flex items-center justify-center space-x-1.5 px-3 py-2.5 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                  >
                    <X size={15} />
                    <span>Clear</span>
                  </button>
                )}
              </div>

              <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
                <label className="space-y-1">
                  <span className="flex items-center space-x-1.5 text-xs font-medium text-slate-500">
                    <Folder size={13} />
                    <span>Category</span>
                  </span>
                  <select
                    value={selectedCategory ?? ALL_FILTER_VALUE}
                    onChange={(e) => setSelectedCategory(e.target.value === ALL_FILTER_VALUE ? null : e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900"
                  >
                    <option value={ALL_FILTER_VALUE}>All categories</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </label>

                <label className="space-y-1">
                  <span className="flex items-center space-x-1.5 text-xs font-medium text-slate-500">
                    <Filter size={13} />
                    <span>File type</span>
                  </span>
                  <select
                    value={selectedFileType}
                    onChange={(e) => setSelectedFileType(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900"
                  >
                    <option value={ALL_FILTER_VALUE}>All file types</option>
                    {fileTypeOptions.map((type) => (
                      <option key={type} value={type}>{getFileTypeLabel(type)}</option>
                    ))}
                  </select>
                </label>

                <label className="space-y-1">
                  <span className="flex items-center space-x-1.5 text-xs font-medium text-slate-500">
                    <Tag size={13} />
                    <span>Tag</span>
                  </span>
                  <select
                    value={selectedTag}
                    onChange={(e) => setSelectedTag(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900"
                  >
                    <option value={ALL_FILTER_VALUE}>All tags</option>
                    {tagOptions.map((tag) => (
                      <option key={tag} value={tag}>{tag}</option>
                    ))}
                  </select>
                </label>

                <label className="space-y-1">
                  <span className="flex items-center space-x-1.5 text-xs font-medium text-slate-500">
                    <ArrowUpDown size={13} />
                    <span>Sort</span>
                  </span>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as DocumentSortOption)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900"
                  >
                    {DOCUMENT_SORT_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="text-xs text-slate-500">
                Showing {filteredDocs.length} of {totalDocs} document{totalDocs !== 1 ? 's' : ''}
              </div>
            </div>

            {loading ? (
              <div className="text-center py-20 text-slate-500">Loading library...</div>
            ) : filteredDocs.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-xl border border-slate-200">
                <FileText size={40} className="mx-auto text-slate-300 mb-3" />
                <p className="text-slate-500 font-medium">No documents found</p>
                {hasActiveFilters && <p className="text-sm text-slate-400 mt-1">Try clearing filters or using a different search term</p>}
              </div>
            ) : (
              <div className="space-y-4">
                {categories.map((cat) => {
                  const catDocs = docsByCategory[cat.id] || [];
                  if (catDocs.length === 0) return null;
                  const isExpanded = expandedCategories.has(cat.id);
                  return (
                    <div key={cat.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                      <button
                        onClick={() => toggleCategory(cat.id)}
                        className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors"
                      >
                        <div className="flex items-center space-x-3">
                          {isExpanded ? (
                            <FolderOpen size={20} className="text-amber-500" />
                          ) : (
                            <Folder size={20} className="text-slate-400" />
                          )}
                          <span className="font-semibold text-slate-900">{cat.name}</span>
                          <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                            {catDocs.length}
                          </span>
                        </div>
                        {isExpanded ? (
                          <ChevronDown size={16} className="text-slate-400" />
                        ) : (
                          <ChevronRight size={16} className="text-slate-400" />
                        )}
                      </button>

                      <AnimatePresence initial={false}>
                        {isExpanded && (
                          <motion.div
                            key="content"
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            <div className="divide-y divide-slate-100 border-t border-slate-100">
                              {catDocs.map((doc) => (
                                <DocumentRow key={doc.id} doc={doc} onDownload={handleDownload} onPreview={setPreviewDoc} />
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}

                {uncategorised.length > 0 && (
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="px-5 py-4 border-b border-slate-100 flex items-center space-x-3">
                      <File size={20} className="text-slate-400" />
                      <span className="font-semibold text-slate-900">Uncategorised</span>
                      <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{uncategorised.length}</span>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {uncategorised.map((doc) => (
                        <DocumentRow key={doc.id} doc={doc} onDownload={handleDownload} onPreview={setPreviewDoc} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>

    <DocumentPreviewModal
      doc={previewDoc}
      onClose={() => setPreviewDoc(null)}
      onDownload={handleDownload}
    />
    </>
  );
};

const DocumentRow = ({
  doc,
  onDownload,
  onPreview,
}: {
  doc: DocumentWithCategory;
  onDownload: (doc: DocumentWithCategory) => void;
  onPreview: (doc: DocumentWithCategory) => void;
}) => {
  return (
    <div className="flex items-start justify-between px-5 py-4 hover:bg-slate-50 transition-colors group">
      <div className="flex items-start space-x-4 flex-1 min-w-0">
        <div className="mt-0.5 flex-shrink-0">
          <FileText size={20} className="text-slate-400 group-hover:text-slate-600 transition-colors" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-2 flex-wrap gap-y-1">
            <span className="font-medium text-slate-900 truncate">{doc.title}</span>
            {doc.file_type && (
              <span className={`text-xs px-2 py-0.5 rounded font-semibold flex-shrink-0 ${getFileTypeColor(doc.file_type)}`}>
                {getFileTypeLabel(doc.file_type)}
              </span>
            )}
          </div>
          {doc.description && (
            <p className="text-sm text-slate-500 mt-0.5 line-clamp-1">{doc.description}</p>
          )}
          <div className="flex items-center flex-wrap gap-x-3 gap-y-1 mt-1.5 text-xs text-slate-400">
            <span>{new Date(doc.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
            {doc.file_size && <span>{formatFileSize(doc.file_size)}</span>}
            {doc.tags.length > 0 && (
              <div className="flex items-center space-x-1">
                <Tag size={11} />
                <span>{doc.tags.join(', ')}</span>
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="ml-4 flex-shrink-0 flex items-center space-x-2">
        <button
          onClick={() => onPreview(doc)}
          className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-900 hover:text-amber-300 hover:border-slate-900 transition-colors"
        >
          <Eye size={13} />
          <span>Preview</span>
        </button>
        <button
          onClick={() => onDownload(doc)}
          className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-900 hover:text-amber-300 hover:border-slate-900 transition-colors"
        >
          <Download size={13} />
          <span>Download</span>
        </button>
      </div>
    </div>
  );
};
