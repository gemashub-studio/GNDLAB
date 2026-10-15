/**
 * Ekspor laporan belanja (DEC-078): PPTX diagram cabang (foto nota di atas → cabang ke foto barang + nama barang)
 * dan PDF (model laporan yang sama dengan laporan riset). Word tetap belanjaDocx.
 */
import { fmtRp, parseRp, realizationTotal, terbilang, type LpjReport } from './belanja';
import type { TreeSlide } from './officeExport';
import type { ReportBlock, ResearchReport } from './researchReport';

const toko = (title: string, i: number) => title.trim() || `Toko ${i + 1}`;

/** Satu slide per toko: judul "Laporan belanja", subjudul nama toko & total, akar = foto nota, cabang = foto barang. */
export function lpjTreeSlides(r: LpjReport, generatedAt = new Date().toLocaleString('id-ID')): TreeSlide[] {
  return r.proofs.map((p, i) => ({
    title: 'Laporan belanja',
    subtitle: `${toko(p.title, i)}${parseRp(p.total) ? ` · total ${fmtRp(parseRp(p.total))}` : ''}${r.purpose.trim() ? ` · ${r.purpose.trim()}` : ''}`,
    roots: p.receipts.map((ph) => ({ image: ph.dataUrl, label: ph.name })),
    rootLabel: `Nota / bukti bayar — ${toko(p.title, i)}`,
    leaves: p.goods.map((g) => ({ image: g.dataUrl, label: g.label?.trim() || '' })),
    footer: `GEMA RnD Lab · laporan belanja ${r.id} · dibuat ${generatedAt}`,
  }));
}

/** Model laporan (PDF): per toko — total, terbilang, keterangan, foto nota & barang berketerangan nama barang. */
export function lpjReport(r: LpjReport, generatedAt = new Date().toLocaleString('id-ID')): ResearchReport {
  const total = realizationTotal(r);
  const blocks: ReportBlock[] = r.proofs.map((p, i) => ({
    heading: toko(p.title, i),
    level: 1,
    lines: [
      `Total alokasi: ${fmtRp(parseRp(p.total))}`,
      `Terbilang: ${terbilang(parseRp(p.total))}`,
      ...(p.description.trim() ? [`Keterangan: ${p.description.trim()}`] : []),
      `Barang: ${p.goods.map((g) => g.label?.trim()).filter(Boolean).join(', ') || 'belum dicatat'}`,
    ],
    images: [
      ...p.receipts.map((ph) => ({ name: ph.name, caption: `Nota · ${toko(p.title, i)}`, dataUrl: ph.dataUrl, video: false })),
      ...p.goods.map((g) => ({ name: g.name, caption: g.label?.trim() || '(tanpa nama barang)', dataUrl: g.dataUrl, video: false })),
    ],
  }));
  blocks.push({ heading: 'Total seluruh alokasi', level: 1, lines: [`Total: ${fmtRp(total)}`, `Terbilang: ${terbilang(total)}`], images: [] });
  return {
    title: `Laporan belanja${r.purpose.trim() ? ` — ${r.purpose.trim()}` : ''}`,
    subtitle: `${r.id} · ${r.proofs.length} toko`,
    generatedAt,
    cover: {
      code: r.id,
      product: 'Laporan belanja',
      status: 'Laporan belanja',
      done: true,
      meta: [
        ['Kode', r.id],
        ['Jumlah toko', String(r.proofs.length)],
        ['Total', fmtRp(total)],
        ['Diubah', r.updatedAt.slice(0, 10)],
      ],
    },
    kpis: [
      { label: 'Toko', value: String(r.proofs.length) },
      { label: 'Foto nota', value: String(r.proofs.reduce((n, p) => n + p.receipts.length, 0)) },
      { label: 'Barang', value: String(r.proofs.reduce((n, p) => n + p.goods.length, 0)) },
    ],
    blocks,
    footer: `GEMA RnD Lab · laporan belanja ${r.id} · dibuat ${generatedAt}`,
  };
}
