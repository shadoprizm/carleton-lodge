import { useState } from 'react';
import { ZoomIn } from 'lucide-react';
import {
  AI_RECONSTRUCTION_LABEL,
  imageTypeLabel,
  type HistoryImage,
} from '../../lib/history';
import { Lightbox } from './Lightbox';

interface HistoryFigureProps {
  image: HistoryImage;
  className?: string;
  /** When provided, the parent controls the lightbox (e.g. gallery-wide navigation). */
  onOpen?: (image: HistoryImage) => void;
}

/**
 * Figure with caption, credit line and the correct IMAGE_POLICY type label.
 * Images without an acquired local asset are not displayed at all — the
 * archive shows the photographs it has, and says nothing about the rest.
 */
export const HistoryFigure = ({ image, className = '', onOpen }: HistoryFigureProps) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const isAi = image.imageType === 'ai_reconstruction';

  if (!image.localPath) return null;

  const handleOpen = () => {
    if (onOpen) onOpen(image);
    else setInternalOpen(true);
  };

  return (
    <figure className={`overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm ${className}`}>
      <button
        type="button"
        onClick={handleOpen}
        aria-label={`Enlarge image: ${image.title}`}
        className="group relative block w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
      >
        <img
          src={image.localPath}
          alt={image.alt}
          loading="lazy"
          decoding="async"
          className="h-56 w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
        />
        <span
          aria-hidden="true"
          className="absolute bottom-2 right-2 rounded-full bg-slate-900/80 p-1.5 text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
        >
          <ZoomIn size={16} />
        </span>
      </button>

      {isAi && (
        <p className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs font-semibold leading-relaxed text-amber-900">
          {AI_RECONSTRUCTION_LABEL}
        </p>
      )}

      <figcaption className="p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">
          {isAi ? 'AI reconstruction' : imageTypeLabel(image)}
        </p>
        <h3 className="mt-1 font-serif text-lg text-slate-900">{image.title}</h3>
        <p className="mt-1 text-sm leading-relaxed text-slate-600">{image.caption}</p>
        <p className="mt-2 text-xs text-slate-500">Credit: {image.creditLine}</p>
      </figcaption>

      {internalOpen && (
        <Lightbox
          images={[image]}
          index={0}
          onClose={() => setInternalOpen(false)}
          onNavigate={() => undefined}
        />
      )}
    </figure>
  );
};
