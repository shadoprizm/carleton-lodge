const MAX_WIDTH = 1920;
const MAX_HEIGHT = 1080;
const QUALITY = 0.82;

export interface ProcessedImage {
  blob: Blob;
  width: number;
  height: number;
  originalFilename: string;
}

export async function processImage(file: File): Promise<ProcessedImage> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      let { width, height } = img;

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
 * Crop a region out of a remote image (e.g. a Supabase public_url) and return it as a
 * WebP blob, mirroring processImage's output. `crop` is in source-image pixels, matching
 * react-easy-crop's `croppedAreaPixels`.
 *
 * crossOrigin='anonymous' is required so drawing the remote image onto the canvas does
 * not taint it; the lodge-photos bucket is public and serves permissive CORS headers,
 * so toBlob() succeeds.
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
