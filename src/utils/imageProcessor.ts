const MAX_WIDTH = 1920;
const MAX_HEIGHT = 1080;
const QUALITY = 0.82;
const MAX_INPUT_BYTES = 12 * 1024 * 1024;
const MAX_SOURCE_PIXELS = 40_000_000;
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

export interface ProcessedImage {
  blob: Blob;
  width: number;
  height: number;
  originalFilename: string;
}

export async function processImage(file: File): Promise<ProcessedImage> {
  if (file.size <= 0 || file.size > MAX_INPUT_BYTES) {
    throw new Error('Images must be 12 MB or smaller');
  }
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    throw new Error('Use a JPEG, PNG, WebP, or GIF image');
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      let { width, height } = img;
      if (width <= 0 || height <= 0 || width * height > MAX_SOURCE_PIXELS) {
        reject(new Error('Image dimensions are too large'));
        return;
      }

      if (width > MAX_WIDTH || height > MAX_HEIGHT) {
        const ratio = Math.min(MAX_WIDTH / width, MAX_HEIGHT / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Failed to convert image to blob'));
            return;
          }
          resolve({
            blob,
            width,
            height,
            originalFilename: file.name,
          });
        },
        'image/webp',
        QUALITY
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to load image'));
    };

    img.src = objectUrl;
  });
}

// Largest dimension for a baked album cover. Covers render in a small 16:9 card,
// so there's no need to keep full-resolution crops.
const COVER_MAX_WIDTH = 1280;

export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Crop a region out of a remote image (for example, a short-lived signed URL)
 * and return it as a
 * WebP blob, mirroring processImage's output. `crop` is in source-image pixels, matching
 * react-easy-crop's `croppedAreaPixels`.
 *
 * crossOrigin='anonymous' is required so drawing the remote image onto the canvas does
 * not taint it. Supabase Storage permits CORS for authorized signed-object reads.
 */
export async function cropImage(src: string, crop: CropRect): Promise<ProcessedImage> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      const sw = Math.max(1, Math.round(crop.width));
      const sh = Math.max(1, Math.round(crop.height));

      let width = sw;
      let height = sh;
      if (width > COVER_MAX_WIDTH) {
        const ratio = COVER_MAX_WIDTH / width;
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      ctx.drawImage(img, crop.x, crop.y, sw, sh, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Failed to convert cropped image to blob'));
            return;
          }
          resolve({ blob, width, height, originalFilename: 'cover.webp' });
        },
        'image/webp',
        QUALITY
      );
    };

    img.onerror = () => reject(new Error('Failed to load image for cropping'));

    img.src = src;
  });
}
