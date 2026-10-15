'use client';

import { useState } from 'react';
import { downloadBlob } from '@/lib/labMedia';
import { akhirFilled, awalColumns, buildCatatReport, compareRecord, compareTable, conclusions, formulaNote, hasAkhir, hasThickness, treatmentRows, type CatatRecord } from '@/lib/pencatatan';
import { fmtNum } from '@/lib/reportCharts';
import { ImagePreview } from './Overlays';

type Kind = 'pdf' | 'docx' | 'pptx';
const LABEL: Record<Kind, string> = { pdf: 'PDF', docx: 'Word', pptx: 'PPTX' };

/** Unduh hasil pencatatan (DEC-074) — model laporan & desain sama dengan laporan riset produk. */
export async function downloadCatat(rec: CatatRecord, kind: Kind) {
  const report = buildCatatReport(rec);
  const name = `${rec.id}-pencatatan-data.${kind}`;
  if (kind === 'pdf') {
    const { researchPdfBlob } = await import('@/lib/labPdf');
    return downloadBlob(await researchPdfBlob(report), name);
  }
  const o = await import('@/lib/officeExport');
  const { chartPngs } = await import('@/lib/chartPng');
  const charts = await chartPngs(report.blocks.flatMap((b) => b.charts ?? []));
  const bytes = kind === 'docx' ? o.buildDocx(report, charts) : o.buildPptx(report, charts);
  downloadBlob(new Blob([bytes as Uint8Array<ArrayBuffer>], { type: kind === 'docx' ? o.DOCX_MIME : o.PPTX_MIME }), name);
}

export function DownloadButtons({ rec, testId }: { rec: CatatRecord; testId: string }) {
  const [busy, setBusy] = useState<Kind | ''>('');
  return (
    <div className="flex flex-wrap gap-2" data-testid={testId}>
      {(['pdf', 'docx', 'pptx'] as const).map((k) => (
        <button
          key={k}
          type="button"
          disabled={!!busy}
          className="btn-ghost min-h-[40px] px-3"
          onClick={(e) => {
            e.stopPropagation();
            setBusy(k);
            void downloadCatat(rec, k).finally(() => setBusy(''));
          }}
          data-testid={`${testId}-${k}`}
        >
          {busy === k ? '…' : `Unduh ${LABEL[k]}`}
        </button>
      ))}
    </div>
  );
}

const n = (v?: number, d = 2) => (v === undefined ? '–' : fmtNum(Number(v.toFixed(d))));
const pct = (v?: number) => (v === undefined ? '–' : `${v > 0 ? '+' : ''}${fmtNum(Number(v.toFixed(1)))}%`);
const cell = 'px-3 py-2 text-right font-mono';

function Table({ head, rows, testId }: { head: string[]; rows: (string | number | React.ReactNode)[][]; testId: string }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-paper-grid">
      <table className="w-full min-w-[360px] text-sm" data-testid={testId}>
        <thead>
          <tr className="bg-ink text-left font-mono text-[11px] uppercase text-acid">
            {head.map((h, i) => <th key={h} className={`px-3 py-2 ${i ? 'text-right' : ''}`}>{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className={i % 2 ? 'bg-paper' : 'bg-white'}>
              {r.map((c, j) => <td key={j} className={j ? cell : 'px-3 py-2 font-mono'}>{c === '' || c === undefined ? '–' : c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Foto kecil di tabel; klik → pratinjau besar dengan tombol ✕ (DEC-076). */
function Thumb({ src, alt }: { src?: string; alt: string }) {
  const [zoom, setZoom] = useState(false);
  if (!src) return <span className="text-muted">–</span>;
  return (
    <>
      <button type="button" className="inline-block rounded-lg" onClick={() => setZoom(true)} aria-label={`Lihat ${alt}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} className="ml-auto h-12 w-12 rounded-lg object-cover" />
      </button>
      {zoom && <ImagePreview src={src} alt={alt} onClose={() => setZoom(false)} />}
    </>
  );
}

/** Hasil pencatatan: (1) data awal, (2) data akhir, (3) perbandingan + kesimpulan. */
export function CatatResult({ rec }: { rec: CatatRecord }) {
  const cols = awalColumns(rec.item);
  const coco = hasThickness(rec.item);
  const cmp = compareRecord(rec);
  return (
    <div className="flex flex-col gap-6" data-testid="catat-result">
      <section className="flex flex-col gap-2">
        <h2 className="text-lg"><span className="mr-2 rounded bg-ink px-1.5 py-0.5 font-mono text-xs text-acid">1</span>Data awal</h2>
        <Table testId="catat-tbl-awal" head={['No', 'Foto', ...cols.map(([, l]) => l)]} rows={rec.rows.map((r) => [r.no, <Thumb key="f" src={r.fotoAwal} alt={`Foto awal nomor ${r.no}`} />, ...cols.map(([k]) => r[k] || '')])} />
      </section>
      <section className="flex flex-col gap-2">
        <h2 className="text-lg"><span className="mr-2 rounded bg-ink px-1.5 py-0.5 font-mono text-xs text-acid">2</span>Data akhir</h2>
        {!rec.finishedAt && rec.akhirSavedAt && (
          <p className="self-start rounded-lg bg-safety px-2 py-1 text-xs font-semibold" data-testid="catat-akhir-draft-note">
            Sementara, belum lengkap: {akhirFilled(rec)} dari {rec.count} nomor terisi · disimpan {rec.akhirSavedAt.slice(0, 16).replace('T', ' ')}
          </p>
        )}
        {hasAkhir(rec) ? (
          <Table testId="catat-tbl-akhir" head={['No', 'Foto', 'Berat akhir (g)', ...(coco ? ['Tebal daging akhir (mm)'] : [])]} rows={rec.rows.map((r) => [r.no, <Thumb key="f" src={r.fotoAkhir} alt={`Foto akhir nomor ${r.no}`} />, r.beratAkhir || '', ...(coco ? [r.tebalAkhir || ''] : [])])} />
        ) : (
          <p className="text-sm italic text-muted">Belum dicatat — buat pencatatan data akhir dulu.</p>
        )}
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="text-lg"><span className="mr-2 rounded bg-ink px-1.5 py-0.5 font-mono text-xs text-acid">3</span>Perbandingan data awal &amp; akhir</h2>
        {hasAkhir(rec) &&
          cmp.map((s) => (
            <div key={s.label} className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold">{s.label} ({s.unit})</h3>
              <p className="text-xs text-muted" data-testid={`catat-formula-${s.label === 'Berat' ? 'berat' : 'tebal'}`}>{formulaNote(s)}</p>
              <Table testId={`catat-tbl-cmp-${s.label === 'Berat' ? 'berat' : 'tebal'}`} {...compareTable(s)} />
            </div>
          ))}
        {treatmentRows(rec.treatments).length > 0 && (
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold">Perlakuan</h3>
            <Table testId="catat-tbl-treat" head={['Perlakuan', 'Jumlah', 'Perlakuan/metode']} rows={treatmentRows(rec.treatments)} />
          </div>
        )}
        <div className="rounded-xl border-l-4 border-acid bg-paper p-4" data-testid="catat-conclusion">
          <p className="label-mono mb-1">Kesimpulan</p>
          <ul className="flex list-disc flex-col gap-1 pl-5 text-sm">
            {conclusions(rec).map((c) => <li key={c}>{c}</li>)}
          </ul>
          <p className="mt-2 text-xs text-muted">Deskriptif dari angka isian; bukan uji statistik dan bukan klaim mutu produk.</p>
        </div>
      </section>
    </div>
  );
}
