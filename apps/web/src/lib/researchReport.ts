/**
 * Laporan RISET PRODUK (DEC-052): satu model isi → PDF, DOCX, PPTX (isi sama). Urutan awal → akhir:
 * identitas → komposisi (+foto) → alat → langkah (+foto) → riwayat versi → laporan harian → penutup.
 * Hanya dari data tercatat; kosong = "belum dicatat".
 */
import { LAB_PRODUCTS, NOT_RECORDED, researchStatus, toolList, type DailyEntry, type MediaItem, type ProtocolVersion } from './labStore';

export interface ReportImage {
  name: string;
  caption: string;
  /** JPEG data URL (thumbnail); kosong bila tak ada pratinjau. */
  dataUrl: string;
  video: boolean;
}

export interface ReportBlock {
  heading: string;
  /** Tingkat judul: 1 = bagian, 2 = sub-bagian. */
  level: 1 | 2;
  lines: string[];
  table?: { head: string[]; rows: string[][] };
  images: ReportImage[];
}

export interface ResearchReport {
  title: string;
  subtitle: string;
  generatedAt: string;
  blocks: ReportBlock[];
  footer: string;
}

const productName = (id: string) => LAB_PRODUCTS.find((p) => p.id === id)?.name ?? id;
const or = (v: string | undefined) => (v && v.trim() ? v.trim() : NOT_RECORDED);
const img = (m: MediaItem): ReportImage => ({ name: m.name, caption: m.caption, dataUrl: m.thumb, video: m.type.startsWith('video/') });
const STATUS: Record<ReturnType<typeof researchStatus>, string> = { 'belum-mulai': 'Belum ada laporan harian', berjalan: 'Berjalan', selesai: 'SELESAI' };

export function buildResearchReport(key: string, versions: readonly ProtocolVersion[], entries: readonly DailyEntry[], media: readonly MediaItem[], generatedAt = new Date().toLocaleString('id-ID')): ResearchReport {
  const vs = [...versions].filter((v) => v.key === key).sort((a, b) => a.version - b.version);
  const latest = vs[vs.length - 1];
  if (!latest) throw new RangeError(`Riset ${key} tidak ditemukan`);
  const days = [...entries].filter((e) => e.experimentId === key).sort((a, b) => a.entryDate.localeCompare(b.entryDate) || a.createdAt.localeCompare(b.createdAt));
  const byId = new Map(media.map((m) => [m.id, m]));
  const pics = (ids?: string[]) => (ids ?? []).map((id) => byId.get(id)).filter((m): m is MediaItem => !!m).map(img);
  const status = researchStatus(days);

  const blocks: ReportBlock[] = [
    {
      heading: 'Identitas riset',
      level: 1,
      lines: [
        `Kode: ${key} · Produk: ${productName(latest.product)}`,
        `Status: ${STATUS[status]}`,
        `Versi terakhir: ${latest.id} (${latest.createdAt.slice(0, 10)}) · oleh ${or(latest.author)}`,
        `Mulai: ${vs[0]!.createdAt.slice(0, 10)} · Laporan harian: ${days.length}`,
      ],
      images: [],
    },
    {
      heading: `Komposisi bahan (versi ${latest.version})`,
      level: 1,
      lines: latest.ingredients.length ? [] : [NOT_RECORDED],
      ...(latest.ingredients.length && { table: { head: ['No', 'Bahan', 'Jumlah', 'Satuan'], rows: latest.ingredients.map((x, i) => [String(i + 1), x.name, x.amount || '–', x.unit || '–']) } }),
      images: latest.ingredients.flatMap((x, i) => pics(x.mediaIds).map((p) => ({ ...p, caption: `Bahan ${i + 1} · ${x.name}${p.caption ? ` — ${p.caption}` : ''}` }))),
    },
    {
      heading: 'Alat yang digunakan',
      level: 1,
      lines: toolList(latest).length ? [] : [NOT_RECORDED],
      ...(toolList(latest).length && { table: { head: ['No', 'Alat', 'Jumlah', 'Satuan'], rows: toolList(latest).map((t, i) => [String(i + 1), t.name, t.amount || '–', t.unit || '–']) } }),
      images: toolList(latest).flatMap((t) => pics(t.mediaIds).map((p) => ({ ...p, caption: `Alat · ${t.name}${p.caption ? ` — ${p.caption}` : ''}` }))),
    },
    {
      heading: 'Urutan langkah',
      level: 1,
      lines: latest.steps.length ? latest.steps.map((st, i) => `${i + 1}. ${st.text}${st.duration ? ` · ${st.duration}` : ''}${st.conditions ? ` · ${st.conditions}` : ''}`) : [NOT_RECORDED],
      images: latest.steps.flatMap((st, i) => pics(st.mediaIds).map((p) => ({ ...p, caption: `Langkah ${i + 1}${p.caption ? ` — ${p.caption}` : ''}` }))),
    },
    {
      heading: 'Riwayat versi',
      level: 1,
      lines: [],
      table: { head: ['Versi', 'Tanggal', 'Oleh', 'Alasan perubahan'], rows: vs.map((v) => [v.id, v.createdAt.slice(0, 10), or(v.author), or(v.reason)]) },
      images: [],
    },
    { heading: 'Laporan harian', level: 1, lines: days.length ? [] : ['Belum ada laporan harian.'], images: [] },
    ...days.map<ReportBlock>((d) => ({
      heading: `${d.entryDate} · ${d.id}${d.finished ? ' · LAPORAN PENUTUP (SELESAI)' : ''}`,
      level: 2,
      lines: [
        ...(d.protocolId ? [`Versi resep: ${d.protocolId}`] : []),
        `Rencana: ${or(d.plan)}`,
        `Realisasi: ${or(d.actual)}`,
        ...(d.materials.length ? [`Bahan & batch: ${d.materials.map((m) => `${m.name} ${m.amount} ${m.unit}${m.batch ? ` (${m.batch})` : ''}`.trim()).join('; ')}`] : []),
        ...(d.tools ? [`Alat: ${d.tools}`] : []),
        ...(d.conditions ? [`Kondisi: ${d.conditions}`] : []),
        `Penyimpangan: ${or(d.deviations)}`,
        `Interpretasi sementara: ${or(d.interpretation)}`,
        `Langkah berikutnya: ${or(d.nextStep)}`,
      ],
      ...(d.measurements.length && {
        table: { head: ['Waktu', 'Variabel', 'Nilai', 'Satuan', 'Kelompok'], rows: d.measurements.map((m) => [m.at.replace('T', ' '), m.name, m.value, m.unit, m.group || '–']) },
      }),
      images: pics(d.mediaIds),
    })),
    {
      heading: 'Penutup',
      level: 1,
      lines: [
        status === 'selesai' ? 'Riset ditandai SELESAI oleh pengguna.' : 'Riset belum ditandai selesai.',
        'Isi laporan = catatan pengguna. Tidak ada saran AI; bukan klaim produk aman, memenuhi standar, atau siap jual.',
        'Video asli tersimpan di aplikasi & file cadangan; di laporan hanya gambar pratinjau dan nama berkas.',
      ],
      images: [],
    },
  ];
  return { title: `Riset Produk — ${latest.name}`, subtitle: `${key} · ${productName(latest.product)} · ${STATUS[status]}`, generatedAt, blocks, footer: `GEMA RnD Lab · dibuat ${generatedAt}` };
}
