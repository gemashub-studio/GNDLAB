'use client';

/**
 * Kerangka pemuatan (skeleton) untuk menu GnD Lab yang perlu mengambil data dulu (DEC-095):
 * Ringkasan, Pencatatan Data, Riset Produk, Eksperimen, Laporan Belanja. Library & Standar tidak memakainya.
 */
export function LabSkeleton({ kind }: { kind: string }) {
  const bar = (w: string, h = 'h-4') => <div className={`skeleton ${h} ${w} rounded-lg`} />;
  return (
    <div className="flex flex-col gap-5" role="status" aria-live="polite" aria-label="Memuat data…" data-testid={`lab-skeleton-${kind}`}>
      {kind === 'bahan' && (
        <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="card card-data flex flex-col gap-2">
              {bar('w-2/3', 'h-3')}
              {bar('w-10', 'h-8')}
            </div>
          ))}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {bar('w-40', 'h-11')}
        {bar('w-48', 'h-11')}
        {kind === 'bahan' && bar('w-36', 'h-11')}
      </div>
      {[0, 1, 2].map((i) => (
        <div key={i} className="card card-data flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 flex-col gap-2">
            {bar('w-40', 'h-3')}
            {bar('w-64 max-w-full', 'h-5')}
            {bar('w-28', 'h-5')}
          </div>
          <div className="flex gap-2">
            {bar('w-16', 'h-9')}
            {bar('w-16', 'h-9')}
            {bar('w-16', 'h-9')}
          </div>
        </div>
      ))}
      <span className="sr-only">Memuat data…</span>
    </div>
  );
}
