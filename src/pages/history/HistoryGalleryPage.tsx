import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { HistoryLayout } from '../../components/history/HistoryLayout';
import { HistoryFigure } from '../../components/history/HistoryFigure';
import { Lightbox } from '../../components/history/Lightbox';
import {
  AI_RECONSTRUCTION_LABEL,
  GALLERY_CATEGORY_LABELS,
  historyImages,
  type GalleryCategory,
  type HistoryImage,
} from '../../lib/history';

const categoryOrder: GalleryCategory[] = [
  'historical_photographs',
  'buildings',
  'people',
  'documents_maps',
  'artifacts',
  'modern_lodge_history',
  'ai_reconstructions',
];

const matchesSearch = (image: HistoryImage, query: string) => {
  const haystack = `${image.title} ${image.caption} ${image.alt} ${image.sourceInstitution}`.toLowerCase();
  return haystack.includes(query.toLowerCase());
};

export const HistoryGalleryPage = () => {
  const [category, setCategory] = useState<GalleryCategory | 'all'>('all');
  const [query, setQuery] = useState('');
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  // The gallery shows the photographs the archive holds — image slots without
  // an acquired asset simply do not appear.
  const visibleImages = useMemo(() => {
    const trimmed = query.trim();
    return historyImages.filter(
      (image) =>
        Boolean(image.localPath) &&
        (category === 'all' || image.galleryCategory === category) &&
        (!trimmed || matchesSearch(image, trimmed)),
    );
  }, [category, query]);

  const openLightbox = (image: HistoryImage) => {
    const index = visibleImages.findIndex((candidate) => candidate.id === image.id);
    if (index >= 0) setLightboxIndex(index);
  };

  return (
    <HistoryLayout
      activeSlug="gallery"
      eyebrow="The archive"
      title="Gallery"
      intro="Photographs, documents, buildings and artifacts from the Lodge's history — every image honestly labelled and credited."
    >
      <div className="space-y-8">
        <div className="flex flex-col gap-4">
          <div className="relative max-w-md">
            <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search titles, captions, and subjects…"
              aria-label="Search the gallery"
              className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 shadow-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
            />
          </div>

          <div role="group" aria-label="Filter gallery by category" className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setCategory('all')}
              aria-pressed={category === 'all'}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 ${
                category === 'all'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-amber-100 hover:text-amber-900'
              }`}
            >
              All
            </button>
            {categoryOrder.map((candidate) => (
              <button
                key={candidate}
                type="button"
                onClick={() => setCategory(candidate)}
                aria-pressed={category === candidate}
                className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 ${
                  category === candidate
                    ? candidate === 'ai_reconstructions'
                      ? 'bg-amber-700 text-white'
                      : 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-amber-100 hover:text-amber-900'
                }`}
              >
                {GALLERY_CATEGORY_LABELS[candidate]}
              </button>
            ))}
          </div>

          {category === 'ai_reconstructions' && (
            <p className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm font-semibold leading-relaxed text-amber-900">
              {AI_RECONSTRUCTION_LABEL} Images in this filter are visual impressions only, never
              documentary evidence.
            </p>
          )}
        </div>

        {visibleImages.length > 0 ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {visibleImages.map((image) => (
              <HistoryFigure key={image.id} image={image} onOpen={openLightbox} />
            ))}
          </div>
        ) : (
          <p className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
            No images match the current filter and search.
          </p>
        )}
      </div>

      {lightboxIndex !== null && visibleImages[lightboxIndex] && (
        <Lightbox
          images={visibleImages}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onNavigate={setLightboxIndex}
        />
      )}
    </HistoryLayout>
  );
};
