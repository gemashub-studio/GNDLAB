/**
 * PENCATATAN DATA (DEC-074, menggantikan menu Bahan Baku): catatan AWAL per item (N butir/unit bernomor: berat awal,
 * volume air, berat air, tebal daging) lalu catatan AKHIR (berat & tebal akhir tiap nomor) → perbandingan & kesimpulan.
 * Semua angka = isian pengguna; aplikasi hanya menghitung selisih, persen, rata-rata (deskriptif, tanpa klaim).
 * Disimpan di IndexedDB `gemas-catat` (ikut file cadangan).
 */
import { openDB, type DBSchema } from 'idb';
import { deviceTag } from './device';
import { isCoconutItem, NOT_RECORDED, parseMeasure } from './labStore';
import { fmtNum, type ChartSpec } from './reportCharts';
import type { ReportBlock, ResearchReport } from './researchReport';

export const MAX_ROWS = 500;

export interface CatatRow {
  no: number;
  /** Berat awal (g). */
  beratAwal: string;
  /** Volume air (mL). */
  volAir: string;
  /** Berat air (g). */
  beratAir: string;
  /** Tebal daging awal (mm). */
  tebalAwal: string;
  /** Berat akhir (g) — diisi di pencatatan data akhir. */
  beratAkhir?: string;
  /** Tebal daging akhir (mm). */
  tebalAkhir?: string;
  /** Foto nomor ini saat data awal (JPEG data URL, DEC-075). */
  fotoAwal?: string;
  /** Foto nomor ini saat data akhir. */
  fotoAkhir?: string;
}

export interface CatatRecord {
  /** PD-YYMMDD-NN (+ kode perangkat bila sinkron aktif). */
  id: string;
  item: string;
  count: number;
  rows: CatatRow[];
  createdAt: string;
  /** Terisi saat pencatatan data akhir dikonfirmasi. */
  finishedAt?: string;
}

export const blankRows = (n: number): CatatRow[] => Array.from({ length: n }, (_, i) => ({ no: i + 1, beratAwal: '', volAir: '', beratAir: '', tebalAwal: '' }));

/** Kolom yang dipakai item: kelapa = berat awal, volume air, berat air, tebal daging; lainnya = berat awal saja. */
export const awalColumns = (item: string) =>
  isCoconutItem(item)
    ? ([['beratAwal', 'Berat awal (g)'], ['volAir', 'Volume air (mL)'], ['beratAir', 'Berat air (g)'], ['tebalAwal', 'Tebal daging (mm)']] as const)
    : ([['beratAwal', 'Berat awal (g)']] as const);

/** Pencatatan akhir mengikuti tebal hanya bila item kelapa. */
export const hasThickness = (item: string) => isCoconutItem(item);

/** Nomor baris yang kosong untuk kolom wajib catatan awal (berat awal; kelapa juga tebal daging). */
export function missingAwal(item: string, rows: readonly CatatRow[]): number[] {
  return rows.filter((r) => !r.beratAwal.trim() || (hasThickness(item) && !r.tebalAwal.trim())).map((r) => r.no);
}

/** Nomor baris yang kosong untuk catatan akhir (berat akhir; tebal akhir bila tebal awal diisi). */
export function missingAkhir(item: string, rows: readonly CatatRow[]): number[] {
  return rows.filter((r) => !(r.beratAkhir ?? '').trim() || (hasThickness(item) && r.tebalAwal.trim() && !(r.tebalAkhir ?? '').trim())).map((r) => r.no);
}

// ------------------------------------------------------------------ perbandingan (murni)

export interface CompareRow {
  no: number;
  awal?: number;
  akhir?: number;
  selisih?: number;
  /** % perubahan terhadap awal. */
  pct?: number;
}

export interface CompareStat {
  label: string;
  unit: string;
  rows: CompareRow[];
  n: number;
  meanAwal?: number;
  meanAkhir?: number;
  meanPct?: number;
  minPct?: CompareRow;
  maxPct?: CompareRow;
}

