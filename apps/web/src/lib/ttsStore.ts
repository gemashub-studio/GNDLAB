/**
 * Simpanan suara TTS di perangkat (DEC-139): setiap suara yang sudah dibuat Groq (asisten kelapa & jawaban Lab AI)
 * disimpan di IndexedDB `gnd-tts`, kunci = suara + teks persis. Kalimat yang sama berikutnya diputar dari simpanan
 * tanpa memanggil /api/voice-tts lagi (hemat limit Groq). Simpanan dibatasi jumlah & ukuran; yang paling lama tidak
 * dipakai dibuang lebih dulu. Semua akses dibungkus try/catch: tanpa IndexedDB (mode privat, SSR) suara tetap jalan.
 */
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

export const TTS_MAX_CLIPS = 400;
export const TTS_MAX_BYTES = 40 * 1024 * 1024;

export interface TtsClip {
  key: string;
  blob: Blob;
  size: number;
  usedAt: number;
}
export type ClipMeta = Pick<TtsClip, 'key' | 'size' | 'usedAt'>;

interface Db extends DBSchema {
  clips: { key: string; value: TtsClip; indexes: { usedAt: number } };
}

export const ttsKey = (text: string, voice: string) => `${voice}|${text.replace(/\s+/g, ' ').trim()}`;

/** Kunci yang harus dibuang agar jumlah ≤ maxClips dan total ukuran ≤ maxBytes (paling lama tidak dipakai dulu). */
export function evictions(clips: readonly ClipMeta[], maxClips = TTS_MAX_CLIPS, maxBytes = TTS_MAX_BYTES): string[] {
  const sorted = [...clips].sort((a, b) => a.usedAt - b.usedAt);
  let count = sorted.length;
  let bytes = sorted.reduce((s, c) => s + c.size, 0);
  const out: string[] = [];
  for (const c of sorted) {
    if (count <= maxClips && bytes <= maxBytes) break;
    out.push(c.key);
    count--;
    bytes -= c.size;
  }
  return out;
}

let dbp: Promise<IDBPDatabase<Db>> | undefined;
const db = () =>
  (dbp ??= openDB<Db>('gnd-tts', 1, {
    upgrade(d) {
      d.createObjectStore('clips', { keyPath: 'key' }).createIndex('usedAt', 'usedAt');
    },
  }));
const usable = () => typeof indexedDB !== 'undefined';

/** Suara tersimpan untuk kunci ini (waktu pakai diperbarui), atau undefined. */
export async function loadClip(key: string): Promise<Blob | undefined> {
  if (!usable()) return undefined;
  try {
    const d = await db();
    const c = await d.get('clips', key);
    if (!c) return undefined;
    void d.put('clips', { ...c, usedAt: Date.now() }).catch(() => undefined);
    return c.blob;
  } catch {
    return undefined;
  }
}

/** Simpan suara baru lalu buang yang terlama bila melewati batas. */
export async function saveClip(key: string, blob: Blob): Promise<void> {
  if (!usable() || !blob.size) return;
  try {
    const d = await db();
    await d.put('clips', { key, blob, size: blob.size, usedAt: Date.now() });
    const all = await d.getAll('clips');
    const drop = evictions(all.map(({ key: k, size, usedAt }) => ({ key: k, size, usedAt })));
    if (drop.length) {
      const tx = d.transaction('clips', 'readwrite');
      await Promise.all([...drop.map((k) => tx.store.delete(k)), tx.done]);
    }
  } catch {
    /* penyimpanan penuh / diblokir → suara tetap diputar, hanya tidak disimpan */
  }
}

/** Jumlah suara tersimpan (untuk uji & info). */
export async function clipCount(): Promise<number> {
  if (!usable()) return 0;
  try {
    return await (await db()).count('clips');
  } catch {
    return 0;
  }
}
