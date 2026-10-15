'use client';

import { useState } from 'react';
import { downloadBlob } from '@/lib/labMedia';
import { awalColumns, buildCatatReport, compareRecord, conclusions, hasThickness, type CatatRecord } from '@/lib/pencatatan';
import { fmtNum } from '@/lib/reportCharts';

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

function Table({ head, rows, testId }: { head: string[]; rows: (string | number)[][]; testId: string }) {
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
              {r.map((c, j) => <td key={j} className={j ? cell : 'px-3 py-2 font-mono'}>{c === '' ? '–' : c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
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
        <Table testId="catat-tbl-awal" head={['No', ...cols.map(([, l]) => l)]} rows={rec.rows.map((r) => [r.no, ...cols.map(([k]) => r[k] || '')])} />
      </section>
      <section className="flex flex-col gap-2">
        <h2 className="text-lg"><span className="mr-2 rounded bg-ink px-1.5 py-0.5 font-mono text-xs text-acid">2</span>Data akhir</h2>
        {rec.finishedAt ? (
          <Table testId="catat-tbl-akhir" head={['No', 'Berat akhir (g)', ...(coco ? ['Tebal daging akhir (mm)'] : [])]} rows={rec.rows.map((r) => [r.no, r.beratAkhir || '', ...(coco ? [r.tebalAkhir || ''] : [])])} />
        ) : (
          <p className="text-sm italic text-muted">Belum dicatat — buat pencatatan data akhir dulu.</p>
        )}
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="text-lg"><span className="mr-2 rounded bg-ink px-1.5 py-0.5 font-mono text-xs text-acid">3</span>Perbandingan data awal &amp; akhir</h2>
        {rec.finishedAt &&
          cmp.map((s) => (
            <div key={s.label} className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold">{s.label} ({s.unit})</h3>
              <Table
                testId={`catat-tbl-cmp-${s.label === 'Berat' ? 'berat' : 'tebal'}`}
                head={['No', 'Awal', 'Akhir', 'Selisih', 'Perubahan']}
                rows={[...s.rows.map((r) => [r.no, n(r.awal), n(r.akhir), n(r.selisih), pct(r.pct)]), ['Rata-rata', n(s.meanAwal), n(s.meanAkhir), n(s.meanAwal !== undefined && s.meanAkhir !== undefined ? s.meanAkhir - s.meanAwal : undefined), pct(s.meanPct)]]}
              />
            </div>
          ))}
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