function compareOne(label: string, unit: string, rows: readonly CatatRow[], a: (r: CatatRow) => string, b: (r: CatatRow) => string): CompareStat {
  const out = rows.map<CompareRow>((r) => {
    const x = parseMeasure(a(r));
    const y = parseMeasure(b(r));
    const row: CompareRow = { no: r.no };
    if (x !== undefined) row.awal = x;
    if (y !== undefined) row.akhir = y;
    if (x !== undefined && y !== undefined) {
      row.selisih = y - x;
      if (x !== 0) row.pct = ((y - x) / x) * 100;
    }
    return row;
  });
  const both = out.filter((r) => r.selisih !== undefined);
  const mean = (v: number[]) => (v.length ? v.reduce((s, x) => s + x, 0) / v.length : undefined);
  const withPct = out.filter((r) => r.pct !== undefined).sort((p, q) => p.pct! - q.pct!);
  const st: CompareStat = { label, unit, rows: out, n: both.length };
  const ma = mean(both.map((r) => r.awal!));
  const mb = mean(both.map((r) => r.akhir!));
  const mp = mean(withPct.map((r) => r.pct!));
  if (ma !== undefined) st.meanAwal = ma;
  if (mb !== undefined) st.meanAkhir = mb;
  if (mp !== undefined) st.meanPct = mp;
  if (withPct.length) {
    st.minPct = withPct[0]!;
    st.maxPct = withPct[withPct.length - 1]!;
  }
  return st;
}

export function compareRecord(rec: CatatRecord): CompareStat[] {
  return [
    compareOne('Berat', 'g', rec.rows, (r) => r.beratAwal, (r) => r.beratAkhir ?? ''),
    ...(hasThickness(rec.item) ? [compareOne('Tebal daging', 'mm', rec.rows, (r) => r.tebalAwal, (r) => r.tebalAkhir ?? '')] : []),
  ];
}

const f = (v?: number, d = 1) => (v === undefined ? '–' : fmtNum(Number(v.toFixed(d))));
const fp = (v?: number) => (v === undefined ? '–' : `${v > 0 ? '+' : ''}${fmtNum(Number(v.toFixed(1)))}%`);

/** Kesimpulan deskriptif dari angka isian (tanpa uji statistik, tanpa klaim kualitas). */
export function conclusions(rec: CatatRecord): string[] {
  if (!rec.finishedAt) return ['Data akhir belum dicatat — kesimpulan muncul setelah pencatatan data akhir.'];
  return compareRecord(rec).map((s) => {
    if (!s.n || s.meanPct === undefined) return `${s.label}: belum ada pasangan data awal & akhir yang lengkap.`;
    const arah = s.meanPct < 0 ? 'turun' : s.meanPct > 0 ? 'naik' : 'tetap';
    const byAbs = s.rows.filter((r) => r.pct !== undefined).sort((p, q) => Math.abs(p.pct!) - Math.abs(q.pct!));
    const lo = byAbs[0];
    const hi = byAbs[byAbs.length - 1];
    const ext = lo && hi && lo.no !== hi.no ? ` Perubahan terkecil di nomor ${lo.no} (${fp(lo.pct)}), terbesar di nomor ${hi.no} (${fp(hi.pct)}).` : '';
    return `${s.label} rata-rata ${arah} ${f(Math.abs(s.meanPct))}% (dari ${f(s.meanAwal)} ${s.unit} ke ${f(s.meanAkhir)} ${s.unit}) pada ${s.n} dari ${rec.count} ${rec.item.toLowerCase()}.${ext}`;
  });
}

// ------------------------------------------------------------------ penyimpanan

interface CatatDb extends DBSchema {
  records: { key: string; value: CatatRecord };
}

let dbp: ReturnType<typeof openDB<CatatDb>> | undefined;
export const catatDb = () =>
  (dbp ??= openDB<CatatDb>('gemas-catat', 1, {
    upgrade(d) {
      d.createObjectStore('records', { keyPath: 'id' });
    },
  }));

