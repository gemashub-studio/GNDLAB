/**
 * Laporan RISET PRODUK (DEC-052): satu model isi → PDF, DOCX, PPTX (isi sama). Urutan awal → akhir:
 * identitas → ringkasan hasil & grafik (DEC-058) → komposisi (+foto) → alat → langkah (+foto) → riwayat versi → laporan harian → penutup.
 * Hanya dari data tercatat; kosong = "belum dicatat".
 */
import { fmtNum, researchCharts, type ChartSpec } from './reportCharts';
import { coconutSummary, dayNumber, protocolProductName, TREATMENT_LABEL, type CoconutRow, type RawMaterial, NOT_RECORDED, researchDates, researchStatus, toolList, type DailyEntry, type MediaItem, type ProtocolVersion } from './labStore';

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
  /** Grafik (DEC-058) — digambar dari spesifikasi yang sama di PDF/DOCX/PPTX. */
  charts?: ChartSpec[];
}

export interface ReportCover {
  code: string;
  product: string;
  status: string;
  done: boolean;
  /** [label, nilai] untuk kisi identitas di sampul. */
  meta: [string, string][];
  image?: ReportImage;
}

export interface ReportKpi {
  label: string;
  value: string;
}

export interface ResearchReport {
  title: string;
  subtitle: string;
  generatedAt: string;
  cover: ReportCover;
  kpis: ReportKpi[];
  blocks: ReportBlock[];
  footer: string;
}

const or = (v: string | undefined) => (v && v.trim() ? v.trim() : NOT_RECORDED);
const img = (m: MediaItem): ReportImage => ({ name: m.name, caption: m.caption, dataUrl: m.thumb, video: m.type.startsWith('video/') });
const STATUS: Record<ReturnType<typeof researchStatus>, string> = { 'belum-mulai': 'Belum ada laporan harian', berjalan: 'Berjalan', selesai: 'SELESAI' };

/** Bahan baku dari menu Bahan Baku (DEC-068), + riset rujukan (knowledge) milik pengguna. */
function rawBlock(r: RawMaterial, versions: readonly ProtocolVersion[]): ReportBlock {
  const d = (v: string) => (v.trim() ? v.trim() : NOT_RECORDED);
  const name = (k: string) => [...versions].filter((v) => v.key === k).sort((a, b) => b.version - a.version)[0]?.name;
  return {
    heading: 'Bahan baku',
    level: 1,
    lines: [
      `Item: ${d(r.item)}`,
      `Barang: ${d(r.name)}`,
      `Perlakuan: ${TREATMENT_LABEL[r.treatment]}`,
      `Berat utuh (g): ${d(r.wholeWeight)}`,
      `Air (mL): ${d(r.water)}`,
      ...(r.thickness === 'tebal-daging' ? [`Tebal daging (mm): ${d(r.meatThickness)}`] : []),
      ...(r.refKeys.length ? [`Rujukan riset: ${r.refKeys.map((k) => `${k}${name(k) ? ` (${name(k)})` : ''}`).join('; ')}`] : []),
    ],
    images: [],
  };
}

/** Penghitungan bahan baku kelapa (DEC-064): tabel ukur + ringkasan, lalu tabel proses & hasil + foto. */
function coconutBlocks(rows: CoconutRow[], pics: (ids?: string[]) => ReportImage[]): ReportBlock[] {
  const d = (v: string) => v.trim() || '–';
  const f = (v?: number) => (v === undefined ? '–' : fmtNum(v));
  return [
    {
      heading: 'Bahan baku kelapa — berat & ukuran',
      level: 1,
      lines: coconutSummary(rows).map((st) => `${st.label} (${st.unit}): ${st.n ? `${st.total !== undefined ? `jumlah ${f(st.total)} · ` : ''}rata-rata ${f(st.mean)} (n = ${st.n})` : 'belum dicatat'}`),
      table: {
        head: ['Bahan', 'Utuh awal (g)', 'Utuh akhir (g)', 'Air (g)', 'Air (mL)', 'Tebal awal (mm)', 'Tebal akhir (mm)'],
        rows: rows.map((r) => [r.name, d(r.wholeStart), d(r.wholeEnd), d(r.waterWeight), d(r.waterVolume), d(r.meatStart), d(r.meatEnd)]),
      },
      images: [],
    },
    {
      heading: 'Bahan baku kelapa — proses & hasil',
      level: 1,
      lines: [],
      table: { head: ['Bahan', 'Proses air', 'Hasil proses air', 'Proses daging', 'Hasil proses daging'], rows: rows.map((r) => [r.name, d(r.waterProcess), d(r.waterResult), d(r.meatProcess), d(r.meatResult)]) },
      images: rows.flatMap((r) => pics(r.mediaIds).map((p) => ({ ...p, caption: `${r.name}${p.caption ? ` — ${p.caption}` : ''}` }))),
    },
  ];
}

