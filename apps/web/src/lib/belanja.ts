/**
 * LAPORAN BELANJA / Lembar Pertanggungjawaban (LPJ) anggaran R&D (DEC-059) — mengikuti contoh owner
 * "LPJ_PR_Request_RnD_Kora": surat memo + bukti per alokasi (nota & foto barang) + Lampiran 1 rincian
 * alokasi (harga dasar × faktor) + Lampiran 2 timeline. Semua angka diisi pengguna; aplikasi hanya
 * menjumlah, menulis terbilang, dan menghitung hari. Tersimpan di perangkat (IndexedDB gemas-belanja).
 */
import { openDB, type DBSchema } from 'idb';

export interface LpjPhoto {
  id: string;
  name: string;
  /** JPEG data URL (diperkecil, sisi terpanjang ≤ 1400 px). */
  dataUrl: string;
}

export interface LpjProof {
  title: string;
  /** Total alokasi bukti ini (Rp, teks isian). */
  total: string;
  description: string;
  receipts: LpjPhoto[];
  goods: LpjPhoto[];
}

export interface LpjItem {
  category: string;
  name: string;
  qty: string;
  unit: string;
  basePrice: string;
  /** 1 = harga dasar + batas atas (markup %); 0 = harga dasar dipakai langsung. */
  factor: 0 | 1;
}

export interface LpjSection {
  title: string;
  intro: string;
  items: LpjItem[];
  note: string;
}

export interface LpjActivity {
  activity: string;
  start: string;
  end: string;
}

export interface LpjReport {
  id: string;
  createdAt: string;
  updatedAt: string;
  memoLabel: string;
  refNo: string;
  letterNo: string;
  city: string;
  date: string;
  subject: string;
  attachment: string;
  recipient: string;
  recipientPlace: string;
  purpose: string;
  budget: string;
  proofs: LpjProof[];
  closingCity: string;
  closingDate: string;
  signers: { name: string; role: string }[];
  /** Batas atas untuk faktor 1, dalam persen (contoh owner: 50). */
  markupPct: string;
  appendixIntro: string;
  sections: LpjSection[];
  reconciliationNote: string;
  timelineIntro: string;
  timeline: LpjActivity[];
  timelineNote: string;
  output: string;
}

// ------------------------------------------------------------------ hitungan (murni)

/** Rupiah isian ("10.000", "Rp 1.250.000", "18000") → angka bulat; kosong/tak terbaca → 0. */
export function parseRp(v: string): number {
  const d = v.replace(/,\d{1,2}$/, '').replace(/[^\d-]/g, '');
  const n = Number(d);
  return d && Number.isFinite(n) ? n : 0;
}

/** Jumlah beli ("40", "0,5", "-") → angka; tak terbaca → 0. */
export function parseQty(v: string): number {
  const s = v.trim().replace(/\./g, '').replace(',', '.');
  const n = Number(s);
  return s && Number.isFinite(n) ? n : 0;
}

export const fmtRp = (n: number) => `Rp${Math.round(n).toLocaleString('id-ID')}`;
export const fmtInt = (n: number) => Math.round(n).toLocaleString('id-ID');

export function usedPrice(it: LpjItem, markupPct: string): number {
  const base = parseRp(it.basePrice);
  return it.factor === 1 ? Math.round(base * (1 + parseQty(markupPct) / 100)) : base;
}

export const itemTotal = (it: LpjItem, markupPct: string) => Math.round(parseQty(it.qty) * usedPrice(it, markupPct));

/** Subtotal per alokasi (urutan kemunculan) untuk satu bagian. */
export function subtotals(sec: LpjSection, markupPct: string): [string, number][] {
  const m = new Map<string, number>();
  for (const it of sec.items) m.set(it.category || 'Lainnya', (m.get(it.category || 'Lainnya') ?? 0) + itemTotal(it, markupPct));
  return [...m.entries()];
}

export const sectionTotal = (sec: LpjSection, markupPct: string) => sec.items.reduce((n, it) => n + itemTotal(it, markupPct), 0);
export const allocationTotal = (r: LpjReport) => r.sections.reduce((n, s) => n + sectionTotal(s, r.markupPct), 0);
export const realizationTotal = (r: LpjReport) => r.proofs.reduce((n, p) => n + parseRp(p.total), 0);

/** Jumlah hari inklusif (mulai & selesai dihitung); tanggal tak lengkap → undefined. */
export function daysInclusive(start: string, end: string): number | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) return undefined;
  const d = Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000);
  return d >= 0 ? d + 1 : undefined;
}

