'use client';

/** Foto → JPEG data URL diperkecil (sisi terpanjang ≤ `max` px). Gagal dibaca → undefined. */
export function photoDataUrl(file: Blob, max = 1000, quality = 0.82): Promise<string | undefined> {
  return new Promise((res) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
        const c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(img.naturalWidth * k));
        c.height = Math.max(1, Math.round(img.naturalHeight * k));
        c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
        res(c.toDataURL('image/jpeg', quality));
      } catch {
        res(undefined);
      } finally {
        URL.revokeObjectURL(url);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      res(undefined);
    };
    img.src = url;
  });
}
