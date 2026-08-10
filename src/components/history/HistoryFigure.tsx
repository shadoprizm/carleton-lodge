import { useState } from 'react';
import { ZoomIn } from 'lucide-react';
import {
  AI_RECONSTRUCTION_LABEL,
  PHOTO_PENDING_PATH,
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
 * Slots without an acquired asset render the shared neutral placeholder and
 * can never be opened in the lightbox.
 */
export const HistoryFigure = ({ image, className = '', onOpen }: HistoryFigureProps) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const hasImage = Boolean(image.localPath);
  const isAi = image.imageType === 'ai_reconstruction';

  const handleOpen = () => {
    if (!hasImage) return;
    if (onOpen) onOpen(image);
    else setInternalOpen(true);
  };

  return (
    <figure className={`overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm ${className}`}>
      {hasImage ? (
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
      ) : (
        <div className="relative">
          <img
            src={PHOTO_PENDING_PATH}
            alt=""
            aria-hidden="true"
            className="h-56 w-full object-cover"
          />
          <span className="absolute left-3 top-3 rounded-full bg-slate-900/85 px-3 py-1 text-xs font-semibold text-white">
            Pending acquisition
          </span>
        </div>
      )}

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
        {!hasImage && image.acquisitionNote && (
          <p className="mt-1 text-xs italic text-slate-400">{image.acquisitionNote}</p>
        )}
      </figcaption>

      {internalOpen && hasImage && (
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
