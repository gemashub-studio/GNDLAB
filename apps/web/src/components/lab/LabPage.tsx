'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { GEMA_SOURCES, sourceCounts } from '@/lib/gemaSources';
import { labBackupJson, listExperiments, openNextSteps, type Experiment, type LabProductId } from '@/lib/labStore';
import { ExperimentsTab } from './ExperimentsTab';
import { LabOverview } from './LabOverview';
import { LibraryTab } from './LibraryTab';
import { StandardsTab } from './StandardsTab';

const TABS = [
  { id: 'ringkasan', label: 'Ringkasan' },
  { id: 'eksperimen', label: 'Eksperimen' },
  { id: 'library', label: 'Library' },
  { id: 'standar', label: 'Standar' },
] as const;
type TabId = (typeof TABS)[number]['id'];
const isTab = (s: string | null): s is TabId => TABS.some((t) => t.id === s);

const today = () => new Date().toISOString().slice(0, 10);

export function LabPage() {
  const [items, setItems] = useState<Experiment[]>([]);
  const [tab, setTab] = useState<TabId>('ringkasan');
  const [product, setProduct] = useState<LabProductId | 'all'>('all');
  const [stdProduct, setStdProduct] = useState<LabProductId>('KE');
  const [openId, setOpenId] = useState<string>();

  const refresh = useCallback(() => listExperiments().then(setItems).catch(() => setItems([])), []);
  useEffect(() => {
    void refresh();
    const p = new URLSearchParams(window.location.search);
    const t = p.get('t');
    if (isTab(t)) setTab(t);
    const e = p.get('e');
    if (e) {
      setTab('eksperimen');
      setOpenId(e);
    }
  }, [refresh]);
  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set('t', tab);
    if (tab === 'eksperimen' && openId) url.searchParams.set('e', openId);
    else url.searchParams.delete('e');
    window.history.replaceState(null, '', url);
  }, [tab, openId]);

  const openExperiment = (id: string) => {
    setOpenId(id);
    setTab('eksperimen');
  };
  const backup = () => {
    const url = URL.createObjectURL(new Blob([labBackupJson(items)], { type: 'application/json' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: `gema-rnd-cadangan-${today()}.json` });
    a.click();
    URL.revokeObjectURL(url);
  };

  const running = items.filter((e) => e.status === 'berjalan').length;
  const counts = sourceCounts();

  return (
    <div className="flex flex-col gap-6">
      <header className="card-ink relative flex flex-col gap-6 overflow-hidden" data-testid="lab-hero">
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-60 [background-image:radial-gradient(600px_260px_at_90%_0%,rgba(99,230,207,0.22),transparent_70%),linear-gradient(rgba(99,230,207,0.07)_1px,transparent_1px),linear-gradient(90deg,rgba(99,230,207,0.07)_1px,transparent_1px)] [background-size:auto,28px_28px,28px_28px]" />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-2">
            <Link href="/" className="font-mono text-[11px] font-semibold tracking-[0.14em] text-muted-ink no-underline hover:text-acid">gemasSTUDIO / R&amp;D</Link>
            <h1 className="text-[40px] text-paper sm:text-[56px]">GEMA <span className="text-acid">RnD</span> Lab</h1>
            <p className="max-w-xl text-[15px] text-muted-ink">
              Buku catatan eksperimen lima jalur produk kelapa. Tiap percobaan tersimpan terpisah, hasil gagal ikut dicatat, dan yang kosong tertulis “belum dicatat”.
            </p>
          </div>
          {items.length > 0 && (
            <button type="button" className="btn border-acid/40 bg-transparent text-acid hover:bg-acid hover:text-ink" onClick={backup} data-testid="lab-backup">
              Unduh cadangan (JSON)
            </button>
          )}
        </div>
        <dl className="relative grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-acid/15 sm:grid-cols-4">
          {[
            ['Eksperimen', items.length],
            ['Berjalan', running],
            ['Langkah terbuka', openNextSteps(items).length],
            ['Sumber diperiksa', `${counts.diperiksa}/${GEMA_SOURCES.length}`],
          ].map(([k, v]) => (
            <div key={k} className="flex flex-col gap-1 bg-ink/90 px-4 py-3">
              <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-ink">{k}</dt>
              <dd className="font-mono text-2xl font-semibold text-paper">{v}</dd>
            </div>
          ))}
        </dl>
      </header>

      <nav role="tablist" aria-label="Bagian lab" className="flex gap-1 overflow-x-auto rounded-2xl border-3 border-ink bg-surface p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => {
              setTab(t.id);
              if (t.id !== 'eksperimen') setOpenId(undefined);
            }}
            className={`min-h-touch flex-1 whitespace-nowrap rounded-xl px-4 text-sm font-semibold transition ${tab === t.id ? 'bg-ink text-acid' : 'text-muted hover:text-ink'}`}
            data-testid={`lab-tab-${t.id}`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === 'ringkasan' && (
        <LabOverview
          items={items}
          onOpen={openExperiment}
          onProduct={(p) => {
            setProduct(p);
            setOpenId(undefined);
            setTab('eksperimen');
          }}
        />
      )}
      {tab === 'eksperimen' && <ExperimentsTab items={items} product={product} setProduct={setProduct} openId={openId} setOpenId={setOpenId} refresh={refresh} />}
      {tab === 'library' && <LibraryTab />}
      {tab === 'standar' && <StandardsTab product={stdProduct} setProduct={setStdProduct} />}

      <p className="text-xs text-muted">
        Data eksperimen tersimpan di perangkat ini (offline). Rutin unduh cadangan. GEMA RnD tidak menyatakan produk aman dikonsumsi atau memenuhi standar.
      </p>
    </div>
  );
}
