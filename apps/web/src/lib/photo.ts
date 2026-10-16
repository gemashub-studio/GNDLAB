'use client';

/** Rasio potret 3:4 (lebar:tinggi) untuk foto pencatatan & progres (DEC-088). */
export const PORTRAIT = 3 / 4;

/**
 * Foto → JPEG data URL diperkecil (sisi terpanjang ≤ `max` px). `portrait` = dipotong di tengah menjadi 3:4.
 * Gagal dibaca → undefined.
 */
export function photoDataUrl(file: Blob, max = 1000, quality = 0.82, portrait = false): Promise<string | undefined> {
  return new Promise((res) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        // potong tengah ke 3:4 bila diminta (foto lanskap → bagian tengahnya)
        let sx = 0;
        let sy = 0;
        let sw = img.naturalWidth;
        let sh = img.naturalHeight;
        if (portrait) {
          if (sw / sh > PORTRAIT) {
            const w = Math.round(sh * PORTRAIT);
            sx = Math.round((sw - w) / 2);
            sw = w;
          } else {
            const h = Math.round(sw / PORTRAIT);
            sy = Math.round((sh - h) / 2);
            sh = h;
          }
        }
        const k = Math.min(1, max / Math.max(sw, sh));
        const c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(sw * k));
        c.height = Math.max(1, Math.round(sh * k));
        c.getContext('2d')!.drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height);
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
