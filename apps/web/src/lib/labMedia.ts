'use client';

/** Pratinjau kecil foto/video untuk layar & PDF (data URL JPEG). Gagal → string kosong, berkas asli tetap disimpan. */
const MAX = 480;

function drawToJpeg(src: CanvasImageSource, w: number, h: number): string {
  const k = Math.min(1, MAX / Math.max(w, h));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w * k));
  c.height = Math.max(1, Math.round(h * k));
  c.getContext('2d')!.drawImage(src, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.8);
}

function imageThumb(file: Blob): Promise<string> {
  return new Promise((res) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        res(drawToJpeg(img, img.naturalWidth, img.naturalHeight));
      } catch {
        res('');
      }
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      res('');
    };
    img.src = url;
  });
}

function videoThumb(file: Blob): Promise<string> {
  return new Promise((res) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement('video');
    const done = (s: string) => {
      URL.revokeObjectURL(url);
      res(s);
    };
    const timer = setTimeout(() => done(''), 8000);
    v.muted = true;
    v.playsInline = true;
    v.preload = 'auto';
    v.onloadeddata = () => {
      v.currentTime = Math.min(0.5, (v.duration || 1) / 2);
    };
    v.onseeked = () => {
      clearTimeout(timer);
      try {
        done(drawToJpeg(v, v.videoWidth, v.videoHeight));
      } catch {
        done('');
      }
    };
    v.onerror = () => {
      clearTimeout(timer);
      done('');
    };
    v.src = url;
  });
}

export function makeThumb(file: Blob): Promise<string> {
  if (file.type.startsWith('image/')) return imageThumb(file);
  if (file.type.startsWith('video/')) return videoThumb(file);
  return Promise.resolve('');
}

export const fmtBytes = (n: number) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1).replace('.', ',')} MB`);

export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