export function buildResearchReport(
  key: string,
  versions: readonly ProtocolVersion[],
  entries: readonly DailyEntry[],
  media: readonly MediaItem[],
  generatedAt = new Date().toLocaleString('id-ID'),
  /** Versi yang dilaporkan (default: terbaru). Riwayat versi = sampai versi ini. */
  versionId?: string,
): ResearchReport {
  const all = [...versions].filter((v) => v.key === key).sort((a, b) => a.version - b.version);
  const chosen = versionId ? all.find((v) => v.id === versionId) : all[all.length - 1];
  if (!chosen) throw new RangeError(`Riset ${versionId ?? key} tidak ditemukan`);
  const vs = all.filter((v) => v.version <= chosen.version);
  const latest = chosen;
  const days = [...entries].filter((e) => e.experimentId === key).sort((a, b) => a.entryDate.localeCompare(b.entryDate) || a.createdAt.localeCompare(b.createdAt));
  const byId = new Map(media.map((m) => [m.id, m]));
  const pics = (ids?: string[]) => (ids ?? []).map((id) => byId.get(id)).filter((m): m is MediaItem => !!m).map(img);
  const status = researchStatus(days);
  const start = latest.startDate ?? vs[0]!.startDate;
  const dates = researchDates(start, days);
  const dayLabel = (date: string) => {
    const n = dayNumber(start, date);
    return n ? `Hari ke-${n} · ` : '';
  };

  const res = researchCharts(start, days);
  const ringkasan: ReportBlock = {
    heading: 'Ringkasan hasil & grafik',
    level: 1,
    lines: res.summary.length ? res.insufficient : ['Belum ada hasil ukur angka di laporan harian — belum ada grafik.'],
    ...(res.summary.length && {
      table: {
        head: ['Variabel', 'Kelompok', 'n', 'Awal', 'Akhir', 'Min', 'Maks'],
        rows: res.summary.map((m) => [`${m.name}${m.unit ? ` (${m.unit})` : ''}`, m.group, String(m.n), `${fmtNum(m.first)} (${m.firstAt})`, `${fmtNum(m.last)} (${m.lastAt})`, fmtNum(m.min), fmtNum(m.max)]),
      },
    }),
    images: [],
    charts: res.charts,
  };

  const blocks: ReportBlock[] = [
    {
      heading: 'Identitas riset',
      level: 1,
      lines: [
        `Kode: ${key} · Produk: ${protocolProductName(latest)}`,
        `Status: ${STATUS[status]}`,
        `Pembuat: ${or(latest.author)} · Asisten: ${latest.assistants?.length ? latest.assistants.join(', ') : NOT_RECORDED}`,
        `Tanggal mulai: ${or(dates.start)} · Tanggal selesai: ${dates.end ? `${dates.end} (otomatis dari laporan penutup)` : 'belum selesai'}${dates.days ? ` · Durasi: ${dates.days} hari` : ''}`,
        `Versi terakhir: ${latest.id} (${latest.createdAt.slice(0, 10)}) · Laporan harian: ${days.length}`,
      ],
      images: [],
    },
    ringkasan,
    {
      heading: `Komposisi bahan (versi ${latest.version})`,
      level: 1,
      lines: latest.ingredients.length ? [] : [NOT_RECORDED],
      ...(latest.ingredients.length && { table: { head: ['No', 'Bahan', 'Jumlah', 'Satuan'], rows: latest.ingredients.map((x, i) => [String(i + 1), x.name, x.amount || '–', x.unit || '–']) } }),
      images: latest.ingredients.flatMap((x, i) => pics(x.mediaIds).map((p) => ({ ...p, caption: `Bahan ${i + 1} · ${x.name}${p.caption ? ` — ${p.caption}` : ''}` }))),
    },
    ...(latest.raw ? [rawBlock(latest.raw, versions)] : []),
    ...(latest.coconuts?.length ? coconutBlocks(latest.coconuts, pics) : []),
    {
      heading: 'Alat yang digunakan',
      level: 1,
      lines: toolList(latest).length ? [] : [NOT_RECORDED],
      ...(toolList(latest).length && { table: { head: ['No', 'Alat', 'Jumlah', 'Satuan'], rows: toolList(latest).map((t, i) => [String(i + 1), t.name, t.amount || '–', t.unit || '–']) } }),
      images: toolList(latest).flatMap((t) => pics(t.mediaIds).map((p) => ({ ...p, caption: `Alat · ${t.name}${p.caption ? ` — ${p.caption}` : ''}` }))),
    },
    {
      heading: 'Urutan hari',
      level: 1,
      lines: latest.steps.length ? latest.steps.map((st, i) => `Hari ke-${i + 1}: ${st.text}${st.duration ? ` · ${st.duration}` : ''}${st.conditions ? ` · ${st.conditions}` : ''}`) : [NOT_RECORDED],
      images: latest.steps.flatMap((st, i) => pics(st.mediaIds).map((p) => ({ ...p, caption: `Hari ke-${i + 1}${p.caption ? ` — ${p.caption}` : ''}` }))),
    },
    {
      heading: 'Riwayat versi',
      level: 1,
      lines: [],
      table: { head: ['Versi', 'Tanggal', 'Oleh & asisten', 'Alasan perubahan'], rows: vs.map((v) => [v.id, v.createdAt.slice(0, 10), [or(v.author), ...(v.assistants ?? [])].join(', '), or(v.reason)]) },
      images: [],
    },
    { heading: 'Laporan harian', level: 1, lines: days.length ? [] : ['Belum ada laporan harian.'], images: [] },
    ...days.map<ReportBlock>((d) => ({
      heading: `${dayLabel(d.entryDate)}${d.entryDate} · ${d.id}${d.finished ? ' · LAPORAN PENUTUP (SELESAI)' : ''}`,
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
        status === 'selesai' ? `Riset ditandai SELESAI oleh pengguna pada ${dates.end}.` : 'Riset belum ditandai selesai.',
        'Isi laporan = catatan pengguna. Tidak ada saran AI; bukan klaim produk aman, memenuhi standar, atau siap jual.',
        'Video asli tersimpan di aplikasi & file cadangan; di laporan hanya gambar pratinjau dan nama berkas.',
      ],
      images: [],
    },
  ];
  const allImages = blocks.flatMap((b) => b.images);
  const coverImage = allImages.find((im) => im.dataUrl && !im.video) ?? allImages.find((im) => im.dataUrl);
  const cover: ReportCover = {
    code: key,
    product: protocolProductName(latest),
    status: STATUS[status],
    done: status === 'selesai',
    meta: [
      ['Kode', key],
      ['Produk', protocolProductName(latest)],
      ['Versi resep', `${latest.version} (${latest.createdAt.slice(0, 10)})`],
      ['Tanggal mulai', or(dates.start)],
      ['Tanggal selesai', dates.end ?? 'belum selesai'],
      ['Pembuat', or(latest.author)],
      ['Asisten', latest.assistants?.length ? latest.assistants.join(', ') : NOT_RECORDED],
    ],
    ...(coverImage && { image: coverImage }),
  };
  const kpis: ReportKpi[] = [
    { label: 'Durasi', value: dates.days ? `${dates.days} hari` : 'berjalan' },
    { label: 'Laporan harian', value: String(days.length) },
    { label: 'Variabel diukur', value: String(new Set(res.summary.map((m) => `${m.name}|${m.unit}`)).size) },
    { label: 'Titik data angka', value: String(res.summary.reduce((n, m) => n + m.n, 0)) },
    { label: 'Grafik', value: String(res.charts.length) },
    { label: 'Foto & video', value: String(allImages.length) },
  ];
  return { title: `Riset Produk — ${latest.name} (versi ${latest.version})`, subtitle: `${key} · ${protocolProductName(latest)} · ${STATUS[status]}`, generatedAt, cover, kpis, blocks, footer: `GEMA RnD Lab · dibuat ${generatedAt}` };
}
