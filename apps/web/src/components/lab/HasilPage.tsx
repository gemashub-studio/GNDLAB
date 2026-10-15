'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getCatat, type CatatRecord } from '@/lib/pencatatan';
import { CatatResult, DownloadButtons } from './CatatResult';

/** Halaman "Hasil pencatatan data awal dan akhir" (DEC-074): /lab/hasil?id=PD-… — data dibaca dari perangkat ini. */
export function HasilPage() {
  const [rec, setRec] = useState<CatatRecord | null>();
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('id') ?? '';
    void getCatat(id)
      .then((r) => setRec(r ?? null))
      .catch(() => setRec(null));
  }, []);

  return (
    <div className="flex flex-col gap-6" data-testid="hasil-page">
      <Link href="/lab?t=bahan" className="font-mono text-xs no-underline hover:text-acid">← Pencatatan data</Link>
      <header className="card-ink flex flex-col gap-2">
        <span className="font-mono text-[11px] tracking-[0.14em] text-muted-ink">GnD Lab · pencatatan data</span>
        <h1 className="text-[28px] text-paper sm:text-[40px]">Hasil pencatatan data awal dan akhir</h1>
        {rec && <p className="font-mono text-sm text-muted-ink">{rec.id} · {rec.item} · {rec.count} item · awal {rec.createdAt.slice(0, 10)} · akhir {rec.finishedAt ? rec.finishedAt.slice(0, 10) : rec.akhirSavedAt ? `sementara ${rec.akhirSavedAt.slice(0, 10)}` : 'belum dicatat'}</p>}
      </header>
      {rec === undefined && <p className="text-sm text-muted">Memuat…</p>}
      {rec === null && <p className="text-sm">Catatan tidak ditemukan di perangkat ini. Data tersimpan per perangkat — buka dari perangkat yang mencatatnya.</p>}
      {rec && (
        <>
          <div className="card">
            <CatatResult rec={rec} />
          </div>
          <div className="card flex flex-col gap-2">
            <p className="label-mono">Unduh / simpan hasil</p>
            <DownloadButtons rec={rec} testId="hasil-dl" />
          </div>
        </>
      )}
    </div>
  );
}
