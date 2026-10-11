/**
 * Library sumber GEMA RnD — SUMBER KEBENARAN; architecture/07-rnd/library/sumber/sources.md dibangkitkan
 * dari file JSON ini (scripts/gen_gema_sources.py; uji unit memastikan sinkron). Bukan angka produk:
 * hanya identitas, kategori, ruang lingkup & status sumber.
 */
import data from '@/data/gemaSources.json';
import type { LabProductId } from './labStore';

export type SourceStatus = 'diperiksa' | 'dilaporkan' | 'belum-diperiksa';

export type SourceCategory = keyof typeof data.categories;

export interface GemaSource {
  id: string;
  category: SourceCategory;
  /** Ruang lingkup standar/sumber. */
  scope: string;
  /** Parameter yang diatur (atau "belum dibaca"). */
  regulates: string;
  title: string;
  org: string;
  year: string;
  kind: string;
  url: string;
  accessed: string;
  status: SourceStatus;
  products: LabProductId[];
  supports: string;
  limits: string;
}

export interface ProductDossier {
  standards: string[];
  evidence: string;
  notYet: string;
  questions: string[];
  dossier: string;
}

export const SOURCE_STATUS: { id: SourceStatus; label: string; hint: string }[] = [
  { id: 'diperiksa', label: 'Diperiksa', hint: 'Halaman resmi dibuka sendiri pada tanggal akses' },
  { id: 'dilaporkan', label: 'Dilaporkan', hint: 'Disebut penelusuran awal, belum bisa dikonfirmasi ulang' },
  { id: 'belum-diperiksa', label: 'Belum diperiksa', hint: 'Belum dibuka' },
];

export const GEMA_SOURCES = data.sources as GemaSource[];
export const SOURCE_CATEGORIES = data.categories as Record<SourceCategory, string>;
export const GEMA_DOSSIERS = data.products as Record<LabProductId, ProductDossier>;
export const GEMA_SOURCES_CHECKED = data.checkedAt;
export const GEMA_SOURCES_DOC = data.doc;

export const sourceById = (id: string) => GEMA_SOURCES.find((s) => s.id === id);

export function sourceCounts(sources: readonly GemaSource[] = GEMA_SOURCES): Record<SourceStatus, number> {
  const c: Record<SourceStatus, number> = { diperiksa: 0, dilaporkan: 0, 'belum-diperiksa': 0 };
  for (const s of sources) c[s.status]++;
  return c;
}
