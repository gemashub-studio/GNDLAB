'use client';

import { useState } from 'react';
import { saveLocal, syncPending } from '@/lib/localScenarios';
import { reportRows, toCsv } from '@/lib/report';
import { encodeState, runScenario, type ScenarioState } from '@/lib/scenario';
import { useDataset } from '@/lib/useDataset';
import { COMMODITY_UI } from '@/lib/catalog';

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const PATH: Record<ScenarioState['kind'], string> = { CONTAINER: '/muat', WAREHOUSE: '/gudang', CONVERT: '/konversi' };

export function defaultName(s: ScenarioState): string {
  const c = COMMODITY_UI[s.commodityId]?.short ?? s.commodityId;
  if (s.kind === 'CONTAINER') return `${c} @ ${s.custom ? 'custom' : s.containerId}`;
  if (s.kind === 'WAREHOUSE') return `Gudang · ${c}`;
  return `Konversi · ${c}`;
}

/** Simpan · Salin tautan · CSV · PDF (ux_spec §3.1 baris "Aksi"). */
export function ScenarioActions({ state }: { state: ScenarioState }) {
  const ds = useDataset();
  const [msg, setMsg] = useState<string>();
  const [busy, setBusy] = useState(false);
  const name = defaultName(state);
  const slugName = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  const rows = () => {
    const out = runScenario(ds, state);
    return reportRows(ds, state, out);
  };

  const act = async (fn: () => Promise<string>) => {
    setBusy(true);
    try {
      setMsg(await fn());
    } catch (e) {
      setMsg(e instanceof Error ? `Gagal: ${e.message}` : 'Gagal');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-label="Aksi skenario" className="card flex flex-col gap-3 p-[18px]">
      <span className="label-mono">AKSI</span>
      <div className="flex flex-wrap gap-2.5">
        <button
          type="button"
          className="btn-primary"
          disabled={busy}
          data-testid="save"
          onClick={() =>
            act(async () => {
              await saveLocal({ name, state, datasetVersion: ds.version });
              if (!navigator.onLine) return 'Sip, tersimpan di perangkat ini. Nanti dikirim ke akun begitu ada sinyal.';
              const r = await syncPending();
              return r.needLogin
                ? 'Sip, tersimpan di perangkat ini. Mau tersimpan di akun & dapat tautan pendek? Masuk (login) dulu.'
                : 'Sip, tersimpan di perangkat & akun.';
            })
          }
        >
          Simpan
        </button>
        <button
          type="button"
          className="btn-ghost"
          disabled={busy}
          data-testid="share"
          onClick={() =>
            act(async () => {
              const url = `${window.location.origin}${PATH[state.kind]}?s=${encodeState(state)}`;
              await navigator.clipboard.writeText(url);
              return 'Tautan sudah disalin. Siapa pun yang buka bakal lihat hitungan yang sama.';
            })
          }
        >
          Salin tautan
        </button>
        <button
          type="button"
          className="btn-ghost"
          disabled={busy}
          data-testid="export-csv"
          onClick={() =>
            act(async () => {
              download(new Blob([toCsv(rows())], { type: 'text/csv;charset=utf-8' }), `gemas-${slugName}.csv`);
              return 'CSV sudah diunduh — tinggal buka di Excel.';
            })
          }
        >
          CSV
        </button>
        <button
          type="button"
          className="btn-ghost"
          disabled={busy}
          data-testid="export-pdf"
          onClick={() =>
            act(async () => {
              const { reportPdfBlob } = await import('@/lib/pdf');
              download(await reportPdfBlob(name, rows()), `gemas-${slugName}.pdf`);
              return 'PDF sudah diunduh.';
            })
          }
        >
          PDF
        </button>
      </div>
      {state.kind !== 'CONVERT' && (
        <a href={`/simulator?s=${encodeState(state)}`} className="btn-acid self-start no-underline" data-testid="open-sim">
          Buka simulator 2D/3D →
        </a>
      )}
      {msg && (
        <p role="status" className="border-l-4 border-acid bg-paper px-3 py-2 text-[13px]" data-testid="action-msg">
          {msg}
        </p>
      )}
    </section>
  );
}
