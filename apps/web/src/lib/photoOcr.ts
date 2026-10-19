/**
 * Baca teks dari foto (OCR, DEC-097) untuk Tanya Lab AI — tesseract.js, bahasa Indonesia (huruf latin; kata Inggris tetap
 * terbaca). Satu pengenal teks dipakai ulang (pemakaian kedua jauh lebih cepat) dan setiap pembacaan diberi batas waktu
 * supaya tidak pernah macet: lewat batas / galat → pengenal ditutup & dibuat ulang pada pemakaian berikutnya.
 * Model bahasa (±1,2 MB) dan mesin OCR diunduh dari CDN jsDelivr saat pertama dipakai.
 */
import type { Worker } from 'tesseract.js';

export const OCR_TIMEOUT_MS = 90_000;
const MAX_SIDE = 1600;

const readFile = (f: File) =>
  new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = () => rej(r.error ?? new Error('Foto tidak bisa dibaca.'));
    r.readAsDataURL(f);
  });

const loadImg = (src: string) =>
  new Promise<HTMLImageElement>((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => rej(new Error('Foto tidak bisa dibuka.'));
    img.src = src;
  });

/** Foto → JPEG data URL dengan sisi terpanjang ≤ 1600 px (cukup tajam untuk OCR, ringan untuk pratinjau). */
export async function prepPhoto(f: File): Promise<string> {
  if (!f.type.startsWith('image/')) throw new Error('Pilih file gambar (foto).');
  const src = await readFile(f);
  const img = await loadImg(src);
  const k = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight, 1));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(img.naturalWidth * k));
  c.height = Math.max(1, Math.round(img.naturalHeight * k));
  const g = c.getContext('2d')!;
  g.fillStyle = '#fff';
  g.fillRect(0, 0, c.width, c.height);
  g.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.9);
}

/** Rapikan keluaran OCR: spasi di ujung baris, baris kosong berlebih. */
export const cleanOcr = (t: string) => t.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();

type Progress = (pct: number, status: string) => void;
let listener: Progress | undefined;
let workerP: Promise<Worker> | undefined;
let queue: Promise<unknown> = Promise.resolve();

function getWorker(): Promise<Worker> {
  workerP ??= import('tesseract.js')
    .then(({ createWorker }) =>
      createWorker('ind', 1, {
        logger: (m: { status: string; progress: number }) => {
          const reading = m.status === 'recognizing text';
          listener?.(Math.round((reading ? 0.3 + m.progress * 0.7 : m.progress * 0.3) * 100), reading ? 'membaca teks foto' : 'menyiapkan pembaca teks');
        },
        errorHandler: () => reset(),
      }),
    )
    .catch((e: unknown) => {
      workerP = undefined;
      throw e;
    });
  return workerP;
}

function reset() {
  const w = workerP;
  workerP = undefined;
  void w?.then((x) => x.terminate()).catch(() => undefined);
}

/** Baca teks dari satu foto (berurutan bila ada beberapa). Selalu selesai: teks, atau galat dalam ≤ `timeoutMs`. */
export function ocrPhoto(dataUrl: string, onProgress?: Progress, timeoutMs = OCR_TIMEOUT_MS): Promise<string> {
  const job = queue.then(async () => {
    listener = onProgress;
    onProgress?.(0, 'menyiapkan pembaca teks');
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const run = getWorker().then((w) => w.recognize(dataUrl));
      const timeout = new Promise<never>((_, rej) => {
        timer = setTimeout(() => {
          reset();
          rej(new Error('Membaca teks foto terlalu lama. Periksa koneksi internet (pembaca teks diunduh saat pertama dipakai) lalu coba lagi.'));
        }, timeoutMs);
      });
      const { data } = await Promise.race([run, timeout]);
      onProgress?.(100, 'selesai');
      return cleanOcr(data.text);
    } catch (e) {
      if (e instanceof Error && e.message.startsWith('Membaca teks foto terlalu lama')) throw e;
      reset();
      throw new Error('Teks foto gagal dibaca. Periksa koneksi internet lalu coba lagi.');
    } finally {
      clearTimeout(timer);
      if (listener === onProgress) listener = undefined;
    }
  });
  queue = job.catch(() => undefined);
  return job;
}
