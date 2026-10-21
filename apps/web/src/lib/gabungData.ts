/**
 * Gabungkan data (DEC-096 → DEC-126): satu laporan dari pencatatan data + riset produk + laporan belanja
 * (foto nota bercabang ke foto barang). Diunduh sebagai PPTX, Word, PDF, atau TXT (tanpa gambar).
 * Ketiganya opsional, minimal satu dipilih.
 */
import { lpjReport } from './belanjaExport';
import { fmtRp, parseRp, type LpjReport } from './belanja';
import { buildCatatReport, type CatatRecord } from './pencatatan';
import type { BelanjaGroup, ReportBlock, ResearchReport } from './researchReport';

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

const prefixed = (blocks: readonly ReportBlock[], tag: string): ReportBlock[] => blocks.map((b) => (b.level === 1 ? { ...b, heading: `${tag} · ${b.heading}` } : b));

export interface GabungInput {
  rec?: CatatRecord;
  /** Laporan riset produk yang sudah disusun (buildResearchReport). */
  riset?: ResearchReport;
  lpjs: readonly LpjReport[];
}

export function buildGabungReport({ rec, riset, lpjs }: GabungInput, generatedAt = new Date().toLocaleString('id-ID')): ResearchReport {
  if (!rec && !riset && !lpjs.length) throw new Error('Pilih minimal satu data untuk digabungkan.');
  const catat = rec ? buildCatatReport(rec, generatedAt) : undefined;
  const blocks: ReportBlock[] = [...(catat ? prefixed(catat.blocks, 'Pencatatan') : []), ...(riset ? prefixed(riset.blocks, 'Riset') : [])];
  const groups = belanjaGroups(lpjs);
  if (lpjs.length) {
    // PowerPoint: slide padat "Laporan belanja"; Word/PDF/TXT: per toko (nota lalu foto barang dalam bagian yang sama)
    if (groups.length) blocks.push({ heading: 'Laporan belanja', level: 1, lines: [], images: [], belanja: groups, pptxOnly: true });
    for (const r of lpjs) for (const b of lpjReport(r, generatedAt).blocks) blocks.push({ ...b, heading: `Laporan belanja · ${b.heading}`, pptxSkip: true });
  }
  const code = rec?.id ?? riset?.cover.code ?? lpjs[0]!.id;
  const parts = [rec && `pencatatan ${rec.item}`, riset && `riset ${riset.cover.code}`, lpjs.length && `${lpjs.length} laporan belanja`].filter(Boolean);
  return {
    title: `Gabungan data ${[rec?.id, riset?.cover.product].filter(Boolean).join(' + ') || code}`,
    subtitle: `Gabungan ${parts.join(' · ')}`,
    generatedAt,
    cover: {
      code,
      product: 'Gabungan data',
      status: 'Gabungan data',
      done: true,
      meta: [
        ...(rec ? ([['Pencatatan', `${rec.id} · ${rec.item} · ${rec.count} item`]] as [string, string][]) : []),
        ...(riset ? ([['Riset produk', `${riset.cover.code} · ${riset.cover.product}`]] as [string, string][]) : []),
        ...(lpjs.length ? ([['Laporan belanja', `${lpjs.length} laporan · ${groups.length} nota`]] as [string, string][]) : []),
      ],
      ...(riset?.cover.image && { image: riset.cover.image }),
    },
    kpis: [...(catat?.kpis.slice(0, 3) ?? []), ...(riset ? riset.kpis.slice(0, 2) : []), ...(lpjs.length ? [{ label: 'Nota belanja', value: String(groups.length) }] : [])].slice(0, 6),
    blocks,
    footer: `GnD Lab · gabungan data ${code} · dibuat ${generatedAt}`,
  };
}

/** Teks polos (tanpa gambar): judul, ringkasan, lalu tiap bagian — baris, tabel (dipisah " | "), kartu & grafik. */
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
