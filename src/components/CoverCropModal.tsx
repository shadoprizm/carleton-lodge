import { useState, useCallback } from 'react';
import Cropper, { Area } from 'react-easy-crop';
import { X, Crop as CropIcon, Loader, ZoomIn } from 'lucide-react';
import { Photo } from '../lib/supabase';
import { cropImage } from '../utils/imageProcessor';

interface CoverCropModalProps {
  photo: Photo;
  saving: boolean;
  onCancel: () => void;
  onSave: (blob: Blob) => void | Promise<void>;
}

export const CoverCropModal = ({ photo, saving, onCancel, onSave }: CoverCropModalProps) => {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  const onCropComplete = useCallback((_area: Area, areaPixels: Area) => {
    setCroppedAreaPixels(areaPixels);
  }, []);

  const handleSave = async () => {
    if (!croppedAreaPixels) return;
    setError(null);
    setProcessing(true);
    try {
      const processed = await cropImage(photo.public_url, croppedAreaPixels);
      await onSave(processed.blob);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save cover';
      setError(message);
    } finally {
      setProcessing(false);
    }
  };

  const busy = processing || saving;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Set Album Cover</h3>
            <p className="text-sm text-slate-500 mt-0.5">Drag and zoom to frame the cover (16:9).</p>
          </div>
          <button onClick={onCancel} disabled={busy} className="p-1 hover:bg-slate-100 rounded-lg disabled:opacity-50"><X size={18} /></button>
        </div>

        <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-slate-900">
          <Cropper
            image={photo.public_url}
            crop={crop}
            zoom={zoom}
            aspect={16 / 9}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
          />
        </div>

        <div className="flex items-center gap-3 mt-4">
          <ZoomIn size={16} className="text-slate-400 flex-shrink-0" />
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={e => setZoom(Number(e.target.value))}
            className="w-full accent-amber-500"
            aria-label="Zoom"
          />
        </div>

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        <div className="flex gap-2 mt-5">
          <button onClick={onCancel} disabled={busy} className="flex-1 px-4 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50">Cancel</button>
          <button onClick={handleSave} disabled={busy || !croppedAreaPixels} className="flex-1 px-4 py-2 text-sm bg-slate-900 text-white rounded-lg hover:bg-slate-800 disabled:opacity-60 transition-colors flex items-center justify-center gap-2">
            {busy ? <Loader size={14} className="animate-spin" /> : <CropIcon size={14} />}
            {busy ? 'Saving...' : 'Save as Cover'}
          </button>
        </div>
      </div>
    </div>
  );
};