/** "2026-10-08" → "8 Oktober 2026"; selain format itu dikembalikan apa adanya. */
export function tanggalPanjang(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  const bulan = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  return `${Number(m[3])} ${bulan[Number(m[2]) - 1]} ${m[1]}`;
}

export const tanggalPendek = (iso: string) => (/^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso.split('-').reverse().join('/') : iso);

const SATUAN = ['', 'Satu', 'Dua', 'Tiga', 'Empat', 'Lima', 'Enam', 'Tujuh', 'Delapan', 'Sembilan', 'Sepuluh', 'Sebelas'];

function terbilangRaw(n: number): string {
  if (n < 12) return SATUAN[n]!;
  if (n < 20) return `${SATUAN[n - 10]} Belas`;
  if (n < 100) return `${SATUAN[Math.floor(n / 10)]} Puluh ${terbilangRaw(n % 10)}`;
  if (n < 200) return `Seratus ${terbilangRaw(n - 100)}`;
  if (n < 1000) return `${SATUAN[Math.floor(n / 100)]} Ratus ${terbilangRaw(n % 100)}`;
  if (n < 2000) return `Seribu ${terbilangRaw(n - 1000)}`;
  if (n < 1e6) return `${terbilangRaw(Math.floor(n / 1000))} Ribu ${terbilangRaw(n % 1000)}`;
  if (n < 1e9) return `${terbilangRaw(Math.floor(n / 1e6))} Juta ${terbilangRaw(n % 1e6)}`;
  if (n < 1e12) return `${terbilangRaw(Math.floor(n / 1e9))} Miliar ${terbilangRaw(n % 1e9)}`;
  return `${terbilangRaw(Math.floor(n / 1e12))} Triliun ${terbilangRaw(n % 1e12)}`;
}

/** Terbilang rupiah: 5876200 → "Lima Juta Delapan Ratus Tujuh Puluh Enam Ribu Dua Ratus Rupiah". */
export function terbilang(n: number): string {
  const v = Math.round(Math.abs(n));
  const words = v === 0 ? 'Nol' : terbilangRaw(v).replace(/\s+/g, ' ').trim();
  return `${n < 0 ? 'Minus ' : ''}${words} Rupiah`;
}

// ------------------------------------------------------------------ bentuk awal

export const blankItem = (category = ''): LpjItem => ({ category, name: '', qty: '', unit: '', basePrice: '', factor: 1 });
export const blankProof = (): LpjProof => ({ title: '', total: '', description: '', receipts: [], goods: [] });

export function newLpj(id: string, now = new Date()): LpjReport {
  const today = now.toISOString().slice(0, 10);
  return {
    id,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    memoLabel: 'INTERNAL OF MEMO',
    refNo: '',
    letterNo: '',
    city: '',
    date: today,
    subject: 'Pertanggungjawaban Penggunaan / Alokasi Anggaran',
    attachment: 'Bukti-bukti dan Keluaran',
    recipient: '',
    recipientPlace: 'Tempat',
    purpose: 'R&D Produk : ',
    budget: '',
    proofs: [blankProof()],
    closingCity: '',
    closingDate: today,
    signers: [
      { name: '', role: '' },
      { name: '', role: '' },
    ],
    markupPct: '50',
    appendixIntro: '',
    sections: [{ title: 'Bahan', intro: '', items: [blankItem()], note: '' }],
    reconciliationNote: '',
    timelineIntro: '',
    timeline: [{ activity: '', start: '', end: '' }],
    timelineNote: '',
    output: '',
  };
}

// ------------------------------------------------------------------ penyimpanan

interface BelanjaDb extends DBSchema {
  reports: { key: string; value: LpjReport };
}

let dbp: ReturnType<typeof openDB<BelanjaDb>> | undefined;
export const belanjaDb = () =>
  (dbp ??= openDB<BelanjaDb>('gemas-belanja', 1, {
    upgrade(d) {
      d.createObjectStore('reports', { keyPath: 'id' });
    },
  }));

export async function listLpj(): Promise<LpjReport[]> {
  return (await (await belanjaDb()).getAll('reports')).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function saveLpj(r: LpjReport): Promise<void> {
  await (await belanjaDb()).put('reports', { ...r, updatedAt: new Date().toISOString() });
}

export async function deleteLpj(id: string): Promise<void> {
  await (await belanjaDb()).delete('reports', id);
}

/** ID berikutnya: LPJ-YYYYMM-NN. */
export function nextLpjId(existing: readonly string[], now = new Date()): string {
  const p = `LPJ-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}-`;
  const n = existing.filter((x) => x.startsWith(p)).map((x) => Number(x.slice(p.length)) || 0);
  return `${p}${String(Math.max(0, ...n) + 1).padStart(2, '0')}`;
}
