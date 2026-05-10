/** Wide profile banner crop — matches typical header aspect (~21:9). */
export const BANNER_ASPECT = 21 / 9;
const TARGET_WIDTH = 1280;

function coverCropToCanvas(bitmap: ImageBitmap, targetW: number, targetH: number): HTMLCanvasElement {
  const iw = bitmap.width;
  const ih = bitmap.height;
  const canvasAspect = targetW / targetH;
  const imgAspect = iw / ih;

  let sx = 0;
  let sy = 0;
  let sw = iw;
  let sh = ih;

  if (imgAspect > canvasAspect) {
    sw = ih * canvasAspect;
    sx = (iw - sw) / 2;
  } else {
    sh = iw / canvasAspect;
    sy = (ih - sh) / 2;
  }

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');
  ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, targetW, targetH);
  return canvas;
}

/**
 * Reads an image file, center-crops to 21:9, exports JPEG. Keeps output size reasonable for storing in `banner_url`.
 */
export async function imageFileToBannerDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Choose an image file.');
  }
  const bitmap = await createImageBitmap(file);
  try {
    const targetH = Math.round(TARGET_WIDTH / BANNER_ASPECT);
    const canvas = coverCropToCanvas(bitmap, TARGET_WIDTH, targetH);

    const maxChars = 3_500_000;
    let quality = 0.88;
    for (let i = 0; i < 12; i++) {
      const url = canvas.toDataURL('image/jpeg', quality);
      if (url.length <= maxChars || quality <= 0.42) return url;
      quality -= 0.05;
    }
    return canvas.toDataURL('image/jpeg', 0.4);
  } finally {
    bitmap.close();
  }
}
