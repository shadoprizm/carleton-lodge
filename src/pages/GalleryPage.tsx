import { useState, useEffect, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight, Globe, Users, Image, Lock } from 'lucide-react';
import { supabase, PhotoAlbum, Photo } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

type AlbumWithPhotos = PhotoAlbum & { photos: Photo[]; cover_url: string | null };

export const GalleryPage = () => {
  const { user, profile } = useAuth();
  const [albums, setAlbums] = useState<AlbumWithPhotos[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAlbum, setSelectedAlbum] = useState<AlbumWithPhotos | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const isAdmin = profile?.is_admin ?? false;
  const isMember = !!user;

  useEffect(() => {
    loadAlbums();
  }, [isMember, isAdmin]);

  const loadAlbums = async () => {
    setLoading(true);

    let query = supabase.from('photo_albums').select('*').order('created_at', { ascending: false });

    if (!isMember) {
      query = query.eq('visibility', 'public');
    } else if (!isAdmin) {
      query = query.in('visibility', ['public', 'members']);
    }

    const { data: albumData } = await query;
    if (!albumData) { setLoading(false); return; }

    const enriched: AlbumWithPhotos[] = await Promise.all(albumData.map(async (album) => {
      let photosQuery = supabase.from('photos').select('*').eq('album_id', album.id).order('display_order').order('created_at');

      if (!isMember) {
        photosQuery = photosQuery.or('visibility.eq.public,visibility.eq.inherit');
      } else if (!isAdmin) {
        photosQuery = photosQuery.not('visibility', 'eq', 'admin');
      }

      const { data: photoData } = await photosQuery;
      const photos = photoData ?? [];
      const cover = album.cover_photo_id
        ? photos.find(p => p.id === album.cover_photo_id) ?? photos[0]
        : photos[0];

      return { ...album, photos, cover_url: cover?.public_url ?? null };
    }));

    setAlbums(enriched.filter(a => a.photos.length > 0 || isAdmin));
    setLoading(false);
  };

  const openLightbox = (idx: number) => setLightboxIndex(idx);
  const closeLightbox = () => setLightboxIndex(null);

  const prevPhoto = useCallback(() => {
    if (lightboxIndex === null || !selectedAlbum) return;
    setLightboxIndex((lightboxIndex - 1 + selectedAlbum.photos.length) % selectedAlbum.photos.length);
  }, [lightboxIndex, selectedAlbum]);

  const nextPhoto = useCallback(() => {
    if (lightboxIndex === null || !selectedAlbum) return;
    setLightboxIndex((lightboxIndex + 1) % selectedAlbum.photos.length);
  }, [lightboxIndex, selectedAlbum]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (lightboxIndex === null) return;
      if (e.key === 'ArrowLeft') prevPhoto();
      if (e.key === 'ArrowRight') nextPhoto();
      if (e.key === 'Escape') closeLightbox();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [lightboxIndex, prevPhoto, nextPhoto]);

  const visibilityBadge = (v: string) => {
    if (v === 'public') return <span className="inline-flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50/90 backdrop-blur px-2 py-0.5 rounded-full font-medium"><Globe size={10} />Public</span>;
    if (v === 'members') return <span className="inline-flex items-center gap-1 text-xs text-blue-700 bg-blue-50/90 backdrop-blur px-2 py-0.5 rounded-full font-medium"><Users size={10} />Members</span>;
    if (v === 'admin') return <span className="inline-flex items-center gap-1 text-xs text-amber-700 bg-amber-50/90 backdrop-blur px-2 py-0.5 rounded-full font-medium"><Lock size={10} />Admin</span>;
    return null;
  };

  if (loading) {
    return (
      <div className="min-h-screen pt-20 bg-slate-50 flex items-center justify-center">
        <div className="text-slate-400 text-sm">Loading gallery...</div>
      </div>
    );
  }

  if (selectedAlbum) {
    return (
      <div className="min-h-screen pt-20 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="flex items-center gap-3 mb-8">
            <button onClick={() => setSelectedAlbum(null)} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 transition-colors">
              <ChevronLeft size={16} />All Albums
            </button>
            <span className="text-slate-300">/</span>
            <span className="text-sm font-medium text-slate-800">{selectedAlbum.title}</span>
          </div>

          <div className="mb-8">
            <div className="flex items-start gap-3">
              <div>
                <h1 className="text-3xl font-serif text-slate-900">{selectedAlbum.title}</h1>
                {selectedAlbum.description && <p className="text-slate-500 mt-1">{selectedAlbum.description}</p>}
                <div className="flex items-center gap-3 mt-2">
                  {visibilityBadge(selectedAlbum.visibility)}
                  <span className="text-sm text-slate-400">{selectedAlbum.photos.length} photo{selectedAlbum.photos.length !== 1 ? 's' : ''}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="columns-2 sm:columns-3 lg:columns-4 gap-3 space-y-3">
            {selectedAlbum.photos.map((photo, idx) => (
              <div
                key={photo.id}
                className="break-inside-avoid group cursor-pointer rounded-xl overflow-hidden relative"
                onClick={() => openLightbox(idx)}
              >
                <img
                  src={photo.public_url}
                  alt={photo.title ?? ''}
                  className="w-full object-cover group-hover:scale-105 transition-transform duration-300"
                  loading="lazy"
                />
                {(photo.title || photo.description) && (
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3 opacity-0 group-hover:opacity-100 transition-opacity">
                    {photo.title && <p className="text-white text-sm font-medium leading-tight">{photo.title}</p>}
                    {photo.description && <p className="text-white/80 text-xs mt-0.5 line-clamp-2">{photo.description}</p>}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {lightboxIndex !== null && (
          <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center" onClick={closeLightbox}>
            <button onClick={closeLightbox} className="absolute top-4 right-4 p-2 text-white/70 hover:text-white transition-colors z-10"><X size={24} /></button>
            <button onClick={e => { e.stopPropagation(); prevPhoto(); }} className="absolute left-4 top-1/2 -translate-y-1/2 p-2 text-white/70 hover:text-white transition-colors z-10 bg-white/10 rounded-full"><ChevronLeft size={24} /></button>
            <button onClick={e => { e.stopPropagation(); nextPhoto(); }} className="absolute right-4 top-1/2 -translate-y-1/2 p-2 text-white/70 hover:text-white transition-colors z-10 bg-white/10 rounded-full"><ChevronRight size={24} /></button>

            <div className="max-w-5xl max-h-[90vh] flex flex-col items-center px-16" onClick={e => e.stopPropagation()}>
              <img
                src={selectedAlbum.photos[lightboxIndex].public_url}
                alt={selectedAlbum.photos[lightboxIndex].title ?? ''}
                className="max-h-[80vh] max-w-full object-contain rounded-lg"
              />
              {(selectedAlbum.photos[lightboxIndex].title || selectedAlbum.photos[lightboxIndex].description || selectedAlbum.photos[lightboxIndex].taken_at) && (
                <div className="mt-4 text-center max-w-lg">
                  {selectedAlbum.photos[lightboxIndex].title && <p className="text-white font-medium">{selectedAlbum.photos[lightboxIndex].title}</p>}
                  {selectedAlbum.photos[lightboxIndex].description && <p className="text-white/70 text-sm mt-1">{selectedAlbum.photos[lightboxIndex].description}</p>}
                  {selectedAlbum.photos[lightboxIndex].taken_at && <p className="text-white/50 text-xs mt-1">{new Date(selectedAlbum.photos[lightboxIndex].taken_at!).toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' })}</p>}
                </div>
              )}
              <p className="text-white/40 text-xs mt-3">{lightboxIndex + 1} / {selectedAlbum.photos.length}</p>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-20 bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="mb-10">
          <h1 className="text-4xl font-serif text-slate-900">Photo Gallery</h1>
          <p className="text-slate-500 mt-2">A visual history of Carleton Lodge No. 465</p>
        </div>

        {albums.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-400">
            <Image size={48} className="mb-4 opacity-30" />
            <p>No photos available yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {albums.map(album => (
              <div
                key={album.id}
                className="group cursor-pointer rounded-2xl overflow-hidden border border-slate-200 hover:border-slate-300 hover:shadow-lg transition-all bg-white"
                onClick={() => setSelectedAlbum(album)}
              >
                <div className="aspect-video bg-slate-100 relative overflow-hidden">
                  {album.cover_url ? (
                    <img src={album.cover_url} alt={album.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center"><Image size={36} className="text-slate-300" /></div>
                  )}
                  <div className="absolute bottom-2 right-2">{visibilityBadge(album.visibility)}</div>
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-slate-900 group-hover:text-amber-700 transition-colors">{album.title}</h3>
                  {album.description && <p className="text-sm text-slate-500 mt-1 line-clamp-2">{album.description}</p>}
                  <p className="text-xs text-slate-400 mt-2">{album.photos.length} photo{album.photos.length !== 1 ? 's' : ''}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
