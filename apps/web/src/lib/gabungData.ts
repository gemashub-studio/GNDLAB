/**
 * Gabungkan data (DEC-096): satu laporan dari pencatatan data yang sudah lengkap + riset produk + progres perlakuan
 * + laporan belanja (foto nota bercabang ke foto barang). Diunduh sebagai TXT (tanpa gambar), PPTX, atau Word.
 */
import { lpjReport } from './belanjaExport';
import { fmtRp, parseRp, type LpjReport } from './belanja';
import { buildCatatReport, type CatatRecord } from './pencatatan';
import { fmtWaktu, PROGRES_CATEGORIES, type ProgresItem } from './progresPerlakuan';
import type { BelanjaGroup, ReportBlock, ResearchReport } from './researchReport';

const treatmentName = (t: string) => (t === 'GreenHouse' ? 'Green House' : t);
const toko = (title: string, i: number) => title.trim() || `Toko ${i + 1}`;

/** Kelompok laporan belanja: satu kelompok per toko — nota dan barangnya tidak pernah dipisah. */
export function belanjaGroups(lpjs: readonly LpjReport[]): BelanjaGroup[] {
  return lpjs.flatMap((r) =>
    r.proofs.map((p, i) => ({
      label: `${toko(p.title, i)}${parseRp(p.total) ? ` · ${fmtRp(parseRp(p.total))}` : ''}`,
      roots: p.receipts.map((ph) => ({ image: ph.dataUrl, label: ph.name })),
      leaves: p.goods.map((g) => ({ image: g.dataUrl, label: g.label?.trim() || '' })),
    })),
  );
}

/** Blok progres perlakuan: tabel semua upload + foto 3 tahap (harian | mingguan | bulanan) di PowerPoint. */
export function progresBlock(items: readonly ProgresItem[]): ReportBlock {
  const sorted = [...items].sort((a, b) => a.at.localeCompare(b.at));
  return {
    heading: 'Progres perlakuan',
    level: 1,
    lines: [`Jumlah upload: ${sorted.length}`, ...PROGRES_CATEGORIES.map((c) => `${c.label}: ${sorted.filter((i) => i.category === c.key).length}`)],
    table: {
      head: ['Kode', 'Kategori', 'Nama perlakuan', 'Jumlah produksi/item', 'Tanggal & jam'],
      rows: sorted.map((i) => [i.id, PROGRES_CATEGORIES.find((c) => c.key === i.category)?.label ?? i.category, treatmentName(i.treatment), i.qty, fmtWaktu(i.at)]),
    },
    images: sorted.map((i) => ({ name: i.id, caption: `${treatmentName(i.treatment)} · ${i.category} · ${i.qty}`, dataUrl: i.photo, video: false })),
    pptxOmitImages: true,
    progressColumns: PROGRES_CATEGORIES.map((c) => ({
      title: c.label,
      items: sorted.filter((i) => i.category === c.key).map((i) => ({ image: i.photo, lines: [treatmentName(i.treatment), `Jumlah ${i.qty}`, fmtWaktu(i.at)] })),
    })),
  };
}

const prefixed = (blocks: readonly ReportBlock[], tag: string): ReportBlock[] => blocks.map((b) => (b.level === 1 ? { ...b, heading: `${tag} · ${b.heading}` } : b));

export interface GabungInput {
  rec: CatatRecord;
  /** Laporan riset produk yang sudah disusun (buildResearchReport). */
  riset?: ResearchReport;
  progres: readonly ProgresItem[];
  lpjs: readonly LpjReport[];
}

export function buildGabungReport({ rec, riset, progres, lpjs }: GabungInput, generatedAt = new Date().toLocaleString('id-ID')): ResearchReport {
  const catat = buildCatatReport(rec, generatedAt);
  const blocks: ReportBlock[] = [...prefixed(catat.blocks, 'Pencatatan'), ...(riset ? prefixed(riset.blocks, 'Riset') : [])];
  if (progres.length) blocks.push(progresBlock(progres));
  const groups = belanjaGroups(lpjs);
  if (groups.length) {
    // PowerPoint: slide padat "Laporan belanja"; Word/TXT: per toko (nota lalu foto barang dalam bagian yang sama)
    blocks.push({ heading: 'Laporan belanja', level: 1, lines: [], images: [], belanja: groups, pptxOnly: true });
    for (const r of lpjs) for (const b of lpjReport(r, generatedAt).blocks) blocks.push({ ...b, heading: `Laporan belanja · ${b.heading}`, pptxSkip: true });
  }
  const risetName = riset?.cover.product;
  return {
    title: `Gabungan data ${rec.id}${risetName ? ` + ${risetName}` : ''}`,
    subtitle: `Pencatatan ${rec.item}${riset ? ` · riset ${riset.cover.code}` : ''} · ${progres.length} progres · ${groups.length} nota belanja`,
    generatedAt,
    cover: {
      code: rec.id,
      product: 'Gabungan data',
      status: 'Gabungan data',
      done: true,
      meta: [
        ['Pencatatan', `${rec.id} · ${rec.item} · ${rec.count} item`],
        ...(riset ? ([['Riset produk', `${riset.cover.code} · ${riset.cover.product}`]] as [string, string][]) : []),
        ['Progres perlakuan', `${progres.length} upload`],
        ['Laporan belanja', `${lpjs.length} laporan · ${groups.length} nota`],
      ],
      ...(riset?.cover.image && { image: riset.cover.image }),
    },
    kpis: [...catat.kpis.slice(0, 3), ...(riset ? riset.kpis.slice(0, 2) : []), { label: 'Progres perlakuan', value: String(progres.length) }].slice(0, 6),
    blocks,
    footer: `GnD Lab · gabungan data ${rec.id} · dibuat ${generatedAt}`,
  };
}

/** Teks polos (tanpa gambar): judul, ringkasan, lalu tiap bagian — baris, tabel (dipisah " | "), kartu & progres. */
export function reportText(r: ResearchReport): string {
  const out: string[] = [r.title, r.subtitle, `Dibuat: ${r.generatedAt}`, ''];
  for (const [k, v] of r.cover.meta) out.push(`${k}: ${v}`);
  if (r.kpis.length) out.push('', 'RINGKASAN', ...r.kpis.map((k) => `- ${k.label}: ${k.value}`));
  for (const b of r.blocks.filter((x) => !x.pptxOnly)) {
    out.push('', b.level === 1 ? `== ${b.heading.toUpperCase()} ==` : `-- ${b.heading} --`);
    out.push(...b.lines);
    if (b.table?.rows.length) out.push(b.table.head.join(' | '), ...b.table.rows.map((row) => row.join(' | ')));
    for (const c of b.cards ?? []) out.push(`* ${c.title}`, ...c.lines.map((l) => `  ${l}`));
    for (const c of b.charts ?? []) out.push(`[Grafik] ${c.title}${c.note ? ` — ${c.note}` : ''}`);
    if (b.images.length) out.push(`(${b.images.length} foto/video tidak disertakan di TXT: ${b.images.map((i) => i.caption || i.name).join('; ')})`);
  }
  out.push('', r.footer);
  return out.join('\n').replace(/\n{3,}/g, '\n\n') + '\n';
}
