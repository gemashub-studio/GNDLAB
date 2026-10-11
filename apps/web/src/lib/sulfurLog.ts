'use client';

/**
 * Log perlakuan sulfur kopra (DEC-048) — pencatatan MANUAL, append-only, di perangkat (IndexedDB
 * `gemas-perlakuan`). Aplikasi tidak menyarankan atau menghitung dosis: jumlah, satuan, dan dasar
 * penentuannya diisi pengguna apa adanya.
 */
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

export const SULFUR_FORMS = ['Belerang dibakar (asap)', 'Larutan sulfit/bisulfit (rendam)', 'Lainnya'] as const;
export type SulfurForm = (typeof SULFUR_FORMS)[number];

export interface SulfurRecord {
  /** Mis. S-261011-01. */
  id: string;
  /** Mulai (YYYY-MM-DDTHH:mm). */
  startedAt: string;
  endedAt: string;
  lotCode: string;
  /** Jumlah kelapa/belahan yang diberi perlakuan — teks apa adanya. */
  load: string;
  place: string;
  form: SulfurForm;
  /** Jumlah dipakai — teks apa adanya + satuan. */
  amount: string;
  unit: string;
  /** Dasar penentuan jumlah (keputusan siapa / sumber apa). Wajib. */
  basis: string;
  operator: string;
  ppe: string;
  residueResult: string;
  residueLab: string;
  note: string;
  createdAt: string;
}

/** ID berikutnya per tanggal mulai: S-YYMMDD-01, -02, … */
export function nextSulfurId(startedAt: string, existing: readonly string[]): string | undefined {
  const m = /^\d{2}(\d{2})-(\d{2})-(\d{2})/.exec(startedAt);
  if (!m) return undefined;
  const prefix = `S-${m[1]}${m[2]}${m[3]}-`;
  const max = existing.filter((id) => id.startsWith(prefix)).reduce((n, id) => Math.max(n, Number(id.slice(prefix.length)) || 0), 0);
  return `${prefix}${String(max + 1).padStart(2, '0')}`;
}

/** Field wajib yang belum diisi (nama ramah). */
export function missingSulfurFields(r: Pick<SulfurRecord, 'startedAt' | 'amount' | 'unit' | 'basis' | 'form'>): string[] {
  const miss: string[] = [];
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(r.startedAt)) miss.push('waktu mulai');
  if (!r.amount.trim()) miss.push('jumlah dipakai');
  if (!r.unit.trim()) miss.push('satuan');
  if (!r.basis.trim()) miss.push('dasar penentuan jumlah');
  return miss;
}

interface Db extends DBSchema {
  sulfur: { key: string; value: SulfurRecord; indexes: { startedAt: string } };
}

let dbp: Promise<IDBPDatabase<Db>> | undefined;
const db = () =>
  (dbp ??= openDB<Db>('gemas-perlakuan', 1, {
    upgrade(d) {
      d.createObjectStore('sulfur', { keyPath: 'id' }).createIndex('startedAt', 'startedAt');
    },
  }));

/** Tambah catatan baru (gagal bila ID sudah ada — tidak menimpa). Tidak ada fungsi ubah/hapus. */
export async function addSulfurRecord(r: Omit<SulfurRecord, 'createdAt'>): Promise<void> {
  await (await db()).add('sulfur', { ...r, createdAt: new Date().toISOString() });
}

export async function listSulfurRecords(): Promise<SulfurRecord[]> {
  return (await (await db()).getAllFromIndex('sulfur', 'startedAt')).reverse();
}

const esc = (v: string) => (/[",\n;]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

export function sulfurCsv(rows: readonly SulfurRecord[]): string {
  const head = ['id', 'mulai', 'selesai', 'kode_lot', 'muatan', 'tempat', 'bentuk', 'jumlah', 'satuan', 'dasar_penentuan', 'petugas', 'apd', 'hasil_residu', 'lab', 'catatan', 'dicatat'];
  const body = rows.map((r) =>
    [r.id, r.startedAt, r.endedAt, r.lotCode, r.load, r.place, r.form, r.amount, r.unit, r.basis, r.operator, r.ppe, r.residueResult, r.residueLab, r.note, r.createdAt].map(esc).join(','),
  );
  return [head.join(','), ...body].join('\n') + '\n';
}
