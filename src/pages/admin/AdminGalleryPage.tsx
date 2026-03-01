import { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, Edit2, Upload, X, Image, Eye, Lock, Globe, Users, ChevronLeft, Check, Loader } from 'lucide-react';
import { supabase, PhotoAlbum, Photo } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { processImage } from '../../utils/imageProcessor';

type Visibility = 'public' | 'members' | 'admin';

const VISIBILITY_OPTIONS: { value: Visibility; label: string; icon: typeof Globe; description: string }[] = [
  { value: 'public', label: 'Public', icon: Globe, description: 'Anyone can view' },
  { value: 'members', label: 'Members Only', icon: Users, description: 'Logged-in members only' },
  { value: 'admin', label: 'Admin Only', icon: Lock, description: 'Admins only' },
];

interface AlbumFormData {
  title: string;
  description: string;
  visibility: Visibility;
}

interface PhotoFormData {
  title: string;
  description: string;
  taken_at: string;
  visibility: 'public' | 'members' | 'admin' | 'inherit';
}

export const AdminGalleryPage = () => {
  const { user } = useAuth();
  const [albums, setAlbums] = useState<(PhotoAlbum & { photo_count: number; cover_url: string | null })[]>([]);
  const [selectedAlbum, setSelectedAlbum] = useState<PhotoAlbum | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAlbumForm, setShowAlbumForm] = useState(false);
  const [editingAlbum, setEditingAlbum] = useState<PhotoAlbum | null>(null);
  const [albumForm, setAlbumForm] = useState<AlbumFormData>({ title: '', description: '', visibility: 'members' });
  const [albumSaving, setAlbumSaving] = useState(false);
  const [uploadQueue, setUploadQueue] = useState<{ file: File; preview: string; form: PhotoFormData; status: 'pending' | 'uploading' | 'done' | 'error'; error?: string }[]>([]);
  const [showUploadPanel, setShowUploadPanel] = useState(false);
  const [uploadingAll, setUploadingAll] = useState(false);
  const [editingPhoto, setEditingPhoto] = useState<Photo | null>(null);
  const [photoForm, setPhotoForm] = useState<PhotoFormData>({ title: '', description: '', taken_at: '', visibility: 'inherit' });
  const [photoSaving, setPhotoSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadAlbums();
  }, []);

  useEffect(() => {
    if (selectedAlbum) loadPhotos(selectedAlbum.id);
  }, [selectedAlbum]);

  const loadAlbums = async () => {
    setLoading(true);
    const { data: albumData } = await supabase
      .from('photo_albums')
      .select('*')
      .order('created_at', { ascending: false });

    if (!albumData) { setLoading(false); return; }

    const enriched = await Promise.all(albumData.map(async (album) => {
      const { count } = await supabase.from('photos').select('*', { count: 'exact', head: true }).eq('album_id', album.id);
      let cover_url: string | null = null;
      if (album.cover_photo_id) {
        const { data: cp } = await supabase.from('photos').select('public_url').eq('id', album.cover_photo_id).maybeSingle();
        cover_url = cp?.public_url ?? null;
      } else {
        const { data: first } = await supabase.from('photos').select('public_url').eq('album_id', album.id).order('display_order').limit(1).maybeSingle();
        cover_url = first?.public_url ?? null;
      }
      return { ...album, photo_count: count ?? 0, cover_url };
    }));

    setAlbums(enriched);
    setLoading(false);
  };

  const loadPhotos = async (albumId: string) => {
    const { data } = await supabase.from('photos').select('*').eq('album_id', albumId).order('display_order').order('created_at');
    setPhotos(data ?? []);
  };

  const openAlbumForm = (album?: PhotoAlbum) => {
    if (album) {
      setEditingAlbum(album);
      setAlbumForm({ title: album.title, description: album.description ?? '', visibility: album.visibility });
    } else {
      setEditingAlbum(null);
      setAlbumForm({ title: '', description: '', visibility: 'members' });
    }
    setShowAlbumForm(true);
  };

  const saveAlbum = async () => {
    if (!albumForm.title.trim()) return;
    setAlbumSaving(true);
    if (editingAlbum) {
      await supabase.from('photo_albums').update({ ...albumForm, updated_at: new Date().toISOString() }).eq('id', editingAlbum.id);
    } else {
      await supabase.from('photo_albums').insert({ ...albumForm, created_by: user?.id });
    }
    setAlbumSaving(false);
    setShowAlbumForm(false);
    setEditingAlbum(null);
    if (selectedAlbum && editingAlbum?.id === selectedAlbum.id) {
      setSelectedAlbum(prev => prev ? { ...prev, ...albumForm } : prev);
    }
    loadAlbums();
  };

  const deleteAlbum = async (id: string) => {
    if (!confirm('Delete this album and all its photos? This cannot be undone.')) return;
    const { data: albumPhotos } = await supabase.from('photos').select('storage_path').eq('album_id', id);
    if (albumPhotos?.length) {
      await supabase.storage.from('lodge-photos').remove(albumPhotos.map(p => p.storage_path));
    }
    await supabase.from('photo_albums').delete().eq('id', id);
    if (selectedAlbum?.id === id) setSelectedAlbum(null);
    loadAlbums();
  };

  const handleFileSelect = (files: FileList | null) => {
    if (!files) return;
    const newItems = Array.from(files).filter(f => f.type.startsWith('image/')).map(file => ({
      file,
      preview: URL.createObjectURL(file),
      form: { title: '', description: '', taken_at: '', visibility: 'inherit' as const },
      status: 'pending' as const,
    }));
    setUploadQueue(prev => [...prev, ...newItems]);
    setShowUploadPanel(true);
  };

  const updateQueueItem = (idx: number, form: Partial<PhotoFormData>) => {
    setUploadQueue(prev => prev.map((item, i) => i === idx ? { ...item, form: { ...item.form, ...form } } : item));
  };

  const removeQueueItem = (idx: number) => {
    setUploadQueue(prev => {
      URL.revokeObjectURL(prev[idx].preview);
      return prev.filter((_, i) => i !== idx);
    });
  };

  const uploadAll = async () => {
    if (!selectedAlbum) return;
    setUploadingAll(true);
    for (let i = 0; i < uploadQueue.length; i++) {
      const item = uploadQueue[i];
      if (item.status === 'done') continue;
      setUploadQueue(prev => prev.map((q, idx) => idx === i ? { ...q, status: 'uploading' } : q));
      try {
        const processed = await processImage(item.file);
        const filename = `${selectedAlbum.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.webp`;
        const { error: uploadError } = await supabase.storage.from('lodge-photos').upload(filename, processed.blob, { contentType: 'image/webp', upsert: false });
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage.from('lodge-photos').getPublicUrl(filename);
        const { count: photoCount } = await supabase.from('photos').select('*', { count: 'exact', head: true }).eq('album_id', selectedAlbum.id);
        await supabase.from('photos').insert({
          album_id: selectedAlbum.id,
          title: item.form.title || null,
          description: item.form.description || null,
          taken_at: item.form.taken_at || null,
          visibility: item.form.visibility,
          storage_path: filename,
          public_url: urlData.publicUrl,
          original_filename: item.file.name,
          file_size: processed.blob.size,
          width: processed.width,
          height: processed.height,
          display_order: (photoCount ?? 0) + i,
          uploaded_by: user?.id,
        });
        setUploadQueue(prev => prev.map((q, idx) => idx === i ? { ...q, status: 'done' } : q));
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Upload failed';
        setUploadQueue(prev => prev.map((q, idx) => idx === i ? { ...q, status: 'error', error: message } : q));
      }
    }
    setUploadingAll(false);
    loadPhotos(selectedAlbum.id);
    loadAlbums();
    setUploadQueue(prev => prev.filter(q => q.status !== 'done'));
    if (uploadQueue.every(q => q.status === 'done' || (uploadQueue.find((_, idx) => uploadQueue[idx].status === 'done')))) {
      setShowUploadPanel(false);
    }
  };

  const openEditPhoto = (photo: Photo) => {
    setEditingPhoto(photo);
    setPhotoForm({ title: photo.title ?? '', description: photo.description ?? '', taken_at: photo.taken_at ?? '', visibility: photo.visibility });
  };

  const savePhoto = async () => {
    if (!editingPhoto) return;
    setPhotoSaving(true);
    await supabase.from('photos').update({ ...photoForm, title: photoForm.title || null, description: photoForm.description || null, taken_at: photoForm.taken_at || null, updated_at: new Date().toISOString() }).eq('id', editingPhoto.id);
    setPhotoSaving(false);
    setEditingPhoto(null);
    if (selectedAlbum) loadPhotos(selectedAlbum.id);
  };

  const deletePhoto = async (photo: Photo) => {
    if (!confirm('Delete this photo? This cannot be undone.')) return;
    setDeletingId(photo.id);
    await supabase.storage.from('lodge-photos').remove([photo.storage_path]);
    await supabase.from('photos').delete().eq('id', photo.id);
    setDeletingId(null);
    if (selectedAlbum) loadPhotos(selectedAlbum.id);
    loadAlbums();
  };

  const setCover = async (photo: Photo) => {
    if (!selectedAlbum) return;
    await supabase.from('photo_albums').update({ cover_photo_id: photo.id }).eq('id', selectedAlbum.id);
    loadAlbums();
  };

  const visibilityBadge = (v: string) => {
    if (v === 'public') return <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full"><Globe size={11} />Public</span>;
    if (v === 'members') return <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full"><Users size={11} />Members</span>;
    if (v === 'admin') return <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full"><Lock size={11} />Admin</span>;
    return <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full"><Eye size={11} />Inherit</span>;
  };

  if (loading) return <div className="flex items-center justify-center h-48 text-slate-400">Loading...</div>;

  if (selectedAlbum) {
    return (
      <div>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button onClick={() => { setSelectedAlbum(null); setShowUploadPanel(false); setUploadQueue([]); }} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
              <ChevronLeft size={20} className="text-slate-600" />
            </button>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">{selectedAlbum.title}</h2>
              <div className="flex items-center gap-2 mt-0.5">{visibilityBadge(selectedAlbum.visibility)}<span className="text-xs text-slate-400">{photos.length} photos</span></div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => openAlbumForm(selectedAlbum)} className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
              <Edit2 size={14} />Edit Album
            </button>
            <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors">
              <Upload size={14} />Upload Photos
            </button>
            <input ref={fileInputRef} type="file" multiple accept="image/*" className="hidden" onChange={e => handleFileSelect(e.target.files)} />
          </div>
        </div>

        {showUploadPanel && uploadQueue.length > 0 && (
          <div className="mb-6 border border-slate-200 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200">
              <span className="text-sm font-medium text-slate-700">{uploadQueue.length} photo{uploadQueue.length !== 1 ? 's' : ''} ready to upload</span>
              <div className="flex items-center gap-2">
                <button onClick={() => { setShowUploadPanel(false); setUploadQueue([]); }} className="text-xs text-slate-500 hover:text-slate-700">Clear all</button>
                <button onClick={uploadAll} disabled={uploadingAll} className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-60 transition-colors">
                  {uploadingAll ? <Loader size={14} className="animate-spin" /> : <Upload size={14} />}
                  {uploadingAll ? 'Uploading...' : 'Upload All'}
                </button>
              </div>
            </div>
            <div className="divide-y divide-slate-100 max-h-[420px] overflow-y-auto">
              {uploadQueue.map((item, idx) => (
                <div key={idx} className="flex gap-4 p-4">
                  <div className="relative flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden bg-slate-100">
                    <img src={item.preview} alt="" className="w-full h-full object-cover" />
                    {item.status === 'uploading' && <div className="absolute inset-0 bg-black/40 flex items-center justify-center"><Loader size={20} className="animate-spin text-white" /></div>}
                    {item.status === 'done' && <div className="absolute inset-0 bg-emerald-500/70 flex items-center justify-center"><Check size={20} className="text-white" /></div>}
                    {item.status === 'error' && <div className="absolute inset-0 bg-red-500/70 flex items-center justify-center"><X size={20} className="text-white" /></div>}
                  </div>
                  <div className="flex-1 grid grid-cols-2 gap-3 min-w-0">
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Title (optional)</label>
                      <input value={item.form.title} onChange={e => updateQueueItem(idx, { title: e.target.value })} placeholder={item.file.name} className="w-full text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-amber-400" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Date Taken</label>
                      <input type="date" value={item.form.taken_at} onChange={e => updateQueueItem(idx, { taken_at: e.target.value })} className="w-full text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-amber-400" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Caption</label>
                      <input value={item.form.description} onChange={e => updateQueueItem(idx, { description: e.target.value })} placeholder="Optional caption..." className="w-full text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-amber-400" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Visibility Override</label>
                      <select value={item.form.visibility} onChange={e => updateQueueItem(idx, { visibility: e.target.value as PhotoFormData['visibility'] })} className="w-full text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-amber-400">
                        <option value="inherit">Inherit from album</option>
                        <option value="public">Public</option>
                        <option value="members">Members only</option>
                        <option value="admin">Admin only</option>
                      </select>
                    </div>
                  </div>
                  <button onClick={() => removeQueueItem(idx)} className="self-start p-1 text-slate-400 hover:text-red-500 transition-colors"><X size={16} /></button>
                </div>
              ))}
            </div>
          </div>
        )}

        {photos.length === 0 && !showUploadPanel ? (
          <div className="flex flex-col items-center justify-center h-48 text-slate-400">
            <Image size={40} className="mb-3 opacity-40" />
            <p className="text-sm">No photos yet. Upload some to get started.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {photos.map(photo => (
              <div key={photo.id} className="group relative rounded-xl overflow-hidden bg-slate-100 aspect-square">
                <img src={photo.public_url} alt={photo.title ?? ''} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-all duration-200 flex flex-col justify-between p-2 opacity-0 group-hover:opacity-100">
                  <div className="flex justify-end gap-1">
                    <button onClick={() => openEditPhoto(photo)} className="p-1.5 bg-white/90 rounded-lg hover:bg-white transition-colors"><Edit2 size={13} className="text-slate-700" /></button>
                    <button onClick={() => setCover(photo)} title="Set as album cover" className="p-1.5 bg-white/90 rounded-lg hover:bg-white transition-colors"><Eye size={13} className="text-slate-700" /></button>
                    <button onClick={() => deletePhoto(photo)} disabled={deletingId === photo.id} className="p-1.5 bg-white/90 rounded-lg hover:bg-red-50 transition-colors">
                      {deletingId === photo.id ? <Loader size={13} className="animate-spin text-slate-700" /> : <Trash2 size={13} className="text-red-500" />}
                    </button>
                  </div>
                  {photo.title && <p className="text-xs text-white font-medium truncate">{photo.title}</p>}
                </div>
                {photo.visibility !== 'inherit' && <div className="absolute top-1.5 left-1.5">{visibilityBadge(photo.visibility)}</div>}
                {selectedAlbum.cover_photo_id === photo.id && (
                  <div className="absolute bottom-1.5 left-1.5 text-xs bg-amber-500 text-white px-2 py-0.5 rounded-full font-medium">Cover</div>
                )}
              </div>
            ))}
          </div>
        )}

        {editingPhoto && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-lg font-semibold text-slate-900">Edit Photo Details</h3>
                <button onClick={() => setEditingPhoto(null)} className="p-1 hover:bg-slate-100 rounded-lg"><X size={18} /></button>
              </div>
              <div className="mb-4 rounded-xl overflow-hidden aspect-video bg-slate-100">
                <img src={editingPhoto.public_url} alt="" className="w-full h-full object-contain" />
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Title</label>
                  <input value={photoForm.title} onChange={e => setPhotoForm(p => ({ ...p, title: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" placeholder="Optional title..." />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Caption</label>
                  <textarea value={photoForm.description} onChange={e => setPhotoForm(p => ({ ...p, description: e.target.value }))} rows={2} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none" placeholder="Optional caption..." />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Date Taken</label>
                    <input type="date" value={photoForm.taken_at} onChange={e => setPhotoForm(p => ({ ...p, taken_at: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Visibility</label>
                    <select value={photoForm.visibility} onChange={e => setPhotoForm(p => ({ ...p, visibility: e.target.value as PhotoFormData['visibility'] }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400">
                      <option value="inherit">Inherit from album</option>
                      <option value="public">Public</option>
                      <option value="members">Members only</option>
                      <option value="admin">Admin only</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="flex gap-2 mt-5">
                <button onClick={() => setEditingPhoto(null)} className="flex-1 px-4 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">Cancel</button>
                <button onClick={savePhoto} disabled={photoSaving} className="flex-1 px-4 py-2 text-sm bg-slate-900 text-white rounded-lg hover:bg-slate-800 disabled:opacity-60 transition-colors flex items-center justify-center gap-2">
                  {photoSaving && <Loader size={14} className="animate-spin" />}Save Changes
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Photo Gallery</h2>
          <p className="text-sm text-slate-500 mt-0.5">Manage photo albums and images</p>
        </div>
        <button onClick={() => openAlbumForm()} className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors">
          <Plus size={15} />New Album
        </button>
      </div>

      {albums.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-slate-400">
          <Image size={40} className="mb-3 opacity-40" />
          <p className="text-sm">No albums yet. Create your first album.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {albums.map(album => (
            <div key={album.id} className="group relative border border-slate-200 rounded-xl overflow-hidden hover:border-slate-300 hover:shadow-md transition-all cursor-pointer" onClick={() => setSelectedAlbum(album)}>
              <div className="aspect-video bg-slate-100 relative overflow-hidden">
                {album.cover_url ? (
                  <img src={album.cover_url} alt={album.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center"><Image size={32} className="text-slate-300" /></div>
                )}
                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                  <button onClick={() => openAlbumForm(album)} className="p-1.5 bg-white/90 rounded-lg hover:bg-white shadow-sm transition-colors"><Edit2 size={13} className="text-slate-600" /></button>
                  <button onClick={() => deleteAlbum(album.id)} className="p-1.5 bg-white/90 rounded-lg hover:bg-red-50 shadow-sm transition-colors"><Trash2 size={13} className="text-red-500" /></button>
                </div>
              </div>
              <div className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-medium text-slate-900 truncate">{album.title}</h3>
                    {album.description && <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{album.description}</p>}
                  </div>
                  {visibilityBadge(album.visibility)}
                </div>
                <p className="text-xs text-slate-400 mt-2">{album.photo_count} photo{album.photo_count !== 1 ? 's' : ''}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAlbumForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-semibold text-slate-900">{editingAlbum ? 'Edit Album' : 'New Album'}</h3>
              <button onClick={() => setShowAlbumForm(false)} className="p-1 hover:bg-slate-100 rounded-lg"><X size={18} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Album Title <span className="text-red-400">*</span></label>
                <input value={albumForm.title} onChange={e => setAlbumForm(p => ({ ...p, title: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" placeholder="e.g. Installation Ceremony 2025" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                <textarea value={albumForm.description} onChange={e => setAlbumForm(p => ({ ...p, description: e.target.value }))} rows={3} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none" placeholder="Optional description..." />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Who can view this album?</label>
                <div className="space-y-2">
                  {VISIBILITY_OPTIONS.map(opt => (
                    <label key={opt.value} className={`flex items-center gap-3 p-3 border rounded-xl cursor-pointer transition-colors ${albumForm.visibility === opt.value ? 'border-amber-400 bg-amber-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                      <input type="radio" name="visibility" value={opt.value} checked={albumForm.visibility === opt.value} onChange={() => setAlbumForm(p => ({ ...p, visibility: opt.value }))} className="sr-only" />
                      <opt.icon size={17} className={albumForm.visibility === opt.value ? 'text-amber-600' : 'text-slate-400'} />
                      <div>
                        <div className="text-sm font-medium text-slate-800">{opt.label}</div>
                        <div className="text-xs text-slate-500">{opt.description}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setShowAlbumForm(false)} className="flex-1 px-4 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">Cancel</button>
              <button onClick={saveAlbum} disabled={albumSaving || !albumForm.title.trim()} className="flex-1 px-4 py-2 text-sm bg-slate-900 text-white rounded-lg hover:bg-slate-800 disabled:opacity-60 transition-colors flex items-center justify-center gap-2">
                {albumSaving && <Loader size={14} className="animate-spin" />}{editingAlbum ? 'Save Changes' : 'Create Album'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
