'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { LoginForm } from '@/components/auth/LoginDialog';
import { fmtWaktu, groupByCategory, listProgres, PROGRES_CATEGORIES, type ProgresItem } from '@/lib/progresPerlakuan';
import { startAutoSync } from '@/lib/supabaseSync';
import { needsLogin, useAuth } from '@/lib/useAuth';
import { ImagePreview } from './Overlays';
import { GabungDataDialog } from './GabungDataDialog';
import { UploadProgresModal } from './UploadProgresModal';

/** Halaman "Media dan Data Progres Perlakuan" (DEC-095): 3 tabel besar per kategori — harian, mingguan, bulanan. */
export function ProgresPage() {
  const auth = useAuth();
  const [items, setItems] = useState<ProgresItem[]>();
  const [fresh, setFresh] = useState('');
  const [zoom, setZoom] = useState<ProgresItem>();
  const [upload, setUpload] = useState(false);
  const [gabung, setGabung] = useState(false);
  const load = useCallback(() => {
    void listProgres()
      .then(setItems)
      .catch(() => setItems([]));
  }, []);
  useEffect(() => {
    setFresh(new URLSearchParams(window.location.search).get('baru') ?? '');
    load();
  }, [load]);
  // data pengguna lain ikut tampil setelah sinkron
  useEffect(() => (needsLogin(auth) ? undefined : startAutoSync(load)), [auth, load]);
  useEffect(() => {
    if (!fresh || !items?.length) return;
    document.getElementById(`progres-${fresh}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [fresh, items]);

  const groups = groupByCategory(items ?? []);
  return (
    <div className="flex flex-col gap-6" data-testid="progres-page">
      <Link href="/lab?t=bahan" className="font-mono text-xs no-underline hover:text-acid">← Pencatatan data</Link>
      <header className="card-ink flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-2">
          <span className="font-mono text-[11px] tracking-[0.14em] text-muted-ink">GnD Lab · progres perlakuan</span>
          <h1 className="text-[28px] text-paper sm:text-[40px]">Media dan Data Progres Perlakuan</h1>
          <p className="font-mono text-sm text-muted-ink">{items ? `${items.length} upload · ${PROGRES_CATEGORIES.map((c) => `${c.label} ${groups[c.key].length}`).join(' · ')}` : 'Memuat…'}</p>
        </div>
        {!needsLogin(auth) && (
          <button type="button" className="btn-acid self-start sm:self-auto" onClick={() => setUpload(true)} data-testid="progres-upload">
            + Upload Progres
          </button>
        )}
      </header>

      {needsLogin(auth) ? (
        <section className="card flex max-w-xl flex-col gap-2" data-testid="progres-locked">
          <h2 className="font-display text-xl font-semibold">Masuk dulu untuk melihat progres perlakuan</h2>
          <LoginForm testId="progres-login" />
        </section>
      ) : (
        <>
        {/* Gabungkan data (DEC-096): pencatatan lengkap + riset produk + progres + laporan belanja → TXT / PPTX / Word */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted">Gabungkan pencatatan, riset produk, progres, dan laporan belanja jadi satu berkas.</p>
          <button type="button" className="btn-primary" onClick={() => setGabung(true)} disabled={!items} data-testid="progres-gabung">
            Gabungkan data
          </button>
        </div>
        {PROGRES_CATEGORIES.map((c) => (
          <section key={c.key} className="card flex flex-col gap-3" data-testid={`progres-tbl-${c.key}`}>
            <h2 className="flex items-center gap-2 text-xl">
              <span className="rounded-lg bg-ink px-2 py-0.5 font-mono text-xs text-acid">{c.label.toUpperCase()}</span>
              <span className="text-sm font-normal text-muted">{groups[c.key].length} upload</span>
            </h2>
            {!items ? (
              <div className="flex flex-col gap-2" aria-hidden>
                {[0, 1, 2].map((i) => <div key={i} className="skeleton h-14 rounded-xl" />)}
              </div>
            ) : groups[c.key].length ? (
              <div className="overflow-x-auto rounded-xl border border-paper-grid">
                <table className="w-full min-w-[560px] text-sm">
                  <thead>
                    <tr className="bg-ink text-left font-mono text-[11px] uppercase text-acid">
                      <th className="px-3 py-2">Foto</th>
                      <th className="px-3 py-2">Nama perlakuan</th>
                      <th className="px-3 py-2 text-right">Jumlah produksi/item</th>
                      <th className="px-3 py-2">Tanggal & jam</th>
                      <th className="px-3 py-2">Kode</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groups[c.key].map((it, i) => (
                      <tr key={it.id} id={`progres-${it.id}`} className={`${it.id === fresh ? 'bg-acid/20' : i % 2 ? 'bg-paper' : 'bg-white'}`} data-testid={`progres-row-${it.id}`}>
                        <td className="px-3 py-2">
                          <button type="button" onClick={() => setZoom(it)} aria-label={`Lihat foto ${it.treatment}`} className="rounded-lg">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={it.photo} alt={`Foto ${it.treatment}`} className="h-16 w-12 rounded-lg object-cover" />
                          </button>
                        </td>
                        <td className="px-3 py-2">
                          <span className="font-semibold">{it.treatment === 'GreenHouse' ? 'Green House' : it.treatment}</span>
                          {it.group && <span className="block text-xs text-muted">{it.group}</span>}
                        </td>
                        <td className="px-3 py-2 text-right font-mono">{it.qty}</td>
                        <td className="px-3 py-2">{fmtWaktu(it.at)}</td>
                        <td className="px-3 py-2 font-mono text-xs text-muted">{it.id}{it.id === fresh && <span className="ml-1 rounded bg-acid px-1 text-ink">baru</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm italic text-muted">Belum ada upload {c.label.toLowerCase()}.</p>
            )}
          </section>
        ))}
        </>
      )}
      {zoom && <ImagePreview src={zoom.photo} alt={`${zoom.treatment} · ${fmtWaktu(zoom.at)}`} onClose={() => setZoom(undefined)} />}
      {upload && <UploadProgresModal onClose={() => setUpload(false)} />}
      {gabung && <GabungDataDialog progres={items ?? []} onClose={() => setGabung(false)} />}
    </div>
  );
}
