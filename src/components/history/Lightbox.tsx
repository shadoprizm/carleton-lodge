import { useEffect, useRef } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { imageTypeLabel, type HistoryImage } from '../../lib/history';

interface LightboxProps {
  images: HistoryImage[];
  index: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
}

/**
 * Accessible modal lightbox: Esc closes, arrow keys and buttons navigate
 * when several images are available, and focus is returned to the element
 * that opened it.
 */
export const Lightbox = ({ images, index, onClose, onNavigate }: LightboxProps) => {
  const closeRef = useRef<HTMLButtonElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const image = images[index];
  const hasMany = images.length > 1;

  useEffect(() => {
    restoreFocusRef.current = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      } else if (hasMany && event.key === 'ArrowLeft') {
        onNavigate((index - 1 + images.length) % images.length);
      } else if (hasMany && event.key === 'ArrowRight') {
        onNavigate((index + 1) % images.length);
      }
    };
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      restoreFocusRef.current?.focus();
    };
  }, [index, images.length, hasMany, onClose, onNavigate]);

  if (!image?.localPath) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${image.title} — enlarged image`}
      className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/90 p-4"
      onClick={onClose}
    >
      <div
        className="relative max-h-full w-full max-w-4xl"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Close image viewer"
          className="absolute -top-2 right-0 z-10 rounded-full bg-slate-900 p-2 text-white hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 sm:-right-2"
        >
          <X size={22} />
        </button>

        <img
          src={image.localPath}
          alt={image.alt}
          className="mx-auto max-h-[70vh] w-auto max-w-full rounded-lg object-contain"
        />

        <div className="mt-4 rounded-lg bg-slate-900/80 p-4 text-slate-100">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-400">
            {imageTypeLabel(image)}
          </p>
          <h3 className="mt-1 font-serif text-xl">{image.title}</h3>
          <p className="mt-1 text-sm leading-relaxed text-slate-300">{image.caption}</p>
          <p className="mt-2 text-xs text-slate-400">Credit: {image.creditLine}</p>
        </div>

        {hasMany && (
          <div className="mt-3 flex items-center justify-between">
            <button
              type="button"
              onClick={() => onNavigate((index - 1 + images.length) % images.length)}
              aria-label="Previous image"
              className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
            >
              <ChevronLeft size={16} /> Previous
            </button>
            <span className="text-sm text-slate-300" aria-live="polite">
              {index + 1} of {images.length}
            </span>
            <button
              type="button"
              onClick={() => onNavigate((index + 1) % images.length)}
              aria-label="Next image"
              className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
            >
              Next <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