export async function listCatat(): Promise<CatatRecord[]> {
  return (await (await catatDb()).getAll('records')).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export const getCatat = async (id: string) => (await catatDb()).get('records', id);

export function nextCatatId(existing: readonly string[], now = new Date(), tag = deviceTag()): string {
  const p = `PD-${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-`;
  const n = existing.filter((x) => x.startsWith(p)).map((x) => parseInt(x.slice(p.length), 10) || 0);
  return `${p}${String(Math.max(0, ...n) + 1).padStart(2, '0')}${tag}`;
}

export async function addCatatAwal(item: string, rows: CatatRow[]): Promise<CatatRecord> {
  const d = await catatDb();
  const rec: CatatRecord = { id: nextCatatId((await d.getAllKeys('records')).map(String)), item, count: rows.length, rows, createdAt: new Date().toISOString() };
  await d.add('records', rec);
  return rec;
}

export interface AkhirInput {
  no: number;
  beratAkhir: string;
  tebalAkhir: string;
  fotoAkhir?: string;
}

export async function saveCatatAkhir(id: string, akhir: AkhirInput[]): Promise<CatatRecord> {
  const d = await catatDb();
  const rec = await d.get('records', id);
  if (!rec) throw new Error(`Catatan ${id} tidak ditemukan`);
  const by = new Map(akhir.map((a) => [a.no, a]));
  const next: CatatRecord = {
    ...rec,
    rows: rec.rows.map((r) => {
      const a = by.get(r.no);
      return { ...r, beratAkhir: a?.beratAkhir.trim() ?? '', tebalAkhir: a?.tebalAkhir.trim() ?? '', ...(a?.fotoAkhir && { fotoAkhir: a.fotoAkhir }) };
    }),
    finishedAt: new Date().toISOString(),
  };
  await d.put('records', next);
  return next;
}

/** Hapus PERMANEN catatan terpilih (DEC-076; hanya yang lengkap awal & akhir — dijaga di UI & di sini). */
export async function deleteCatat(ids: readonly string[]): Promise<number> {
  const d = await catatDb();
  const tx = d.transaction('records', 'readwrite');
  let n = 0;
  for (const id of ids) {
    const r = await tx.store.get(id);
    if (r?.finishedAt) {
      await tx.store.delete(id);
      n++;
    }
  }
  await tx.done;
  return n;
}

// ------------------------------------------------------------------ laporan (PDF/Word/PowerPoint)

/** Foto per nomor untuk galeri laporan. */
const photos = (rec: CatatRecord, k: 'awal' | 'akhir') =>
  rec.rows
    .filter((r) => (k === 'awal' ? r.fotoAwal : r.fotoAkhir))
    .map((r) => ({ name: `${rec.id}-${String(r.no).padStart(3, '0')}-${k}.jpg`, caption: `No ${r.no} · data ${k}`, dataUrl: (k === 'awal' ? r.fotoAwal : r.fotoAkhir)!, video: false }));

export function buildCatatReport(rec: CatatRecord, generatedAt = new Date().toLocaleString('id-ID')): ResearchReport {
  const coco = hasThickness(rec.item);
  const cols = awalColumns(rec.item);
  const cmp = compareRecord(rec);
  const v = (s?: string) => (s && s.trim() ? s.trim() : '–');
  const blocks: ReportBlock[] = [
    {
      heading: 'Data awal',
      level: 1,
      lines: [`Item: ${rec.item}`, `Jumlah: ${rec.count}`, `Dicatat: ${rec.createdAt.slice(0, 16).replace('T', ' ')}`],
      table: { head: ['No', ...cols.map(([, l]) => l)], rows: rec.rows.map((r) => [String(r.no), ...cols.map(([k]) => v(r[k]))]) },
      images: photos(rec, 'awal'),
      pptxOmitImages: true,
    },
  ];
  if (rec.finishedAt) {
    blocks.push({
      heading: 'Data akhir',
      level: 1,
      lines: [`Dicatat: ${rec.finishedAt.slice(0, 16).replace('T', ' ')}`],
      table: { head: ['No', 'Berat akhir (g)', ...(coco ? ['Tebal daging akhir (mm)'] : [])], rows: rec.rows.map((r) => [String(r.no), v(r.beratAkhir), ...(coco ? [v(r.tebalAkhir)] : [])]) },
      images: photos(rec, 'akhir'),
      pptxOmitImages: true,
    });
    for (const s of cmp) {
      const chart: ChartSpec = {
        id: `cmp-${s.label}`,
        title: `${s.label} (${s.unit}) — awal vs akhir per nomor`,
        unit: s.unit,
        kind: 'line',
        x: s.rows.map((r) => String(r.no)),
        xTitle: 'Nomor',
        series: [
          { name: 'Awal', color: '#1FA88F', values: s.rows.map((r) => r.awal ?? null) },
          { name: 'Akhir', color: '#F5A524', values: s.rows.map((r) => r.akhir ?? null) },
        ],
        note: 'Nilai isian pengguna; nomor tanpa angka dibiarkan kosong.',
      };
      blocks.push({
        heading: `Perbandingan ${s.label.toLowerCase()}`,
        level: 1,
        lines: [`Pasangan lengkap: ${s.n} dari ${rec.count}`, `Rata-rata awal: ${f(s.meanAwal)} ${s.unit}`, `Rata-rata akhir: ${f(s.meanAkhir)} ${s.unit}`, `Rata-rata perubahan: ${fp(s.meanPct)}`],
        table: { head: ['No', `Awal (${s.unit})`, `Akhir (${s.unit})`, `Selisih (${s.unit})`, 'Perubahan'], rows: s.rows.map((r) => [String(r.no), f(r.awal, 2), f(r.akhir, 2), f(r.selisih, 2), fp(r.pct)]) },
        images: [],
        ...(s.n >= 2 && { charts: [chart] }),
      });
    }
  }
  // PowerPoint: grid foto + data per nomor (awal atas, akhir bawah; akhir tanpa volume/berat air)
  if (rec.rows.some((r) => r.fotoAwal || r.fotoAkhir)) {
    const u = (s: string | undefined, unit: string) => (s && s.trim() ? `${s.trim()} ${unit}` : '–');
    blocks.splice(rec.finishedAt ? 2 : 1, 0, {
      heading: rec.finishedAt ? 'Foto data awal & akhir' : 'Foto data awal',
      level: 1,
      lines: [],
      images: [],
      pptxOnly: true,
      photoPairs: rec.rows.map((r) => ({
        no: r.no,
        awal: {
          ...(r.fotoAwal && { image: r.fotoAwal }),
          lines: coco ? [`Berat ${u(r.beratAwal, 'g')}`, `Vol. air ${u(r.volAir, 'mL')}`, `Berat air ${u(r.beratAir, 'g')}`, `Tebal ${u(r.tebalAwal, 'mm')}`] : [`Berat ${u(r.beratAwal, 'g')}`],
        },
        ...(rec.finishedAt && { akhir: { ...(r.fotoAkhir && { image: r.fotoAkhir }), lines: coco ? [`Berat ${u(r.beratAkhir, 'g')}`, `Tebal ${u(r.tebalAkhir, 'mm')}`] : [`Berat ${u(r.beratAkhir, 'g')}`] } }),
      })),
    });
  }
  blocks.push({ heading: 'Kesimpulan', level: 1, lines: [...conclusions(rec), 'Kesimpulan deskriptif dari angka isian; bukan uji statistik dan bukan klaim mutu produk.'], images: [] });
  const title = `Pencatatan data — ${rec.item} (${rec.count})`;
  const status = rec.finishedAt ? 'Awal & akhir lengkap' : 'Menunggu data akhir';
  return {
    title,
    subtitle: `${rec.id} · ${status}`,
    generatedAt,
    cover: {
      code: rec.id,
      product: rec.item,
      status,
      done: !!rec.finishedAt,
      meta: [
        ['Kode', rec.id],
        ['Item', rec.item],
        ['Jumlah', String(rec.count)],
        ['Data awal', rec.createdAt.slice(0, 10)],
        ['Data akhir', rec.finishedAt ? rec.finishedAt.slice(0, 10) : 'belum dicatat'],
      ],
    },
    kpis: [
      { label: 'Jumlah item', value: String(rec.count) },
      { label: 'Data awal terisi', value: String(rec.rows.filter((r) => r.beratAwal.trim()).length) },
      { label: 'Data akhir terisi', value: String(rec.rows.filter((r) => (r.beratAkhir ?? '').trim()).length) },
      ...cmp.map((s) => ({ label: `Rata-rata ${s.label.toLowerCase()}`, value: rec.finishedAt ? fp(s.meanPct) : NOT_RECORDED })),
    ],
    blocks,
    footer: `GEMA RnD Lab · pencatatan data ${rec.id} · dibuat ${generatedAt}`,
  };
}
